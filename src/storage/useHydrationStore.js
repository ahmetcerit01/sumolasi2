import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES } from '../constants/badges';

const KEY = 'SUMOLASI_STATE_V7'; // Versiyonu V7 yaptık
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Ayarlar için Anahtarlar
const STORAGE_KEYS = {
  notifications: 'SUMOLASI_NOTIF_ENABLED',
  sound: 'SUMOLASI_SOUND_ENABLED',
};

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// 'YYYY-MM-DD' stringleri UTC gece yarısı olarak parse edilir; ikisi de UTC olduğu için fark doğru çıkar.
const diffInDays = (fromStr, toStr) => {
  if (!fromStr || !toStr) return 0;
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.round((d2 - d1) / MS_PER_DAY);
};

export const calculateGoal = (weight, height) => {
  if (!weight || !height) return 2500;
  let base = weight * 35;
  if (height > 170) base += (height - 170) * 10;
  else if (height < 160) base -= (160 - height) * 10;
  return Math.max(1200, Math.min(5000, Math.round(base)));
};

const listeners = new Set();

let store = {
  totalMl: 0,
  goalMl: 2500,
  lastDate: dateKey(),
  startDate: dateKey(), // Kullanıcının uygulamayı kullanmaya başladığı gün (ortalamalar için)
  isHydrated: false,
  todayGlasses: 0,
  lastAddAt: null,
  streakDays: 0,
  badges: {},
  dailyHistory: {},
  profile: {
    weight: 70, height: 170, wakeAt: '08:00', sleepAt: '23:00', gender: 'male'
  },
  recommendedGoal: 2500,
  // --- AYARLAR (Varsayılan Açık) ---
  notificationsEnabled: true,
  soundEnabled: true,
};

const emit = () => listeners.forEach((l) => l(store));

const persist = async () => {
  try {
    await AsyncStorage.multiSet([
      ['DAILY_GOAL_ML', String(store.goalMl)],
      [KEY, JSON.stringify(store)],
    ]);
  } catch {}
};

// UI önce güncellenir, disk yazımı arkadan gelir (await persist() önce gelince ekleme 2-3 sn gecikiyordu)
const commit = (next) => {
  store = next;
  emit();
  return persist();
};

// Gün devri: dünü geçmişe yazar, seriyi günceller, bugünü sıfırlar.
// Tek kaynak burası; hydrate, dakikalık zamanlayıcı ve uygulama öne gelince çağrılır.
export const rolloverIfNeeded = async () => {
  if (!store.isHydrated) return false;
  const today = dateKey();
  if (store.lastDate === today) return false;

  const prevDate = store.lastDate;
  const gap = diffInDays(prevDate, today);
  const metGoal = store.totalMl >= store.goalMl && store.totalMl > 0;
  // Arada kaçırılan gün varsa seri bozulur
  const streakDays = gap === 1 && metGoal ? (store.streakDays || 0) + 1 : 0;

  await commit({
    ...store,
    dailyHistory: {
      ...store.dailyHistory,
      [prevDate]: { ml: store.totalMl, goal: store.goalMl },
    },
    totalMl: 0,
    todayGlasses: 0,
    lastDate: today,
    streakDays,
  });
  return true;
};

// --- ACTIONS (hook dışı) ---
// Not: Bazı yerlerde Zustand gibi `useHydrationStore.getState().xxx` çağrısı var.
// Bu yüzden action'ları hook dışına taşıyıp tek bir API üretelim.

const actions = {
  add: async (ml) => {
    await rolloverIfNeeded();

    const nowIso = new Date().toISOString();
    const newTotal = (store.totalMl || 0) + ml;
    const newGlasses = (store.todayGlasses || 0) + 1;

    const candidateState = {
      totalMl: newTotal,
      goalMl: store.goalMl,
      todayGlasses: newGlasses,
      streakDays: store.streakDays,
      lastAddAt: nowIso,
    };

    const newBadges = { ...store.badges };
    if (Array.isArray(BADGES)) {
      BADGES.forEach((badge) => {
        if (!newBadges[badge.id] && typeof badge.check === 'function') {
          if (badge.check(candidateState)) newBadges[badge.id] = nowIso;
        }
      });
    }

    await commit({
      ...store,
      totalMl: newTotal,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      badges: newBadges,
    });
  },

  setGoalMl: async (ml) => {
    const val = parseInt(ml);
    if (!isNaN(val) && val > 0) {
      await commit({ ...store, goalMl: val });
    }
  },

  updateProfile: async (newProfile) => {
    const updatedProfile = { ...store.profile, ...newProfile };
    const newRecGoal = calculateGoal(updatedProfile.weight, updatedProfile.height);
    await commit({ ...store, profile: updatedProfile, recommendedGoal: newRecGoal });
  },

  setNotifications: async (val) => {
    store = { ...store, notificationsEnabled: val };
    emit();
    await AsyncStorage.setItem(STORAGE_KEYS.notifications, val ? '1' : '0');
  },

  setSound: async (val) => {
    store = { ...store, soundEnabled: val };
    emit();
    await AsyncStorage.setItem(STORAGE_KEYS.sound, val ? '1' : '0');
  },

  resetToday: async () => {
    await commit({ ...store, totalMl: 0, todayGlasses: 0 });
  },

  resetAll: async () => {
    const today = dateKey();
    store = {
      totalMl: 0,
      goalMl: 2500,
      recommendedGoal: 2500,
      lastDate: today,
      startDate: today,
      isHydrated: true,
      todayGlasses: 0,
      lastAddAt: null,
      streakDays: 0,
      badges: {},
      dailyHistory: {},
      profile: { weight: 70, height: 170, wakeAt: '08:00', sleepAt: '23:00', gender: 'male' },
      notificationsEnabled: true,
      soundEnabled: true,
    };
    emit();
    await AsyncStorage.multiRemove([
      'DAILY_GOAL_ML',
      'ONBOARD_PROFILE',
      STORAGE_KEYS.notifications,
      STORAGE_KEYS.sound,
    ]);
    await persist();
  },

  // Son 7 gün. Gün adı yerine dayIndex (0=Pazar) döner; ekran bunu aktif dile göre çevirir.
  // isTracked: kullanıcı o gün uygulamayı kullanıyor muydu (başlangıç tarihinden önceki günler ortalamaya girmez)
  getWeeklyData: () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dateKey(d);
      const isTracked = !store.startDate || k >= store.startDate;
      if (k === store.lastDate) {
        days.push({ dayIndex: d.getDay(), fullDate: k, ml: store.totalMl, goal: store.goalMl, isTracked });
      } else {
        const historyItem = store.dailyHistory[k] || { ml: 0, goal: store.goalMl };
        days.push({ dayIndex: d.getDay(), fullDate: k, ml: historyItem.ml, goal: historyItem.goal, isTracked });
      }
    }
    return days;
  },
};

const getApi = (snapshot) => ({
  ...(snapshot || store),
  ...actions,
});

let hydratePromise = null;

async function hydrate() {
  try {
    const [raw, legacyGoalRaw, legacyProfile, notifRaw, soundRaw] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem('DAILY_GOAL_ML'),
      AsyncStorage.getItem('ONBOARD_PROFILE'),
      AsyncStorage.getItem(STORAGE_KEYS.notifications),
      AsyncStorage.getItem(STORAGE_KEYS.sound),
    ]);

    const today = dateKey();
    const parsedStore = raw ? JSON.parse(raw) : {};
    const parsedProfile = legacyProfile ? JSON.parse(legacyProfile) : null;

    // Profil ekranında yapılan düzenlemeler store'da durur; eski ONBOARD_PROFILE sadece yedek.
    const activeProfile = {
      weight: parsedStore.profile?.weight || parsedProfile?.weightKg || 70,
      height: parsedStore.profile?.height || parsedProfile?.heightCm || 170,
      wakeAt: parsedStore.profile?.wakeAt || parsedProfile?.wakeAt || '08:00',
      sleepAt: parsedStore.profile?.sleepAt || parsedProfile?.sleepAt || '23:00',
      gender: parsedStore.profile?.gender || parsedProfile?.gender || 'male',
    };

    const recGoal = calculateGoal(activeProfile.weight, activeProfile.height);

    let finalGoal = recGoal;
    if (parsedStore.goalMl && parsedStore.goalMl > 0) {
      finalGoal = parsedStore.goalMl;
    } else if (legacyGoalRaw) {
      const lg = parseInt(legacyGoalRaw);
      if (!isNaN(lg) && lg > 0) finalGoal = lg;
    }

    // Eski kullanıcılarda startDate yok: geçmişteki en eski günü kullan
    const historyKeys = Object.keys(parsedStore.dailyHistory || {}).sort();
    const startDate = parsedStore.startDate || historyKeys[0] || parsedStore.lastDate || today;

    // AYARLARI OKU (Eğer null ise true kabul et)
    const isNotifOn = notifRaw !== '0';
    const isSoundOn = soundRaw !== '0';

    store = {
      ...store,
      ...parsedStore,
      goalMl: finalGoal,
      recommendedGoal: recGoal,
      profile: activeProfile,
      lastDate: parsedStore.lastDate || today,
      startDate,
      isHydrated: true,
      dailyHistory: parsedStore.dailyHistory || {},
      badges: parsedStore.badges || {},
      notificationsEnabled: isNotifOn,
      soundEnabled: isSoundOn,
    };
    emit();

    await rolloverIfNeeded();
  } catch (e) {
    console.warn("Hydrate error:", e);
  }
}

export const ensureHydrated = () => {
  if (!hydratePromise) hydratePromise = hydrate();
  return hydratePromise;
};

// Gece yarısını yakalamak için tek bir zamanlayıcı (eskiden her hook kendi interval'ını kuruyordu)
let rolloverTimer = null;
const startRolloverWatch = () => {
  if (rolloverTimer) return;
  rolloverTimer = setInterval(rolloverIfNeeded, 60000);
  AppState.addEventListener('change', (st) => {
    if (st === 'active') rolloverIfNeeded();
  });
};

export function useHydrationStore(selector) {
  const [snapshot, setSnapshot] = useState(store);

  useEffect(() => {
    const sub = (s) => setSnapshot(s);
    listeners.add(sub);
    // Abone olmadan önce gelen güncellemeyi kaçırmamak için
    if (snapshot !== store) setSnapshot(store);
    ensureHydrated();
    startRolloverWatch();
    return () => listeners.delete(sub);
  }, []);

  const api = getApi(snapshot);
  return typeof selector === 'function' ? selector(api) : api;
}

// ------------------------------------------------------------
// Not: Projede bazı yerlerde Zustand gibi `useHydrationStore.getState()`
// çağrısı yapılmış. Bu dosya Zustand store değil, custom hook.
// Crash olmaması için minimal bir `getState/setState` köprüsü ekliyoruz.
// ------------------------------------------------------------
useHydrationStore.getState = () => getApi(store);

useHydrationStore.setState = async (partial, shouldPersist = true) => {
  const next = typeof partial === 'function' ? partial(store) : partial;
  if (!next || typeof next !== 'object') return;

  store = { ...store, ...next };
  emit();
  if (shouldPersist) await persist();
};

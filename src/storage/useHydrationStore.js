import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_GOAL, computeGoalMl } from '../utils/goal';
import { BADGES } from '../constants/badges';
import { DEFAULT_SHIFT_SCHEDULE, getEffectiveShiftStart, getShiftForDate, getShiftSchedule, normalizeShiftSchedule } from '../utils/shiftSchedule';

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

export const waterDateKey = (date = new Date(), wakeAt = '08:00') => {
  const [wakeHour = 8, wakeMinute = 0] = String(wakeAt || '08:00').split(':').map(Number);
  const cutoff = new Date(date);
  if (date.getHours() * 60 + date.getMinutes() < wakeHour * 60 + wakeMinute) cutoff.setDate(cutoff.getDate() - 1);
  return dateKey(cutoff);
};

// 'YYYY-MM-DD' stringleri UTC gece yarısı olarak parse edilir; ikisi de UTC olduğu için fark doğru çıkar.
const diffInDays = (fromStr, toStr) => {
  if (!fromStr || !toStr) return 0;
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.round((d2 - d1) / MS_PER_DAY);
};

export const calculateGoal = computeGoalMl;

const listeners = new Set();
let hydrationQueue = Promise.resolve();
const enqueueHydration = (work) => {
  const next = hydrationQueue.then(work, work);
  hydrationQueue = next.catch(() => {});
  return next;
};

let store = {
  totalMl: 0,
  goalMl: DEFAULT_GOAL,
  lastDate: waterDateKey(),
  startDate: waterDateKey(), // Kullanıcının uygulamayı kullanmaya başladığı su günü
  isHydrated: false,
  todayGlasses: 0,
  lastAddAt: null,
  entries: [], // bugünkü eklemeler [{ id, ml, at }] (Bugün listesi ve geri alma için)
  streakDays: 0,
  badges: {},
  dailyHistory: {},
  profile: {
    weight: 70, height: 170, wakeAt: '08:00', sleepAt: '23:00', gender: 'male'
  },
  shiftSchedule: DEFAULT_SHIFT_SCHEDULE,
  recommendedGoal: DEFAULT_GOAL,
  // --- AYARLAR (Varsayılan Açık) ---
  notificationsEnabled: true,
  soundEnabled: true,
};

export const getCurrentWaterDateKey = (date = new Date(), snapshot = store) => {
  if (!snapshot.shiftSchedule?.enabled) return waterDateKey(date, snapshot.profile?.wakeAt || '08:00');
  const effectiveStart = getEffectiveShiftStart(snapshot.shiftSchedule, date);
  const waterDay = new Date(date);
  if (date < effectiveStart) waterDay.setDate(waterDay.getDate() - 1);
  return dateKey(waterDay);
};

const emit = () => listeners.forEach((l) => l(store));

// React dışından (ör. widget senkronu) store değişikliklerini dinlemek için
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const persist = async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
  await AsyncStorage.setItem('DAILY_GOAL_ML', String(store.goalMl));
};
const commit = async (next) => {
  const saved = { ...next, rev: (store.rev || 0) + 1 };
  await AsyncStorage.setItem(KEY, JSON.stringify(saved));
  store = saved;
  emit();
  await AsyncStorage.setItem('DAILY_GOAL_ML', String(store.goalMl)).catch(() => {});
};

// Diskteki kopya bizimkinden yeniyse onu al (yazmadan önce ve uygulama öne gelince çağrılır)
export const refreshIfStale = async () => {
  if (!store.isHydrated) return false;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return false;
    const disk = JSON.parse(raw);
    if ((disk.rev || 0) > (store.rev || 0)) {
      store = { ...store, ...disk, isHydrated: true };
      emit();
      return true;
    }
  } catch {}
  return false;
};

const completedStreak = (history, currentDay, fallbackGoal) => {
  const cursor = new Date(`${currentDay}T12:00:00`);
  let count = 0;
  cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const item = history[dateKey(cursor)];
    if (!item || !item.ml || item.ml < (item.goal || fallbackGoal)) return count;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
};

// Gün devri: dünü geçmişe yazar, seriyi günceller, bugünü sıfırlar.
// Tek kaynak burası; hydrate, dakikalık zamanlayıcı ve uygulama öne gelince çağrılır.
const rolloverInternal = async () => {
  if (!store.isHydrated) return false;
  await refreshIfStale();
  const today = getCurrentWaterDateKey(new Date(), store);
  // Saat düzeni değişince su günü geriye kayabilir. Veriyi geriye sarmak yerine
  // mevcut su dönemini koru; yeni dönem, tarih ileri geçtiğinde başlar.
  if (today <= store.lastDate) return false;

  const prevDate = store.lastDate;
  const gap = diffInDays(prevDate, today);
  const metGoal = store.totalMl >= store.goalMl && store.totalMl > 0;
  // Arada kaçırılan gün varsa seri bozulur
  const streakDays = gap === 1 && metGoal ? (store.streakDays || 0) + 1 : 0;

  await commit({
    ...store,
    dailyHistory: {
      ...store.dailyHistory,
      [prevDate]: {
        ml: store.totalMl, goal: store.goalMl, count: store.todayGlasses || 0,
        entries: store.entries || [],
        shiftMode: store.dayShiftMode ?? null,
      },
    },
    totalMl: 0,
    todayGlasses: 0,
    entries: [],
    lastDate: today,
    dayShiftMode: store.shiftSchedule?.enabled ? getShiftForDate(store.shiftSchedule, new Date(`${today}T12:00:00`)).mode : null,
    streakDays,
  });
  return true;
};

// --- ACTIONS (hook dışı) ---
// Not: Bazı yerlerde Zustand gibi `useHydrationStore.getState().xxx` çağrısı var.
// Bu yüzden action'ları hook dışına taşıyıp tek bir API üretelim.

export const rolloverIfNeeded = () => enqueueHydration(rolloverInternal);

const actionImpl = {
  add: async (ml, metadata = {}) => {
    ml = Number(ml);
    if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) throw new Error('invalid_water_amount');
    await rolloverInternal();

    const nowIso = metadata.at || new Date().toISOString();
    const newTotal = (store.totalMl || 0) + ml;
    const newGlasses = (store.todayGlasses || 0) + 1;

    const candidateState = {
      activeDays: Object.values(store.dailyHistory || {}).filter((day) => day.ml > 0).length + 1,
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

    const entry = { id: metadata.id || `${Date.now()}-${Math.round(Math.random() * 1e6)}`, ml, at: nowIso };
    await commit({
      ...store,
      totalMl: newTotal,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      entries: [...(store.entries || []), entry],
      badges: newBadges,
      appliedExternalIds: metadata.externalId ? [...(store.appliedExternalIds || []), metadata.externalId].slice(-2000) : store.appliedExternalIds,
    });
  },

  // Son eklemeyi geri al (yanlış dokunuşlar için). Kazanılan rozetler geri alınmaz.
  undoLast: async () => {
    await rolloverInternal();
    await refreshIfStale();
    const entries = store.entries || [];
    if (entries.length === 0) return false;
    const last = entries[entries.length - 1];
    const rest = entries.slice(0, -1);
    await commit({
      ...store,
      totalMl: Math.max(0, (store.totalMl || 0) - (last.ml || 0)),
      todayGlasses: Math.max(0, (store.todayGlasses || 0) - 1),
      lastAddAt: rest.length ? rest[rest.length - 1].at : null,
      entries: rest,
    });
    return true;
  },

  removeEntry: async (day, id) => {
    await rolloverInternal();
    const current = day === store.lastDate;
    const record = current ? { ml: store.totalMl, count: store.todayGlasses, entries: store.entries } : store.dailyHistory[day];
    const entry = record?.entries?.find((item) => item.id === id);
    if (!entry) return false;
    const entries = record.entries.filter((item) => item.id !== id);
    const ml = Math.max(0, (record.ml || 0) - entry.ml);
    if (current) {
      await commit({ ...store, totalMl: ml, todayGlasses: Math.max(0, (record.count || 0) - 1), entries,
        lastAddAt: entries.length ? entries[entries.length - 1].at : null });
    } else {
      const dailyHistory = { ...store.dailyHistory, [day]: { ...record, ml, count: Math.max(0, (record.count || 0) - 1), entries } };
      const streakDays = completedStreak(dailyHistory, store.lastDate, store.goalMl);
      await commit({ ...store, dailyHistory, streakDays });
    }
    return true;
  },

  // Widget'tan eklenen miktar. Bugüne aitse normal ekleme (rozetler dahil);
  // uygulama açılmadan gün döndüyse o günün geçmiş kaydına yazılır.
  // id: widget/Siri tarafında üretilen benzersiz kimlik. Aynı kayıt iki kez gelirse (iki senkron
  // aynı anda çalışırsa) ikinci kez eklenmez.
  addFromWidget: async (ml, day, id, at) => {
    await rolloverInternal();
    const amount = Number(ml);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) throw new Error('invalid_widget_amount');
    if (id && (store.appliedExternalIds || []).includes(id)) return;
    if (!day || day === store.lastDate) {
      await actionImpl.add(amount, { id, at, externalId: id });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > store.lastDate) throw new Error('widget_day_unresolved');
    const prev = store.dailyHistory[day] || { ml: 0, goal: store.goalMl, count: 0 };
    const entry = at ? [{ id, at, ml: amount }] : [];
    const dailyHistory = { ...store.dailyHistory, [day]: { ...prev, ml: (prev.ml || 0) + amount,
      count: (prev.count || 0) + 1, entries: [...(prev.entries || []), ...entry] } };
    await commit({
      ...store, dailyHistory,
      streakDays: completedStreak(dailyHistory, store.lastDate, store.goalMl),
      appliedExternalIds: id ? [...(store.appliedExternalIds || []), id].slice(-2000) : store.appliedExternalIds,
    });
  },

  setGoalMl: async (ml) => {
    await refreshIfStale();
    const val = parseInt(ml);
    await rolloverInternal();
    if (!isNaN(val) && val >= 800 && val <= 6000) {
      await commit({ ...store, goalMl: val });
    }
  },

  adjustGoalMl: async (delta) => {
    await rolloverInternal();
    const amount = Number(delta);
    if (!Number.isFinite(amount)) return;
    await commit({ ...store, goalMl: Math.max(800, Math.min(6000, store.goalMl + amount)) });
  },

  updateProfile: async (newProfile) => {
    await refreshIfStale();
    await rolloverInternal();
    const updatedProfile = { ...store.profile, ...newProfile };
    const newRecGoal = calculateGoal(updatedProfile.weight, updatedProfile.height);
    await commit({ ...store, profile: updatedProfile, recommendedGoal: newRecGoal });
    await rolloverInternal();
  },

  setShiftSchedule: async (shiftSchedule) => {
    await refreshIfStale();
    await rolloverInternal();
    await commit({ ...store, shiftSchedule: normalizeShiftSchedule(shiftSchedule) });
    await rolloverInternal();
  },

  setNotifications: async (val) => {
    await AsyncStorage.setItem(STORAGE_KEYS.notifications, val ? '1' : '0');
    store = { ...store, notificationsEnabled: val };
    emit();
  },

  setSound: async (val) => {
    await AsyncStorage.setItem(STORAGE_KEYS.sound, val ? '1' : '0');
    store = { ...store, soundEnabled: val };
    emit();
  },

  resetToday: async () => {
    await refreshIfStale();
    await commit({ ...store, totalMl: 0, todayGlasses: 0, entries: [] });
  },

  resetAll: async () => {
    const today = waterDateKey(new Date(), '08:00');
    store = {
      rev: (store.rev || 0) + 1,
      totalMl: 0,
      goalMl: DEFAULT_GOAL,
      recommendedGoal: DEFAULT_GOAL,
      lastDate: today,
      startDate: today,
      isHydrated: true,
      todayGlasses: 0,
      lastAddAt: null,
      entries: [],
      streakDays: 0,
      badges: {},
      dailyHistory: {},
      profile: { weight: 70, height: 170, wakeAt: '08:00', sleepAt: '23:00', gender: 'male' },
      shiftSchedule: DEFAULT_SHIFT_SCHEDULE,
      notificationsEnabled: true,
      soundEnabled: true,
    };
    emit();
    await AsyncStorage.multiRemove([
      'DAILY_GOAL_ML',
      'ONBOARD_PROFILE',
      STORAGE_KEYS.notifications,
      STORAGE_KEYS.sound,
      'SUMOLASI_SHIFT_SCHEDULE_V1',
    ]);
    await persist();
  },

  // Son N gün (varsayılan 7). Gün adı yerine dayIndex (0=Pazar) döner; ekran bunu aktif dile göre çevirir.
  // isTracked: kullanıcı o gün uygulamayı kullanıyor muydu (başlangıç tarihinden önceki günler ortalamaya girmez)
  getDays: (count = 7) => {
    const days = [];
    const currentKey = getCurrentWaterDateKey(new Date(), store);
    const todayKey = currentKey > store.lastDate ? currentKey : store.lastDate;
    const [year, month, day] = todayKey.split('-').map(Number);
    const today = new Date(year, month - 1, day, 12, 0, 0, 0);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dateKey(d);
      const isTracked = !store.startDate || k >= store.startDate;
      const item = k === store.lastDate
        ? { ml: store.totalMl, goal: store.goalMl, count: store.todayGlasses || 0, entries: store.entries || [],
            shiftMode: store.dayShiftMode ?? null }
        : { ml: 0, goal: store.goalMl, count: 0, ...(store.dailyHistory[k] || {}) };
      days.push({ dayIndex: d.getDay(), date: d.getDate(), fullDate: k, isToday: k === store.lastDate, isTracked, ...item });
    }
    return days;
  },

  getWeeklyData: () => actions.getDays(7),

  // Geçmişteki en uzun hedef serisi (bugün tamamlandıysa dahil)
  getLongestStreak: () => {
    const met = new Set(
      Object.entries(store.dailyHistory || {})
        .filter(([, v]) => v && v.ml > 0 && v.ml >= (v.goal || store.goalMl))
        .map(([k]) => k)
    );
    if (store.totalMl > 0 && store.totalMl >= store.goalMl) met.add(store.lastDate);
    let best = 0;
    for (const k of met) {
      const prev = new Date(k);
      prev.setUTCDate(prev.getUTCDate() - 1);
      if (met.has(prev.toISOString().slice(0, 10))) continue; // serinin başı değil
      let len = 0;
      const cur = new Date(k);
      while (met.has(cur.toISOString().slice(0, 10))) {
        len += 1;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      best = Math.max(best, len);
    }
    return best;
  },
};

const readActions = new Set(['getDays', 'getWeeklyData', 'getLongestStreak']);
const actions = Object.fromEntries(Object.entries(actionImpl).map(([name, action]) => [name,
  readActions.has(name) ? action : (...args) => enqueueHydration(async () => {
    await ensureHydrated();
    return action(...args);
  }),
]));

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
    const shiftSchedule = normalizeShiftSchedule(parsedStore.shiftSchedule || await getShiftSchedule());
    const today = getCurrentWaterDateKey(new Date(), { shiftSchedule, profile: activeProfile });

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
      shiftSchedule,
      lastDate: parsedStore.lastDate || today,
      startDate,
      isHydrated: true,
      dailyHistory: parsedStore.dailyHistory || {},
      badges: parsedStore.badges || {},
      entries: Array.isArray(parsedStore.entries) ? parsedStore.entries : [],
      notificationsEnabled: isNotifOn,
      soundEnabled: isSoundOn,
    };
    emit();

    await rolloverInternal();
  } catch (e) {
    store = { ...store, isHydrated: false };
    throw e;
  }
}

export const ensureHydrated = () => {
  if (!hydratePromise) hydratePromise = hydrate().catch((error) => { hydratePromise = null; throw error; });
  return hydratePromise;
};

// Gece yarısını yakalamak için tek bir zamanlayıcı (eskiden her hook kendi interval'ını kuruyordu)
let rolloverTimer = null;
const startRolloverWatch = () => {
  if (rolloverTimer) return;
  rolloverTimer = setInterval(() => rolloverIfNeeded().catch(() => {}), 60000);
  AppState.addEventListener('change', (st) => {
    if (st === 'active') rolloverIfNeeded().catch(() => {}); // içinde refreshIfStale de çalışır
  });
};

export function useHydrationStore(selector) {
  const [snapshot, setSnapshot] = useState(store);

  useEffect(() => {
    const sub = (s) => setSnapshot(s);
    listeners.add(sub);
    // Abone olmadan önce gelen güncellemeyi kaçırmamak için
    if (snapshot !== store) setSnapshot(store);
    ensureHydrated().catch(() => {});
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

useHydrationStore.setState = (partial, shouldPersist = true) => enqueueHydration(async () => {
  await ensureHydrated();
  const next = typeof partial === 'function' ? partial(store) : partial;
  if (!next || typeof next !== 'object') return;
  if (shouldPersist) await commit({ ...store, ...next });
  else { store = { ...store, ...next }; emit(); }
});

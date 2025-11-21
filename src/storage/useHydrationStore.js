import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES } from '../constants/badges';

const KEY = 'SUMOLASI_STATE_V6'; 
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const diffInDays = (fromStr, toStr) => {
  if (!fromStr || !toStr) return 0;
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.floor((d2 - d1) / MS_PER_DAY);
};

// Su Hedefi Hesaplama Formülü
const calculateGoal = (weight, height) => {
  if (!weight || !height) return 2500;
  let base = weight * 35;
  // Boy ayarı
  if (height > 170) base += (height - 170) * 10;
  else if (height < 160) base -= (160 - height) * 10;
  
  return Math.max(1200, Math.min(5000, Math.round(base)));
};

const listeners = new Set();

let store = {
  totalMl: 0,
  goalMl: 2500, 
  lastDate: dateKey(),
  isHydrated: false,
  todayGlasses: 0,
  lastAddAt: null,
  streakDays: 0,
  badges: {},
  dailyHistory: {},
  profile: {
    weight: 70,
    height: 170,
    wakeAt: '08:00',
    sleepAt: '23:00',
    gender: 'male'
  },
  recommendedGoal: 2500,
};

const emit = () => listeners.forEach((l) => l(store));

const persist = async () => {
  try {
    // Goal'i her zaman ayrı bir anahtara da yazıyoruz ki kaybolmasın
    await AsyncStorage.setItem('DAILY_GOAL_ML', String(store.goalMl)); 
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
    await AsyncStorage.setItem('ONBOARD_PROFILE', JSON.stringify(store.profile));
  } catch {}
};

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const legacyGoalRaw = await AsyncStorage.getItem('DAILY_GOAL_ML');
    const legacyProfile = await AsyncStorage.getItem('ONBOARD_PROFILE');
    
    const today = dateKey();
    let parsedStore = raw ? JSON.parse(raw) : {};
    let parsedProfile = legacyProfile ? JSON.parse(legacyProfile) : null;

    // Profil verilerini birleştir
    const activeProfile = {
      weight: parsedProfile?.weightKg || parsedStore.profile?.weight || 70,
      height: parsedProfile?.heightCm || parsedStore.profile?.height || 170,
      wakeAt: parsedProfile?.wakeAt || parsedStore.profile?.wakeAt || '08:00',
      sleepAt: parsedProfile?.sleepAt || parsedStore.profile?.sleepAt || '23:00',
      gender: parsedProfile?.gender || parsedStore.profile?.gender || 'male'
    };

    const recGoal = calculateGoal(activeProfile.weight, activeProfile.height);

    // --- KRİTİK DÜZELTME BURADA ---
    // Öncelik: 1. 'DAILY_GOAL_ML' (Onboard/Profil ayarı) -> 2. Store içindeki veri -> 3. Hesaplanan
    let finalGoal = 2500;

    if (legacyGoalRaw) {
      const lg = parseInt(legacyGoalRaw);
      if (!isNaN(lg) && lg > 0) {
        finalGoal = lg; // Onboard verisi varsa KESİN bunu kullan
      }
    } else if (parsedStore.goalMl && parsedStore.goalMl > 0) {
      finalGoal = parsedStore.goalMl;
    } else {
      finalGoal = recGoal;
    }

    store = {
      ...store,
      ...parsedStore,
      goalMl: finalGoal, // Düzeltilmiş hedef
      recommendedGoal: recGoal,
      profile: activeProfile,
      lastDate: parsedStore.lastDate || today,
      isHydrated: true,
      dailyHistory: parsedStore.dailyHistory || {},
      badges: parsedStore.badges || {},
    };

    // Gün değişimi kontrolü
    const diffDays = diffInDays(store.lastDate, today);
    if (diffDays > 0) {
      const prevDate = store.lastDate;
      const updatedHistory = { 
        ...store.dailyHistory,
        [prevDate]: { ml: store.totalMl, goal: store.goalMl }
      };
      const newStreak = (store.totalMl >= store.goalMl) ? (store.streakDays + 1) : 0;

      store = {
        ...store,
        totalMl: 0,
        todayGlasses: 0,
        lastDate: today,
        streakDays: newStreak,
        dailyHistory: updatedHistory,
      };
      await persist();
    }
    emit();
  } catch (e) {
    console.warn("Hydrate error:", e);
  }
}

export function useHydrationStore(selector) {
  const [snapshot, setSnapshot] = useState(store);

  useEffect(() => {
    const sub = (s) => setSnapshot(s);
    listeners.add(sub);
    if (!store.isHydrated) hydrate();
    return () => listeners.delete(sub);
  }, []);

  // Gece Yarısı Kontrolü
  useEffect(() => {
    const id = setInterval(async () => {
      const today = dateKey();
      if (store.lastDate !== today) {
        const prevDate = store.lastDate;
        const updatedHistory = { 
          ...store.dailyHistory,
          [prevDate]: { ml: store.totalMl, goal: store.goalMl }
        };
        store = {
          ...store,
          totalMl: 0,
          todayGlasses: 0,
          lastDate: today,
          streakDays: (store.totalMl >= store.goalMl) ? store.streakDays + 1 : 0,
          dailyHistory: updatedHistory
        };
        await persist();
        emit();
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // --- ACTIONS ---
  const add = async (ml) => {
    const nowIso = new Date().toISOString();
    const newTotal = (store.totalMl || 0) + ml;
    const newGlasses = (store.todayGlasses || 0) + 1;

    // Rozet Kontrolü
    const candidateState = {
      totalMl: newTotal,
      goalMl: store.goalMl,
      todayGlasses: newGlasses,
      streakDays: store.streakDays,
      lastAddAt: nowIso,
    };
    const newBadges = { ...store.badges };
    if (Array.isArray(BADGES)) {
      BADGES.forEach(badge => {
        if (!newBadges[badge.id] && typeof badge.check === 'function') {
          if (badge.check(candidateState)) newBadges[badge.id] = nowIso;
        }
      });
    }

    store = { ...store, totalMl: newTotal, todayGlasses: newGlasses, lastAddAt: nowIso, badges: newBadges };
    await persist();
    emit();
  };

  const setGoalMl = async (ml) => {
    const val = parseInt(ml);
    if (!isNaN(val) && val > 0) {
      store = { ...store, goalMl: val };
      await persist();
      emit();
    }
  };

  const updateProfile = async (newProfile) => {
    const updatedProfile = { ...store.profile, ...newProfile };
    const newRecGoal = calculateGoal(updatedProfile.weight, updatedProfile.height);
    
    store = { 
      ...store, 
      profile: updatedProfile, 
      recommendedGoal: newRecGoal,
      // Eğer kullanıcı özel bir hedef belirlememişse, önerileni ana hedef yapabiliriz.
      // Şimdilik sadece önerileni güncelliyoruz, ana hedefi (goalMl) manuel değiştirebilir.
    };
    await persist();
    emit();
  };

  const resetToday = async () => {
    store = { ...store, totalMl: 0, todayGlasses: 0 };
    await persist();
    emit();
  };

  const resetAll = async () => {
    const today = dateKey();
    store = {
      totalMl: 0, goalMl: 2500, recommendedGoal: 2500, lastDate: today, isHydrated: true, todayGlasses: 0, streakDays: 0, badges: {}, dailyHistory: {},
      profile: { weight: 70, height: 170, wakeAt: '08:00', sleepAt: '23:00', gender: 'male' }
    };
    await AsyncStorage.removeItem('DAILY_GOAL_ML');
    await AsyncStorage.removeItem('ONBOARD_PROFILE');
    await persist();
    emit();
  };

  const getWeeklyData = () => {
    const days = [];
    const today = new Date();
    const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dateKey(d);
      const dayName = dayNames[d.getDay()];
      if (k === store.lastDate) {
        days.push({ day: dayName, fullDate: k, ml: store.totalMl, goal: store.goalMl });
      } else {
        const historyItem = store.dailyHistory[k] || { ml: 0, goal: store.goalMl };
        days.push({ day: dayName, fullDate: k, ml: historyItem.ml, goal: historyItem.goal });
      }
    }
    return days;
  };

  const api = { ...snapshot, add, setGoalMl, updateProfile, resetToday, resetAll, getWeeklyData };
  return typeof selector === 'function' ? selector(api) : api;
}
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES } from '../constants/badges';

const KEY = 'SUMOLASI_STATE_V5'; // Versiyonu V5 yapalım ki temiz başlasın
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const normalizeDateKey = (value) => {
  if (!value) return null;
  if (ISO_DATE_RE.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKey(parsed);
};

const diffInDays = (fromStr, toStr) => {
  if (!fromStr || !toStr) return 0;
  const d1 = new Date(fromStr);
  const d2 = new Date(toStr);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 0;
  return Math.floor((d2 - d1) / MS_PER_DAY);
};

const listeners = new Set();

// Varsayılan state
let store = {
  totalMl: 0,
  goalMl: 2500, 
  lastDate: dateKey(),
  isHydrated: false,
  todayGlasses: 0, // Bardak sayacı
  lastAddAt: null,
  streakDays: 0,
  badges: {}, // Kazanılan rozetler: { 'badge_id': '2023-10-25T...' }
  dailyHistory: {},
};

const emit = () => listeners.forEach((l) => l(store));

const persist = async () => {
  try {
    await AsyncStorage.setItem('DAILY_GOAL_ML', String(store.goalMl)); 
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
};

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const legacyGoalRaw = await AsyncStorage.getItem('DAILY_GOAL_ML');
    
    const today = dateKey();
    let parsedStore = raw ? JSON.parse(raw) : {};

    // Hedef Belirleme
    let finalGoal = 2500;
    if (parsedStore.goalMl && parsedStore.goalMl > 0) {
      finalGoal = parsedStore.goalMl;
    } else if (legacyGoalRaw) {
      const lg = parseInt(legacyGoalRaw);
      if (!isNaN(lg) && lg > 0) finalGoal = lg;
    }

    // State Birleştirme
    store = {
      ...store,
      ...parsedStore,
      goalMl: finalGoal,
      lastDate: parsedStore.lastDate || today,
      isHydrated: true,
      dailyHistory: parsedStore.dailyHistory || {},
      badges: parsedStore.badges || {},
      todayGlasses: parsedStore.todayGlasses || 0,
    };

    // Gün Değişimi Kontrolü
    const diffDays = diffInDays(store.lastDate, today);

    if (diffDays > 0) {
      const prevDate = store.lastDate;
      const updatedHistory = { 
        ...store.dailyHistory,
        [prevDate]: { ml: store.totalMl, goal: store.goalMl }
      };

      const metGoal = store.totalMl >= store.goalMl;
      const newStreak = metGoal ? (store.streakDays + 1) : 0;

      store = {
        ...store,
        totalMl: 0,
        todayGlasses: 0, // Yeni günde bardak sayısını sıfırla
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

    // --- ROZET KONTROL MEKANİZMASI (BURASI EKLENDİ) ---
    // Rozet kurallarını kontrol et
    const candidateState = {
      totalMl: newTotal,
      goalMl: store.goalMl,
      todayGlasses: newGlasses,
      streakDays: store.streakDays,
      lastAddAt: nowIso,
    };

    const newBadges = { ...store.badges };
    let badgeEarned = false;

    if (Array.isArray(BADGES)) {
      BADGES.forEach(badge => {
        // Eğer rozet daha önce kazanılmadıysa VE şartı sağlıyorsa
        if (!newBadges[badge.id] && typeof badge.check === 'function') {
          const isUnlocked = badge.check(candidateState);
          if (isUnlocked) {
            newBadges[badge.id] = nowIso; // Kazanılma tarihini kaydet
            badgeEarned = true;
          }
        }
      });
    }

    store = { 
      ...store, 
      totalMl: newTotal,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      badges: newBadges // Güncellenmiş rozet listesi
    };
    
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

  const resetToday = async () => {
    store = { ...store, totalMl: 0, todayGlasses: 0 };
    await persist();
    emit();
  };

  const resetAll = async () => {
    const today = dateKey();
    store = {
      totalMl: 0,
      goalMl: 2500,
      lastDate: today,
      isHydrated: true,
      todayGlasses: 0,
      streakDays: 0,
      badges: {},
      dailyHistory: {},
    };
    await AsyncStorage.removeItem('DAILY_GOAL_ML');
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

  const api = {
    ...snapshot,
    add,
    setGoalMl,
    resetToday,
    resetAll,
    getWeeklyData
  };

  return typeof selector === 'function' ? selector(api) : api;
}
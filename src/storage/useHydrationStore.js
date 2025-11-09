// src/storage/useHydrationStore.js
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES } from '../constants/badges';

const KEY = 'SUMOLASI_STATE_V1';

// --- Simple pub/sub so all screens stay in sync ---
const listeners = new Set();

let store = {
  totalMl: 0,
  goalMl: 2500,                 // Varsayılan hedef; kullanıcı seçince üzerine yazılır
  lastDate: new Date().toDateString(),
  isHydrated: false,
  todayGlasses: 0,
  lastAddAt: null,
  streakDays: 0,
  badges: {},                   // { [badgeId]: true }
  hasChosenGoal: false,         // Hedef bir kez seçildi mi?
};

const emit = () => listeners.forEach((l) => l(store));

const persist = async () => {
  const {
    totalMl,
    goalMl,
    lastDate,
    todayGlasses,
    lastAddAt,
    streakDays,
    badges,
    hasChosenGoal,
  } = store;
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        totalMl,
        goalMl,
        lastDate,
        todayGlasses,
        lastAddAt,
        streakDays,
        badges,
        hasChosenGoal,
      })
    );
  } catch {}
};

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const today = new Date().toDateString();

    if (!raw) {
      // İlk kurulum
      store = {
        ...store,
        lastDate: today,
        isHydrated: true,
        todayGlasses: 0,
        lastAddAt: null,
        streakDays: 0,
        badges: {},
        hasChosenGoal: false,
      };
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({
          totalMl: 0,
          goalMl: store.goalMl,
          lastDate: today,
          todayGlasses: 0,
          lastAddAt: null,
          streakDays: 0,
          badges: {},
          hasChosenGoal: false,
        })
      );
    } else {
      // Mevcut kayıt
      const data = JSON.parse(raw);
      const normalized = {
        totalMl: data.totalMl ?? 0,
        goalMl: data.goalMl ?? store.goalMl,
        lastDate: data.lastDate ?? today,
        todayGlasses: data.todayGlasses ?? 0,
        lastAddAt: data.lastAddAt ?? null,
        streakDays: data.streakDays ?? 0,
        badges: data.badges ?? {},
        // Migration: hasChosenGoal yoksa ve hedef varsayılandan farklıysa true say
        hasChosenGoal:
          typeof data.hasChosenGoal === 'boolean'
            ? data.hasChosenGoal
            : (data.goalMl ?? store.goalMl) !== 2500,
      };

      if (normalized.lastDate !== today) {
        // Yeni gün: sadece günlük ilerlemeyi sıfırla; hedefi KORU
        const g = normalized.goalMl ?? store.goalMl ?? 0;
        const metGoalYesterday = g > 0 && (normalized.totalMl ?? 0) >= g;
        const newStreak = metGoalYesterday ? (normalized.streakDays ?? 0) + 1 : 0;

        store = {
          ...store,
          totalMl: 0,
          goalMl: normalized.goalMl,
          lastDate: today,
          isHydrated: true,
          todayGlasses: 0,
          lastAddAt: null,
          streakDays: newStreak,
          badges: normalized.badges,
          hasChosenGoal: normalized.hasChosenGoal,
        };

        await AsyncStorage.setItem(
          KEY,
          JSON.stringify({
            totalMl: 0,
            goalMl: store.goalMl,
            lastDate: today,
            todayGlasses: 0,
            lastAddAt: null,
            streakDays: newStreak,
            badges: store.badges,
            hasChosenGoal: store.hasChosenGoal,
          })
        );
      } else {
        store = { ...store, ...normalized, isHydrated: true };
      }
    }

    emit();
  } catch {}
}

export function useHydrationStore(selector) {
  const [snapshot, setSnapshot] = useState(store);

  useEffect(() => {
    const sub = (s) => setSnapshot(s);
    listeners.add(sub);
    if (!store.isHydrated) hydrate();
    return () => listeners.delete(sub);
  }, []);

  // Auto midnight reset (checks every 60s)
  useEffect(() => {
    const id = setInterval(async () => {
      const today = new Date().toDateString();
      if (today !== store.lastDate) {
        const g = store.goalMl ?? 0;
        const metGoalYesterday = g > 0 && (store.totalMl ?? 0) >= g;
        const newStreak = metGoalYesterday ? (store.streakDays ?? 0) + 1 : 0;

        // Yeni gün: yalnızca günlük veriler sıfırlanır
        store = {
          ...store,
          totalMl: 0,
          lastDate: today,
          todayGlasses: 0,
          lastAddAt: null,
          streakDays: newStreak,
          // goalMl ve hasChosenGoal aynen korunur
        };

        await persist();
        emit();
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // ---- Actions ----
  const add = async (ml) => {
    const nowIso = new Date().toISOString();
    const newTotal = (store.totalMl ?? 0) + ml;
    const newGlasses = (store.todayGlasses ?? 0) + 1;

    // Rozet kontrolü için mevcut bağlam
    const candidate = {
      totalMl: newTotal,
      goalMl: store.goalMl,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      streakDays: store.streakDays ?? 0,
      history: { firstAdd: (store.totalMl ?? 0) === 0 },
    };

    const newBadges = { ...(store.badges ?? {}) };
    BADGES.forEach((b) => {
      try {
        if (!newBadges[b.id] && typeof b.check === 'function' && b.check(candidate)) {
          newBadges[b.id] = true;
        }
      } catch {}
    });

    store = {
      ...store,
      totalMl: newTotal,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      badges: newBadges,
    };
    await persist();
    emit();
  };

  const updateGoal = async (ml) => {
    store = { ...store, goalMl: Number(ml), hasChosenGoal: true };
    await persist();
    emit();
  };

  // Backward compatibility alias
  const setGoalMl = updateGoal;

  const resetToday = async () => {
    const today = new Date().toDateString();
    store = {
      ...store,
      totalMl: 0,
      todayGlasses: 0,
      lastDate: today,
      lastAddAt: null,
      // goalMl ve hasChosenGoal değişmez
    };
    await persist();
    emit();
  };

  // Artık "Her Şeyi Sıfırla" hedefi bozmaz (isteğe bağlı: ayrı bir factory reset fonksiyonu yazılabilir)
  const resetAll = async () => {
    const today = new Date().toDateString();
    store = {
      ...store,
      totalMl: 0,
      // goalMl KORUNUR
      todayGlasses: 0,
      lastAddAt: null,
      streakDays: 0,
      badges: {},
      lastDate: today,
      // hasChosenGoal KORUNUR (tekrar hedef sormasın)
    };
    await persist();
    emit();
  };

  // ---- Derived ----
  const percent = snapshot.goalMl ? snapshot.totalMl / snapshot.goalMl : 0;
  const unlockedBadgeIds = Object.keys(snapshot.badges ?? {}).filter(
    (id) => !!snapshot.badges[id]
  );

  const api = {
    totalMl: snapshot.totalMl,
    goalMl: snapshot.goalMl,
    percent,
    todayGlasses: snapshot.todayGlasses ?? 0,
    lastAddAt: snapshot.lastAddAt ?? null,
    streakDays: snapshot.streakDays ?? 0,
    badges: snapshot.badges ?? {},
    hasChosenGoal: snapshot.hasChosenGoal ?? false,

    unlockedBadgeIds,
    hasBadge: (id) => !!(snapshot.badges && snapshot.badges[id]),

    add,
    updateGoal,
    setGoalMl,
    resetToday,
    resetAll,
  };

  return typeof selector === 'function' ? selector(api) : api;
}

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES } from '../constants/badges';

const KEY = 'SUMOLASI_STATE_V1';

// --- Simple pub/sub so all screens stay in sync ---
const listeners = new Set();
let store = {
  totalMl: 0,
  goalMl: 2500,
  lastDate: new Date().toDateString(),
  isHydrated: false,
  todayGlasses: 0,
  lastAddAt: null,
  streakDays: 0,
  badges: {}, // { [badgeId]: true }
};

const emit = () => listeners.forEach((l) => l(store));
const persist = async () => {
  const { totalMl, goalMl, lastDate, todayGlasses, lastAddAt, streakDays, badges } = store;
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ totalMl, goalMl, lastDate, todayGlasses, lastAddAt, streakDays, badges })
    );
  } catch {}
};

async function hydrate() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const today = new Date().toDateString();
    if (!raw) {
      store = { ...store, lastDate: today, isHydrated: true, todayGlasses: 0, lastAddAt: null, streakDays: 0, badges: {} };
      await AsyncStorage.setItem(
        KEY,
        JSON.stringify({ totalMl: 0, goalMl: store.goalMl, lastDate: today, todayGlasses: 0, lastAddAt: null, streakDays: 0, badges: {} })
      );
    } else {
      const data = JSON.parse(raw);
      const normalized = {
        totalMl: data.totalMl ?? 0,
        goalMl: data.goalMl ?? store.goalMl,
        lastDate: data.lastDate ?? today,
        todayGlasses: data.todayGlasses ?? 0,
        lastAddAt: data.lastAddAt ?? null,
        streakDays: data.streakDays ?? 0,
        badges: data.badges ?? {},
      };
      if (normalized.lastDate !== today) {
        // new day: reset daily totals; streak if yesterday had intake
        const newStreak = normalized.totalMl > 0 ? (normalized.streakDays ?? 0) + 1 : 0;
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
        const newStreak = store.totalMl > 0 ? (store.streakDays ?? 0) + 1 : 0;
        store = { ...store, totalMl: 0, lastDate: today, todayGlasses: 0, lastAddAt: null, streakDays: newStreak };
        await persist();
        emit();
      }
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const add = async (ml) => {
    const nowIso = new Date().toISOString();
    const newTotal = store.totalMl + ml;
    const newGlasses = (store.todayGlasses ?? 0) + 1;

    // Evaluate badges using current context
    const candidate = {
      totalMl: newTotal,
      goalMl: store.goalMl,
      todayGlasses: newGlasses,
      lastAddAt: nowIso,
      streakDays: store.streakDays ?? 0,
      history: { firstAdd: store.totalMl === 0 },
    };

    const newBadges = { ...(store.badges ?? {}) };
    BADGES.forEach((b) => {
      try {
        if (!newBadges[b.id] && typeof b.check === 'function' && b.check(candidate)) {
          newBadges[b.id] = true;
          // optional: console.log(`🎖️ Badge unlocked: ${b.title}`);
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
    store = { ...store, goalMl: Number(ml) };
    await persist();
    emit();
  };

  const resetToday = async () => {
    const today = new Date().toDateString();
    store = { ...store, totalMl: 0, todayGlasses: 0, lastDate: today, lastAddAt: null };
    await persist();
    emit();
  };

  const resetAll = async () => {
    const today = new Date().toDateString();
    store = {
      ...store,
      totalMl: 0,
      goalMl: 2500,
      todayGlasses: 0,
      lastAddAt: null,
      streakDays: 0,
      badges: {},
      lastDate: today,
    };
    await persist();
    emit();
  };

  const percent = snapshot.goalMl ? snapshot.totalMl / snapshot.goalMl : 0;
  // Derived: unlocked badge ids (array) for easier consumption in UI
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
    // Convenience getters for UI layers
    unlockedBadgeIds,
    hasBadge: (id) => !!(snapshot.badges && snapshot.badges[id]),
    add,
    updateGoal,
    setGoalMl: updateGoal, // backward compatibility alias
    resetToday,
    resetAll,
  };
  return typeof selector === 'function' ? selector(api) : api;
}
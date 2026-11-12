import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { i18n } from '../i18n';
import { ensureHydrated, rolloverIfNeeded, useHydrationStore } from './useHydrationStore';
import { ensureNotificationPermission, parseHHMM } from '../utils/reminders';
import { ensureReminderChannel, replaceNotificationGroup } from '../notifications/scheduler';

const KEY = 'SUMOLASI_HABITS_V1';
export const MAX_CUSTOM_HABITS = 5;
let store = { habits: [], completed: {}, isHydrated: false };
const listeners = new Set();
let active = false;
let hydratePromise = null;
let mutations = Promise.resolve();
const emit = () => listeners.forEach((listener) => listener(store));
const commit = async (next) => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ habits: next.habits, completed: next.completed }));
  store = next;
  emit();
};
const mutate = (work) => {
  const next = mutations.then(async () => { await ensureHabitsHydrated(); return work(); });
  mutations = next.catch(() => {});
  return next;
};
const validate = (habit) => {
  if (!habit.name?.trim() || !parseHHMM(habit.time, null)) throw new Error('invalid_habit');
  return { ...habit, name: habit.name.trim().slice(0, 40) };
};
async function scheduleHabit(habit, allowPrompt = false) {
  const permission = allowPrompt ? await ensureNotificationPermission() : (await Notifications.getPermissionsAsync()).status === 'granted';
  const enabled = active && permission;
  if (enabled) await ensureReminderChannel();
  const [hour, minute] = habit.time.split(':').map(Number);
  const requests = enabled ? [{
    content: {
      title: i18n.t('habits.reminderTitle', { name: habit.name }), body: i18n.t('habits.reminderBody'),
      sound: 'default', data: { type: 'CUSTOM_HABIT', habitId: habit.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute,
      ...(Platform.OS === 'android' ? { channelId: 'hydration-daily' } : {}) },
  }] : [];
  const notificationIds = await replaceNotificationGroup(`habit.${habit.id}`, requests, habit.notificationIds || []);
  return { ...habit, notificationIds };
}
const actions = {
  addHabit: (input) => mutate(async () => {
    if (store.habits.length >= MAX_CUSTOM_HABITS) throw new Error('habit_limit');
    const habit = validate({ ...input, id: `h${Date.now()}${Math.round(Math.random() * 1e6)}`, notificationIds: [] });
    const scheduled = await scheduleHabit(habit, true);
    await commit({ ...store, habits: [...store.habits, scheduled] });
    return scheduled;
  }),
  updateHabit: (id, patch) => mutate(async () => {
    const old = store.habits.find((habit) => habit.id === id);
    if (!old) return;
    const scheduled = await scheduleHabit(validate({ ...old, name: patch.name ?? old.name, time: patch.time ?? old.time }), true);
    await commit({ ...store, habits: store.habits.map((habit) => habit.id === id ? scheduled : habit) });
  }),
  removeHabit: (id) => mutate(async () => {
    const old = store.habits.find((habit) => habit.id === id);
    await replaceNotificationGroup(`habit.${id}`, [], old?.notificationIds || []);
    const completed = Object.fromEntries(Object.entries(store.completed).map(([day, ids]) => [day, ids.filter((x) => x !== id)]));
    await commit({ ...store, habits: store.habits.filter((habit) => habit.id !== id), completed });
  }),
  toggleHabit: (id, day) => mutate(async () => {
    if (!store.habits.some((habit) => habit.id === id)) return;
    await ensureHydrated();
    await rolloverIfNeeded();
    const key = day || useHydrationStore.getState().lastDate;
    const current = store.completed[key] || [];
    const ids = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const completed = Object.fromEntries(Object.entries({ ...store.completed, [key]: ids }).sort(([a], [b]) => b.localeCompare(a)).slice(0, 366));
    await commit({ ...store, completed });
  }),
  suspendAll: () => {
    active = false;
    return mutate(async () => {
      const habits = [];
      for (const habit of store.habits) {
        await replaceNotificationGroup(`habit.${habit.id}`, [], habit.notificationIds || []);
        habits.push({ ...habit, notificationIds: [] });
      }
      await commit({ ...store, habits });
    });
  },
  rescheduleAll: ({ activate } = {}) => {
    if (activate) active = true;
    return mutate(async () => {
      if (!active) return;
      // Commit each successful item so a later capacity error cannot lose its IDs.
      for (const habit of [...store.habits]) {
        const scheduled = await scheduleHabit(habit);
        await commit({ ...store, habits: store.habits.map((item) => item.id === habit.id ? scheduled : item) });
      }
    });
  },
};
export function ensureHabitsHydrated() {
  if (!hydratePromise) hydratePromise = (async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    store = { habits: Array.isArray(parsed.habits) ? parsed.habits : [], completed: parsed.completed || {}, isHydrated: true };
    emit();
  })().catch((error) => { hydratePromise = null; throw error; });
  return hydratePromise;
}
export function useHabitsStore(selector) {
  const [snapshot, setSnapshot] = useState(store);
  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(store);
    ensureHabitsHydrated().catch(() => {});
    return () => listeners.delete(setSnapshot);
  }, []);
  const api = { ...snapshot, ...actions };
  return typeof selector === 'function' ? selector(api) : api;
}
useHabitsStore.getState = () => ({ ...store, ...actions });

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureHydrated, rolloverIfNeeded, useHydrationStore } from './useHydrationStore';

const KEY = 'HYDROMATE_DAILY_ROUTINE_V1';
export const BREAKS = ['eyes', 'stretch', 'pause'];
export const CHALLENGES = { water: { target: 4 }, breaks: { target: 4 } };
let state = { breaks: {}, challenges: {}, hydrated: false };
let hydration;
let queue = Promise.resolve();
const listeners = new Set();
const publish = () => listeners.forEach((listener) => listener(state));
export function ensureDailyRoutineHydrated() {
  if (!hydration) hydration = (async () => {
    const raw = await AsyncStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : {};
    state = { breaks: saved.breaks || {}, challenges: saved.challenges || {}, hydrated: true };
    publish();
  })().catch((error) => { hydration = null; throw error; });
  return hydration;
}
const change = (update) => {
  const job = queue.then(async () => {
    await Promise.all([ensureDailyRoutineHydrated(), ensureHydrated()]);
    await rolloverIfNeeded();
    const next = update(state, useHydrationStore.getState().lastDate);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    publish();
  });
  queue = job.catch(() => {});
  return job;
};
export function challengeEnd(start) {
  const day = new Date(`${start}T12:00:00`);
  day.setDate(day.getDate() + 6);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
export function challengeProgress(kind, challenge, water, breaks, today) {
  if (!challenge) return { count: 0, complete: false, ended: false };
  const end = challengeEnd(challenge.start);
  const source = kind === 'water' ? water : breaks;
  const count = Object.entries(source).filter(([day, value]) => day >= challenge.start && day <= end &&
    (kind === 'water' ? value > 0 : value.length > 0)).length;
  return { count: Math.min(count, CHALLENGES[kind].target), complete: count >= CHALLENGES[kind].target, ended: today > end, end };
}
const actions = {
  toggleBreak: (id) => change((current, today) => {
    if (!BREAKS.includes(id)) throw new Error('invalid_break');
    const done = current.breaks[today] || [];
    const entries = { ...current.breaks, [today]: done.includes(id) ? done.filter((item) => item !== id) : [...done, id] };
    return { ...current, breaks: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => b.localeCompare(a)).slice(0, 366)) };
  }),
  startChallenge: (kind) => change((current, today) => {
    if (!CHALLENGES[kind]) throw new Error('invalid_challenge');
    const previous = current.challenges[kind];
    if (previous && challengeEnd(previous.start) >= today) return current;
    return { ...current, challenges: { ...current.challenges, [kind]: { start: today } } };
  }),
};
export function useDailyRoutineStore() {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    listeners.add(setSnapshot);
    setSnapshot(state);
    ensureDailyRoutineHydrated().catch(() => {});
    return () => listeners.delete(setSnapshot);
  }, []);
  return { ...snapshot, ...actions };
}

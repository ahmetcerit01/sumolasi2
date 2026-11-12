import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const KEY = 'HYDROMATE_NOTIFICATION_PLANS_V1';
const JOURNAL = 'HYDROMATE_NOTIFICATION_TRANSACTION_V1';
const PREFIX = 'hydromate.';
const LIMIT = 60; // Leave room for immediate notifications and system bookkeeping.
let queue = Promise.resolve();
let failures = {};
const listeners = new Set();
const setFailure = (owner, error) => {
  failures = { ...failures };
  if (error) failures[owner] = error.code || 'notification_error';
  else delete failures[owner];
  listeners.forEach((listener) => listener(failures));
};
export function useNotificationStatus() {
  const [snapshot, setSnapshot] = useState(failures);
  useEffect(() => { listeners.add(setSnapshot); setSnapshot(failures); return () => listeners.delete(setSnapshot); }, []);
  return Object.values(snapshot);
}
export function serializeNotificationWork(work) {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

async function recoverInterruptedTransaction() {
  const raw = await AsyncStorage.getItem(JOURNAL);
  if (!raw) return;
  const transaction = JSON.parse(raw);
  const plansRaw = await AsyncStorage.getItem(KEY);
  const plans = plansRaw ? JSON.parse(plansRaw) : {};
  // The plan was committed and only journal removal was interrupted.
  if (transaction.desired && JSON.stringify(transaction.previous) !== JSON.stringify(transaction.desired) && JSON.stringify(plans[transaction.owner]) === JSON.stringify(transaction.desired)) {
    await AsyncStorage.removeItem(JOURNAL);
    return;
  }
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of pending) {
    if (item.identifier.startsWith(`${PREFIX}${transaction.owner}.`)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }
  for (const request of transaction.previous || []) await Notifications.scheduleNotificationAsync(request);
  await AsyncStorage.removeItem(JOURNAL);
}

export const recoverNotificationPlans = () => serializeNotificationWork(async () => {
  try { await recoverInterruptedTransaction(); setFailure('recovery', null); }
  catch (error) { setFailure('recovery', error); throw error; }
});

export function replaceNotificationGroup(owner, requests, legacyIds = []) {
  return serializeNotificationWork(async () => {
    try { await recoverInterruptedTransaction(); setFailure('recovery', null); }
    catch (error) { setFailure('recovery', error); throw error; }
    const raw = await AsyncStorage.getItem(KEY);
    const plans = raw ? JSON.parse(raw) : {};
    const old = plans[owner] || [];
    const prefix = `${PREFIX}${owner}.`;
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const owned = pending.filter((item) => item.identifier.startsWith(prefix) || legacyIds.includes(item.identifier));
    const otherCount = pending.length - owned.length;
    if (Platform.OS === 'ios' && otherCount + requests.length > LIMIT) {
      const error = new Error('notification_capacity');
      error.code = 'notification_capacity';
      setFailure(owner, error);
      throw error;
    }
    const desired = requests.map((request, index) => ({ ...request, identifier: `${prefix}${index}` }));
    // Journal the prior managed plan before changing native requests.
    await AsyncStorage.setItem(JOURNAL, JSON.stringify({ owner, previous: old, desired }));
    const created = [];
    try {
      for (const item of owned) await Notifications.cancelScheduledNotificationAsync(item.identifier);
      for (const request of desired) {
        created.push(await Notifications.scheduleNotificationAsync(request));
      }
      await AsyncStorage.setItem(KEY, JSON.stringify({ ...plans, [owner]: desired }));
      await AsyncStorage.removeItem(JOURNAL).catch(() => {});
      setFailure(owner, null);
      return created;
    } catch (error) {
      setFailure(owner, error);
      for (const id of created) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      // Previously migrated plans have restorable trigger inputs; legacy requests
      // are recovered by their store on the next foreground reconciliation.
      let restored = true;
      for (const request of old) {
        try { await Notifications.scheduleNotificationAsync(request); } catch { restored = false; }
      }
      if (restored) await AsyncStorage.removeItem(JOURNAL).catch(() => {});
      throw error;
    }
  });
}

export async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('hydration-daily', {
    name: 'Daily reminders', importance: Notifications.AndroidImportance.HIGH,
    sound: 'default', vibrationPattern: [0, 250, 250, 250],
  });
}

export async function removeOrphanedNotificationGroups(validOwners) {
  const raw = await AsyncStorage.getItem(KEY);
  const plans = raw ? JSON.parse(raw) : {};
  for (const owner of Object.keys(plans)) {
    if ((owner.startsWith('med.') || owner.startsWith('habit.')) && !validOwners.includes(owner)) {
      await replaceNotificationGroup(owner, []);
    }
  }
}

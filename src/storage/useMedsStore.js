import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { i18n } from '../i18n';
import { dateKey } from './useHydrationStore';
import { ensureNotificationPermission } from '../utils/reminders';

// Vitamin & ilaç takibi.
// meds: [{ id, name, kind: 'vitamin' | 'pill', times: ['08:00', ...], notificationIds: [] }]
// log:  { 'YYYY-MM-DD': { '<medId>@<HH:MM>': ISO tarih } }  → o doz alındı
// Geçmiş 60 günle sınırlı tutulur.

const KEY = 'SUMOLASI_MEDS_V1';
export const MED_CATEGORY = 'MED_REMINDER';
export const MED_ACTION_TAKEN = 'TAKEN';
const LOG_DAYS = 60;

let store = { meds: [], log: {}, isHydrated: false };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l(store));
const persist = async () => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ meds: store.meds, log: store.log }));
  } catch {}
};
const commit = (next) => {
  store = next;
  emit();
  return persist();
};

const slot = (medId, time) => `${medId}@${time}`;
const sortTimes = (times) => [...new Set(times)].sort();

// Eski günleri at
const prunedLog = (log) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOG_DAYS);
  const min = dateKey(cutoff);
  return Object.fromEntries(Object.entries(log).filter(([d]) => d >= min));
};

// --- bildirimler ---
let categoryLocale = null;
export async function ensureMedCategory() {
  if (categoryLocale === i18n.locale) return;
  categoryLocale = i18n.locale;
  try {
    await Notifications.setNotificationCategoryAsync(MED_CATEGORY, [
      { identifier: MED_ACTION_TAKEN, buttonTitle: i18n.t('meds.takenAction'), options: { opensAppToForeground: true } },
    ]);
  } catch {}
}

async function cancelMedNotifications(med) {
  await Promise.all((med.notificationIds || []).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

async function scheduleMed(med) {
  await ensureMedCategory();
  const ids = [];
  for (const time of med.times) {
    const [hour, minute] = time.split(':').map(Number);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t('meds.notifTitle', { name: med.name }),
        body: i18n.t('meds.notifBody'),
        sound: 'default',
        categoryIdentifier: MED_CATEGORY,
        data: { type: 'MED', medId: med.id, time },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: 'hydration-daily' } : {}),
      },
    });
    ids.push(id);
  }
  return ids;
}

// İzin varsa bildirimleri kur; izin yoksa ilacı yine kaydet ama bildirimsiz
async function withSchedule(med) {
  await cancelMedNotifications(med);
  const granted = await ensureNotificationPermission().catch(() => false);
  const notificationIds = granted ? await scheduleMed(med) : [];
  return { ...med, notificationIds };
}

const actions = {
  addMed: async ({ name, kind = 'pill', times }) => {
    const med = { id: `m${Date.now()}${Math.round(Math.random() * 1e4)}`, name: name.trim(), kind, times: sortTimes(times), notificationIds: [] };
    const scheduled = await withSchedule(med);
    await commit({ ...store, meds: [...store.meds, scheduled] });
    return scheduled;
  },

  updateMed: async (id, patch) => {
    const old = store.meds.find((m) => m.id === id);
    if (!old) return;
    const next = { ...old, ...patch, name: (patch.name ?? old.name).trim(), times: sortTimes(patch.times ?? old.times) };
    const scheduled = await withSchedule(next);
    await commit({ ...store, meds: store.meds.map((m) => (m.id === id ? scheduled : m)) });
  },

  removeMed: async (id) => {
    const old = store.meds.find((m) => m.id === id);
    if (old) await cancelMedNotifications(old);
    await commit({ ...store, meds: store.meds.filter((m) => m.id !== id) });
  },

  // Alındı işaretini aç/kapat (bugün için)
  toggleTaken: async (medId, time, day = dateKey()) => {
    const dayLog = { ...(store.log[day] || {}) };
    const k = slot(medId, time);
    if (dayLog[k]) delete dayLog[k];
    else dayLog[k] = new Date().toISOString();
    await commit({ ...store, log: prunedLog({ ...store.log, [day]: dayLog }) });
  },

  // Bildirimdeki "Aldım" butonu: yalnızca işaretler, geri almaz
  markTaken: async (medId, time, day = dateKey()) => {
    const dayLog = { ...(store.log[day] || {}) };
    const k = slot(medId, time);
    if (dayLog[k]) return;
    dayLog[k] = new Date().toISOString();
    await commit({ ...store, log: prunedLog({ ...store.log, [day]: dayLog }) });
  },

  // Dil değişince bildirim metinleri yeni dile geçsin
  rescheduleAll: async () => {
    categoryLocale = null;
    const perm = await Notifications.getPermissionsAsync().catch(() => null);
    if (perm?.status !== 'granted') return;
    const meds = [];
    for (const m of store.meds) meds.push(await withSchedule(m));
    await commit({ ...store, meds });
  },
};

export const isTaken = (log, medId, time, day = dateKey()) => !!log?.[day]?.[slot(medId, time)];

// Bugünkü dozlar, saat sırasıyla: [{ med, time, taken }]
export const todayDoses = (meds, log, day = dateKey()) =>
  meds
    .flatMap((med) => med.times.map((time) => ({ med, time, taken: isTaken(log, med.id, time, day) })))
    .sort((a, b) => a.time.localeCompare(b.time));

// Son 7 gün için her günün durumu: 'all' | 'some' | 'none' | 'empty'
export const weekAdherence = (meds, log) => {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    const doses = todayDoses(meds, log, k);
    const taken = doses.filter((x) => x.taken).length;
    out.push({ day: k, dayIndex: d.getDay(), state: doses.length === 0 ? 'empty' : taken === doses.length ? 'all' : taken > 0 ? 'some' : 'none' });
  }
  return out;
};

let hydratePromise = null;
export const ensureMedsHydrated = () => {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        store = { meds: Array.isArray(parsed.meds) ? parsed.meds : [], log: parsed.log || {}, isHydrated: true };
      } catch {
        store = { ...store, isHydrated: true };
      }
      emit();
    })();
  }
  return hydratePromise;
};

export function useMedsStore(selector) {
  const [snapshot, setSnapshot] = useState(store);
  useEffect(() => {
    listeners.add(setSnapshot);
    if (snapshot !== store) setSnapshot(store);
    ensureMedsHydrated();
    return () => listeners.delete(setSnapshot);
  }, []);
  const api = { ...snapshot, ...actions };
  return typeof selector === 'function' ? selector(api) : api;
}

useMedsStore.getState = () => ({ ...store, ...actions });

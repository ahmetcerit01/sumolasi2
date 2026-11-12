import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '../i18n';
import { replaceNotificationGroup } from '../notifications/scheduler';
import { getShiftSchedule } from './shiftSchedule';

// Onboarding, Hatırlatıcılar ve Profil ekranı aynı planlama mantığını kullanır.
export const REMINDER_IDS_KEY = 'SUMOLASI_REMINDER_IDS_V1';
export const REMINDER_ENABLED_KEY = 'REMINDER_ENABLED';
export const REMINDER_INTERVAL_HOURS_KEY = 'REMINDER_INTERVAL_HOURS';
export const DEFAULT_INTERVAL_HOURS = 2;
const ANDROID_CHANNEL_ID = 'hydration-daily';


export const parseHHMM = (str, fallback) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return fallback;
  return { h, m };
};

// Uyanıştan bir aralık sonra başlayıp uykuya kadar giden tam günlük saat listesi.
// Gece yarısını geçen uyku saatleri (örn. 01:00) desteklenir.
export function computeReminderTimes(wakeAt, sleepAt, intervalHours) {
  const wake = parseHHMM(wakeAt, { h: 8, m: 0 });
  const sleep = parseHHMM(sleepAt, { h: 23, m: 0 });
  const intervalMin = Math.max(30, Math.round((Number.isFinite(Number(intervalHours)) && Number(intervalHours) > 0 ? Number(intervalHours) : DEFAULT_INTERVAL_HOURS) * 60));

  const start = wake.h * 60 + wake.m;
  let end = sleep.h * 60 + sleep.m;
  if (end <= start) end += 24 * 60;

  const times = [];
  for (let t = start + intervalMin; t <= end; t += intervalMin) {
    const minOfDay = t % (24 * 60);
    times.push({ hour: Math.floor(minOfDay / 60), minute: minOfDay % 60, dayOffset: Math.floor(t / (24 * 60)) });
  }
  return times;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: i18n.t('notifications.channelName'),
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {}
}

export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function cancelReminders() {
  const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  await replaceNotificationGroup('water', [], raw ? JSON.parse(raw) : []);
  await AsyncStorage.setItem(REMINDER_IDS_KEY, '[]');
}

export function computeScheduledReminderTimes(wakeAt, sleepAt, intervalHours) {
  return computeReminderTimes(wakeAt, sleepAt, intervalHours);
}

// Identical times on every weekday need only one repeating native request.
export function compactWeeklyTimes(times) {
  const groups = new Map();
  for (const time of times) {
    const key = `${time.hour}:${time.minute}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(time.weekday);
  }
  return [...groups].flatMap(([key, weekdays]) => {
    const [hour, minute] = key.split(':').map(Number);
    return weekdays.size === 7 ? [{ hour, minute }] : [...weekdays].map((weekday) => ({ hour, minute, weekday }));
  });
}

export async function scheduleReminders({ wakeAt, sleepAt, intervalHours = DEFAULT_INTERVAL_HOURS, weeklySchedule }) {
  const granted = await ensureNotificationPermission();
  if (!granted) return -1;

  await ensureAndroidChannel();

  const content = {
    title: i18n.t('notifications.title'),
    body: i18n.t('notifications.body'),
    sound: 'default',
    data: { type: 'WATER_REMINDER' },
  };

  const planned = [];
  if (weeklySchedule?.enabled && Array.isArray(weeklySchedule.week) && weeklySchedule.week.length === 7) {
    for (let day = 0; day < 7; day += 1) {
      const mode = weeklySchedule.week[day];
      const shift = weeklySchedule.shifts?.[mode];
      if (!shift) continue;
      const dayTimes = computeScheduledReminderTimes(shift.wakeAt, shift.sleepAt, intervalHours, day);
      for (const time of dayTimes) {
        planned.push({ ...time, weekday: ((day + (time.dayOffset || 0)) % 7) + 1, mode });
      }
    }
  } else {
    planned.push(...computeReminderTimes(wakeAt, sleepAt, intervalHours));
  }

  const slots = weeklySchedule?.enabled ? compactWeeklyTimes(planned) : planned;
  const requests = slots.map(({ hour, minute, weekday }) => ({
    content,
    trigger: {
      type: weekday ? Notifications.SchedulableTriggerInputTypes.WEEKLY : Notifications.SchedulableTriggerInputTypes.DAILY,
      hour, minute, ...(weekday ? { weekday } : {}),
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  }));
  const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
  const ids = await replaceNotificationGroup('water', requests, raw ? JSON.parse(raw) : []);

  await AsyncStorage.multiSet([
    [REMINDER_IDS_KEY, JSON.stringify(ids)],
    [REMINDER_ENABLED_KEY, '1'],
    [REMINDER_INTERVAL_HOURS_KEY, String(intervalHours)],
  ]);
  return ids.length;
}

export async function disableReminders() {
  await cancelReminders();
  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, '0');
}

export async function getReminderSettings() {
  const kv = await AsyncStorage.multiGet([REMINDER_ENABLED_KEY, REMINDER_INTERVAL_HOURS_KEY]);
  const enabledStr = kv[0][1];
  const intervalStr = kv[1][1];
  return {
    // Hiç kaydedilmemişse açık kabul edilir
    enabled: enabledStr !== '0',
    intervalHours: intervalStr ? Number(intervalStr) : DEFAULT_INTERVAL_HOURS,
  };
}

// Profil saatleri veya dil değişince, hatırlatıcılar açıksa aynı aralıkla yeniden kur.
export async function rescheduleIfEnabled({ wakeAt, sleepAt }) {
  const { enabled, intervalHours } = await getReminderSettings();
  if (!enabled) return 0;
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') return 0;
  const weeklySchedule = await getShiftSchedule();
  return scheduleReminders({ wakeAt, sleepAt, intervalHours, weeklySchedule });
}

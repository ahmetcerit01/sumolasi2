import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '../i18n';

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
  const intervalMin = Math.max(30, Math.round(intervalHours * 60));

  const start = wake.h * 60 + wake.m;
  let end = sleep.h * 60 + sleep.m;
  if (end <= start) end += 24 * 60;

  const times = [];
  for (let t = start + intervalMin; t <= end; t += intervalMin) {
    const minOfDay = t % (24 * 60);
    times.push({ hour: Math.floor(minOfDay / 60), minute: minOfDay % 60 });
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
  try {
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify([]));
  } catch {}
}

// Her saat için günlük tekrar eden bildirim kurar. Geçmiş saatler yarından itibaren çalışır.
// Dönen değer: planlanan bildirim sayısı; izin yoksa -1.
export async function scheduleReminders({ wakeAt, sleepAt, intervalHours = DEFAULT_INTERVAL_HOURS }) {
  const granted = await ensureNotificationPermission();
  if (!granted) return -1;

  await ensureAndroidChannel();
  await cancelReminders();

  const content = {
    title: i18n.t('notifications.title'),
    body: i18n.t('notifications.body'),
    sound: 'default',
    data: { type: 'WATER_REMINDER' },
  };

  const ids = [];
  for (const { hour, minute } of computeReminderTimes(wakeAt, sleepAt, intervalHours)) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    ids.push(id);
  }

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
  return scheduleReminders({ wakeAt, sleepAt, intervalHours });
}

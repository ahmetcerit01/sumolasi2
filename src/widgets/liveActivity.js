import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '../i18n';
import { useHydrationStore } from '../storage/useHydrationStore';
import { computeReminderTimes, getReminderSettings } from '../utils/reminders';

// Kilit ekranı / Dynamic Island canlı etkinliği (yalnızca iOS).
// - Ayar açıksa günün ilk eklemesiyle başlar, her eklemede güncellenir.
// - Hedef tamamlanınca kutlama hali 30 dk gösterilir, sonra kapanır; o gün yeniden açılmaz.
// - Gün değişince ya da ayar kapatılınca hemen kapanır.

// v2: kilit ekranında araç takımları öne çıktığı için Canlı Etkinlik herkes için bir kez kapatıldı (isteğe bağlı açılır)
export const LIVE_ACTIVITY_KEY = 'LIVE_ACTIVITY_ENABLED_V2';
const DONE_DAY_KEY = 'LIVE_ACTIVITY_DONE_DAY';
const CELEBRATE_MS = 30 * 60 * 1000;
const STALE_MS = 4 * 60 * 60 * 1000;

let WaterActivity = null;
let after = null;
if (Platform.OS === 'ios') {
  try {
    WaterActivity = require('./WaterActivity').default;
    after = require('expo-widgets').after;
  } catch (e) {
    console.warn('[live-activity] not available', e);
  }
}

export const isLiveActivitySupported = () => !!WaterActivity;

export async function getLiveActivityEnabled() {
  // Varsayılan kapalı: kilit ekranında kalıcı ilerleme için araç takımları önerilir; Canlı Etkinlik isteğe bağlı
  return (await AsyncStorage.getItem(LIVE_ACTIVITY_KEY)) === '1';
}

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

async function nextReminderText(profile) {
  const { enabled, intervalHours } = await getReminderSettings();
  if (!enabled) return '';
  const times = computeReminderTimes(profile?.wakeAt, profile?.sleepAt, intervalHours);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const next = times.find((x) => x.hour * 60 + x.minute > nowMin);
  return next ? `${pad(next.hour)}:${pad(next.minute)}` : '';
}

async function buildProps(s) {
  return {
    totalMl: s.totalMl || 0,
    goalMl: s.goalMl || 2500,
    next: await nextReminderText(s.profile),
    labels: {
      title: i18n.t('app.name'),
      pctPrefix: i18n.locale === 'tr',
      sep: i18n.locale === 'tr' ? '.' : ',',
      nextLabel: i18n.t('live.next'),
      doneLabel: i18n.t('live.done'),
    },
  };
}

const endAll = async (policy = 'immediate') => {
  if (!WaterActivity) return;
  for (const inst of WaterActivity.getInstances()) {
    try {
      await inst.end(policy);
    } catch {}
  }
};

let lastDate = null;

// Her store değişikliğinde (widgetSync kuyruğunda) çağrılır
export async function syncLiveActivity() {
  if (!WaterActivity) return;
  const s = useHydrationStore.getState();

  // Gün döndüyse dünün etkinliğini kapat
  if (lastDate && lastDate !== s.lastDate) await endAll();
  lastDate = s.lastDate;

  if (!(await getLiveActivityEnabled())) {
    await endAll();
    return;
  }

  const total = s.totalMl || 0;
  const goal = s.goalMl || 2500;
  const doneDay = await AsyncStorage.getItem(DONE_DAY_KEY);
  const instances = WaterActivity.getInstances();

  if (total <= 0) {
    await endAll(); // geri alma ile sıfıra indiyse
    return;
  }
  // Bugün hedef zaten kutlandı: bir daha açma
  if (doneDay === s.lastDate && instances.length === 0) return;

  const props = await buildProps(s);
  const stale = new Date(Date.now() + STALE_MS);

  if (instances.length === 0) {
    if (total >= goal) return; // tek eklemede hedefi aşınca yeni etkinlik açmaya gerek yok
    WaterActivity.start(props, 'sumolasi://add', stale);
    return;
  }

  const [current, ...extra] = instances;
  for (const e of extra) {
    try {
      await e.end('immediate');
    } catch {}
  }

  if (total >= goal) {
    await AsyncStorage.setItem(DONE_DAY_KEY, s.lastDate);
    await current.end(after(new Date(Date.now() + CELEBRATE_MS)), props, new Date());
  } else {
    await current.update(props, stale);
  }
}

export async function setLiveActivityEnabled(enabled) {
  await AsyncStorage.setItem(LIVE_ACTIVITY_KEY, enabled ? '1' : '0');
  if (enabled) await AsyncStorage.removeItem(DONE_DAY_KEY);
}

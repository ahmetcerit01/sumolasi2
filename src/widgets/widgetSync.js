import { AppState, Platform } from 'react-native';
import { i18n } from '../i18n';
import { subscribe, useHydrationStore } from '../storage/useHydrationStore';
import { syncLiveActivity } from './liveActivity';

// Uygulama <-> widget senkronu (yalnızca iOS).
// - Widget'taki butonlar uygulama kapalıyken bile toplamı artırır ve eklenenleri `pending` listesine yazar.
// - Uygulama açılınca / öne gelince / widget'a dokunulunca pending'i store'a aktarır,
//   ardından güncel durumu widget'a geri yazar.
// Her zaman önce çekip sonra yazıyoruz; böylece widget'tan eklenen miktar kaybolmaz.

const QUICK_AMOUNTS = [200, 300, 500];

let WaterWidget = null;
let widgetsModule = null;
if (Platform.OS === 'ios') {
  try {
    WaterWidget = require('./WaterWidget').default;
    widgetsModule = require('expo-widgets');
  } catch (e) {
    console.warn('[widget] not available', e);
  }
}

// Çağrıları sıraya koy: aynı anda iki senkron çalışıp birbirinin pending'ini ezmesin
let queue = Promise.resolve();
const enqueue = (job) => {
  queue = queue.then(job).catch((e) => console.warn('[widget] sync failed', e));
  return queue;
};

const currentEntryProps = async () => {
  const entries = await WaterWidget.getTimeline();
  if (!entries || entries.length === 0) return null;
  const now = Date.now();
  // Şu ana kadar başlamış en son giriş (snapshot tek giriş olduğundan genelde ilki)
  const started = entries.filter((e) => new Date(e.date).getTime() <= now);
  const entry = started.length ? started[started.length - 1] : entries[0];
  return entry?.props || null;
};

const pullPending = async () => {
  const props = await currentEntryProps();
  const pending = Array.isArray(props?.pending) ? props.pending : [];
  if (pending.length === 0) return 0;
  // Önce widget'taki listeyi boşalt (başka bir senkron aynı listeyi tekrar okumasın),
  // sonra uygula. Kimlikli kayıtlar store'da tekrar eklenmeye karşı da korunuyor.
  pushState();
  const { addFromWidget } = useHydrationStore.getState();
  for (const item of pending) {
    await addFromWidget(item?.ml, item?.d, item?.id);
  }
  return pending.length;
};

const pushState = () => {
  const s = useHydrationStore.getState();
  WaterWidget.updateSnapshot({
    date: s.lastDate,
    totalMl: s.totalMl || 0,
    goalMl: s.goalMl || 2500,
    pending: [],
    amounts: QUICK_AMOUNTS,
    sleepAt: s.profile?.sleepAt || '23:00',
    lastAddAt: s.lastAddAt || '', // native tarafa null gönderilemiyor
    labels: {
      title: i18n.t('app.name'),
      pctPrefix: i18n.locale === 'tr',
      sep: i18n.locale === 'tr' ? '.' : ',',
      moods: {
        thirsty: i18n.t('widget.moods.thirsty'),
        normal: i18n.t('widget.moods.normal'),
        happy: i18n.t('widget.moods.happy'),
        celebrate: i18n.t('widget.moods.celebrate'),
        sleepy: i18n.t('widget.moods.sleepy'),
      },
    },
  });
};

export const syncWidget = () => {
  if (!WaterWidget) return Promise.resolve();
  return enqueue(async () => {
    await pullPending();
    pushState();
    await syncLiveActivity();
  });
};

let started = false;
let lastSignature = '';

// App.js store yüklendikten sonra bir kez çağırır
export function startWidgetSync() {
  // Fast Refresh modülü yeniden yükleyince dinleyiciler ikinci kez kurulmasın
  if (!WaterWidget || started || globalThis.__waterWidgetSyncStarted) return;
  started = true;
  globalThis.__waterWidgetSyncStarted = true;

  syncWidget();

  // Store değişince (ekleme, hedef, gün devri) widget'ı güncelle; ilgisiz değişikliklerde yazma
  subscribe((s) => {
    const signature = `${s.lastDate}|${s.totalMl}|${s.goalMl}|${s.profile?.sleepAt}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    syncWidget();
  });

  // Uygulama arka plandayken widget'tan eklenenleri öne gelince al
  AppState.addEventListener('change', (st) => {
    if (st === 'active') syncWidget();
  });

  // Uygulama açıkken widget'a dokunulursa hemen al
  widgetsModule.addUserInteractionListener((event) => {
    if (event?.source === 'WaterWidget') syncWidget();
  });
}

// Dil değişince widget başlığı da değişsin
export const refreshWidgetLabels = () => syncWidget();

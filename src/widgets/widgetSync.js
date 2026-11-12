import { AppState, Platform } from 'react-native';
import { i18n } from '../i18n';
import { getCurrentWaterDateKey, subscribe, useHydrationStore } from '../storage/useHydrationStore';
import { syncLiveActivity } from './liveActivity';
import { getEffectiveShiftStart } from '../utils/shiftSchedule';
import { getQuickAdds, loadQuickAdds, quickLabel, subscribeQuickAdds } from '../storage/quickAdds';

// Uygulama <-> widget senkronu (yalnızca iOS).
// - Widget'taki butonlar uygulama kapalıyken bile toplamı artırır ve eklenenleri `pending` listesine yazar.
// - Uygulama açılınca / öne gelince / widget'a dokunulunca pending'i store'a aktarır,
//   ardından güncel durumu widget'a geri yazar.
// Her zaman önce çekip sonra yazıyoruz; böylece widget'tan eklenen miktar kaybolmaz.


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
  const accepted = new Set();
  const { addFromWidget } = useHydrationStore.getState();
  for (const item of pending) {
    const legacyEpoch = /^w(\d+)-/.exec(item?.id || '')?.[1];
    const at = item.at || (legacyEpoch ? new Date(Number(legacyEpoch)).toISOString() : null);
    const day = item.waterDayVersion === 1 ? item.d : at ? getCurrentWaterDateKey(new Date(at)) : item.d;
    await addFromWidget(item?.ml, day, item?.id, at);
    accepted.add(item.id);
  }
  // Acknowledge only after the store has durably saved the entry and its ID.
  const latest = await currentEntryProps();
  return (latest?.pending || []).filter((item) => !accepted.has(item.id));
};

// Widget'lar Premium'a özel: PremiumProvider durumu buraya bildirir
let premium = false;
export const setWidgetPremium = (on) => {
  if (premium === !!on) return;
  premium = !!on;
  syncWidget();
};

const pushState = (pending = []) => {
  const s = useHydrationStore.getState();
  const dayStartMinutes = Array.from({ length: 7 }, (_, weekday) => {
    const day = new Date();
    day.setDate(day.getDate() - day.getDay() + weekday);
    if (s.shiftSchedule?.enabled) {
      const start = getEffectiveShiftStart(s.shiftSchedule, day);
      return start.getHours() * 60 + start.getMinutes();
    }
    const [hour, minute] = (s.profile?.wakeAt || '08:00').split(':').map(Number);
    return hour * 60 + minute;
  });
  WaterWidget.updateSnapshot({
    premium,
    date: s.lastDate,
    totalMl: (s.totalMl || 0) + pending.filter((item) => item.d === s.lastDate).reduce((sum, item) => sum + (Number(item.ml) || 0), 0),
    dayStartMinutes,
    goalMl: s.goalMl || 2500,
    pending,
    amounts: getQuickAdds().map((q) => q.ml),
    quick: getQuickAdds().map((q) => ({ id: q.id, ml: q.ml })),
    sleepAt: s.profile?.sleepAt || '23:00',
    lastAddAt: s.lastAddAt || '', // native tarafa null gönderilemiyor
    labels: {
      title: i18n.t('app.name'),
      lockedTitle: i18n.t('widget.locked.title'),
      lockedBody: i18n.t('widget.locked.body'),
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

// "Widget'ı Düzenle" ekranındaki seçenekler: kullanıcının hızlı eklemeleri (adı ve güncel miktarıyla)
// ve sabit miktarlar. Değerler widget'taki pick() ile çözülür (q1..q3 / ml<miktar>).
const FIXED_AMOUNTS = [100, 150, 200, 250, 300, 330, 400, 500, 750, 1000];
let lastOptionsSignature = '';
const pushConfigurationOptions = () => {
  if (typeof WaterWidget.setConfigurationParameterEnum !== 'function') return;
  const t = (k) => i18n.t(k);
  const ml = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, i18n.locale === 'tr' ? '.' : ',')} ml`;
  const options = [
    ...getQuickAdds().map((q) => ({ name: `${quickLabel(q, t)} · ${ml(q.ml)}`, value: q.id, subtitle: t('quickAdd.widgetOption') })),
    ...FIXED_AMOUNTS.map((n) => ({ name: ml(n), value: `ml${n}`, subtitle: t('quickAdd.widgetAmount') })),
  ];
  const signature = JSON.stringify(options);
  if (signature === lastOptionsSignature) return;
  lastOptionsSignature = signature;
  for (const p of ['button1', 'button2', 'button3']) {
    try {
      WaterWidget.setConfigurationParameterEnum(p, options);
    } catch (e) {
      console.warn('[widget] options failed', e);
    }
  }
};

export const syncWidget = () => {
  if (!WaterWidget) return Promise.resolve();
  return enqueue(async () => {
    const pending = await pullPending();
    pushState(pending);
    pushConfigurationOptions();
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
  // Hızlı ekleme miktarları değişince widget butonları da değişsin
  loadQuickAdds().then(() => syncWidget());
  subscribeQuickAdds(() => syncWidget());

  // Store değişince (ekleme, hedef, gün devri) widget'ı güncelle; ilgisiz değişikliklerde yazma
  subscribe((s) => {
    const signature = JSON.stringify([s.lastDate, s.totalMl, s.goalMl, s.profile, s.shiftSchedule]);
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

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import MobileAds, { AdEventType, AdsConsent, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { IS_TEST_BUILD } from '../utils/env';

// Reklamlar (Google AdMob). Kurallar:
// - Premium kullanıcılar hiç reklam görmez.
// - İzinler (AB/İngiltere için Google rıza formu, ardından iOS izleme izni) ilk reklam anında
//   istenir; açılışta ya da onboarding sırasında asla.
// - Geçiş reklamı yalnızca doğal bir duraklamada ve en fazla INTERSTITIAL_GAP_MS'de bir.
// Reklam birim kimlikleri app.json → extra.ads. Geliştirme ve test derlemelerinde (IS_TEST_BUILD)
// her zaman Google'ın test reklamları kullanılır: kendi gerçek reklamına dokunmak AdMob hesabını riske atar.

const cfg = Constants.expoConfig?.extra?.ads || {};
const pick = (ios, android, test) => (Platform.OS === 'ios' ? ios : android) || test;
export const AD_UNITS = {
  banner: IS_TEST_BUILD ? TestIds.ADAPTIVE_BANNER : pick(cfg.iosBanner, cfg.androidBanner, TestIds.ADAPTIVE_BANNER),
  interstitial: IS_TEST_BUILD ? TestIds.INTERSTITIAL : pick(cfg.iosInterstitial, cfg.androidInterstitial, TestIds.INTERSTITIAL),
};

const INTERSTITIAL_GAP_MS = 3 * 60 * 60 * 1000; // 3 saat
const LAST_INTERSTITIAL_KEY = 'ADS_LAST_INTERSTITIAL_AT';

// Premium durumu bilinene kadar reklam yok (aboneler açılışta bir an bile reklam görmesin)
let premium = true;
let readyPromise = null;
let interstitial = null;
let interstitialLoaded = false;
const listeners = new Set();

// Onboarding'in bittiği oturumda reklam yok: kullanıcı ilk açılışta Premium önerisiyle
// rıza/izleme pencerelerini üst üste görmesin. Bir sonraki açılışta normale döner.
let quietSession = false;
export const quietAdsThisSession = () => {
  quietSession = true;
  listeners.forEach((l) => l());
};

export const setAdsPremium = (on) => {
  premium = !!on;
  listeners.forEach((l) => l());
};
export const adsAllowed = () => !premium && !quietSession;
export const subscribeAds = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Rıza + izleme izni + SDK başlatma (bir kez). Reklam istenemiyorsa false döner.
export function ensureAds() {
  if (premium || quietSession) return Promise.resolve(false);
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const consent = await AdsConsent.gatherConsent().catch(() => null);
        if (consent && consent.canRequestAds === false) return false;
        if (Platform.OS === 'ios') {
          const { status } = await getTrackingPermissionsAsync();
          if (status === 'undetermined') await requestTrackingPermissionsAsync().catch(() => {});
        }
        await MobileAds().initialize();
        preloadInterstitial();
        return true;
      } catch (e) {
        console.warn('Ads init failed', e);
        readyPromise = null; // bir sonraki denemede tekrar
        return false;
      }
    })();
  }
  return readyPromise;
}

function preloadInterstitial() {
  if (premium || interstitial) return;
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitial.load(); // bir sonrakine hazır ol
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
  });
  interstitial.load();
}

// Doğal bir duraklamada çağrılır (ör. Geçmiş ekranından çıkış). Sınır dolmadıysa gösterir.
export async function maybeShowInterstitial() {
  if (premium || quietSession) return false;
  const ok = await ensureAds();
  if (!ok || !interstitialLoaded || premium) return false;
  const last = Number(await AsyncStorage.getItem(LAST_INTERSTITIAL_KEY).catch(() => 0)) || 0;
  if (Date.now() - last < INTERSTITIAL_GAP_MS) return false;
  await AsyncStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now())).catch(() => {});
  interstitialLoaded = false;
  interstitial.show().catch(() => {});
  return true;
}

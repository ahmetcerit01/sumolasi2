import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { IS_TEST_BUILD } from '../utils/env';
import { getLocales } from 'expo-localization';

// Premium (abonelik) katmanı.
// - app.json → expo.extra.revenuecat.iosApiKey doluysa gerçek RevenueCat kullanılır.
// - Anahtar yoksa ve geliştirme sürümüyse SAHTE mod: planlanan fiyatlar gösterilir, "satın alma"
//   cihazda saklanır. Böylece paywall ve kilitli özellikler hesap açılmadan test edilebilir.
// - Anahtar yoksa ve mağaza sürümüyse Premium kapalı kalır (sahte mod asla mağazaya çıkmaz).

export const ENTITLEMENT_ID = 'premium';
const MOCK_KEY = 'PREMIUM_MOCK_ACTIVE';

const rcConfig = Constants.expoConfig?.extra?.revenuecat || {};
const API_KEY = Platform.OS === 'ios' ? rcConfig.iosApiKey : rcConfig.androidApiKey;
// EXPO_PUBLIC_MOCK_PREMIUM=1: yalnızca test derlemelerinde, RevenueCat kurulmadan Premium özelliklerini
// (widget'lar vb.) denemek için sahte Premium. Mağaza derlemesinde bu değişken verilmez.
const FORCE_MOCK = IS_TEST_BUILD && process.env.EXPO_PUBLIC_MOCK_PREMIUM === '1';
export const PREMIUM_MODE = FORCE_MOCK ? 'mock' : API_KEY ? 'revenuecat' : IS_TEST_BUILD ? 'mock' : 'off';

let Purchases = null;
if (PREMIUM_MODE === 'revenuecat') {
  try {
    Purchases = require('react-native-purchases').default;
  } catch (e) {
    console.warn('[premium] SDK not available', e);
  }
}

// Ekranların kullandığı sade paket biçimi (RevenueCat paketinden ya da sahte veriden üretilir)
// { id, kind: 'annual' | 'monthly', priceString, price, currencyCode, trialDays, raw }
const toPlan = (pkg, eligible = false) => {
  const p = pkg.product || {};
  const intro = p.introPrice;
  const trialDays =
    eligible && intro && intro.price === 0 && ['DAY', 'WEEK'].includes(intro.periodUnit)
      ? intro.periodUnit === 'WEEK'
        ? intro.periodNumberOfUnits * 7
        : intro.periodUnit === 'MONTH'
        ? intro.periodNumberOfUnits * 30
        : intro.periodNumberOfUnits
      : 0;
  return {
    id: pkg.identifier,
    kind: pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly',
    priceString: p.priceString,
    price: p.price,
    currencyCode: p.currencyCode,
    trialDays,
    raw: pkg,
  };
};

// Test modundaki fiyatlar. Gerçek fiyatlar App Store Connect'ten, kullanıcının App Store
// ülkesine göre gelir (StoreKit priceString); uygulama dilinden bağımsızdır.
// Planlanan fiyatlar: Türkiye 59,99 ₺ / 449,99 ₺, diğer ülkeler $2.99 / $19.99.
const MOCK_PRICES = {
  TRY: { monthly: 59.99, annual: 449.99 },
  USD: { monthly: 2.99, annual: 19.99 },
};
const mockPlans = () => {
  const loc = getLocales()[0] || {};
  const currency = loc.regionCode === 'TR' ? 'TRY' : 'USD';
  const fmt = (v) => {
    try {
      return new Intl.NumberFormat(loc.languageTag || 'en-US', { style: 'currency', currency }).format(v);
    } catch {
      return currency === 'TRY' ? `₺${String(v).replace('.', ',')}` : `$${v}`;
    }
  };
  const p = MOCK_PRICES[currency];
  return [
    { id: '$rc_annual', kind: 'annual', priceString: fmt(p.annual), price: p.annual, currencyCode: currency, trialDays: 7, raw: null },
    { id: '$rc_monthly', kind: 'monthly', priceString: fmt(p.monthly), price: p.monthly, currencyCode: currency, trialDays: 0, raw: null },
  ];
};

const PremiumContext = createContext({
  mode: PREMIUM_MODE,
  ready: false,
  isPremium: false,
  plans: [],
  purchase: async () => ({ ok: false }),
  restore: async () => false,
  setMockPremium: async () => {},
});

export function PremiumProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const applyInfo = useCallback((info) => {
    setIsPremium(!!info?.entitlements?.active?.[ENTITLEMENT_ID]);
    setReady(true);
  }, []);

  const loadPlans = useCallback(async () => {
    const offerings = await Purchases.getOfferings();
    const pkgs = [offerings?.current?.annual, offerings?.current?.monthly].filter(Boolean);
    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(pkgs.map((pkg) => pkg.product.identifier)).catch(() => ({}));
    setPlans(pkgs.map((pkg) => toPlan(pkg,
      eligibility[pkg.product.identifier]?.status === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE)));
  }, []);
  const refresh = useCallback(async () => {
    if (PREMIUM_MODE !== 'revenuecat' || !Purchases) return;
    setLoading(true);
    // An offering error must never revoke a successfully resolved subscription.
    await Promise.allSettled([Purchases.getCustomerInfo().then(applyInfo), loadPlans()]);
    setLoading(false);
  }, [applyInfo, loadPlans]);

  useEffect(() => {
    let cancelled = false;
    let listener;
    let foreground;
    (async () => {
      if (PREMIUM_MODE === 'revenuecat' && Purchases) {
        Purchases.configure({ apiKey: API_KEY });
        listener = (info) => { if (!cancelled) applyInfo(info); };
        Purchases.addCustomerInfoUpdateListener(listener);
        foreground = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
        await refresh();
      } else if (PREMIUM_MODE === 'mock') {
        const value = await AsyncStorage.getItem(MOCK_KEY);
        if (cancelled) return;
        setIsPremium(value === '1');
        setPlans(mockPlans());
        setReady(true);
      } else {
        setReady(true);
      }
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      foreground?.remove();
      if (listener) Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyInfo, refresh]);

  // Dönen değer: { ok, cancelled?, error? }
  const purchase = useCallback(
    async (plan) => {
      if (PREMIUM_MODE === 'mock') {
        await AsyncStorage.setItem(MOCK_KEY, '1');
        setIsPremium(true);
        return { ok: true };
      }
      if (PREMIUM_MODE !== 'revenuecat' || !Purchases || !plan?.raw) return { ok: false, error: 'unavailable' };
      try {
        const { customerInfo } = await Purchases.purchasePackage(plan.raw);
        applyInfo(customerInfo);
        return { ok: !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] };
      } catch (e) {
        if (e?.userCancelled || e?.code === Purchases.PURCHASES_ERROR_CODE?.PURCHASE_CANCELLED_ERROR) {
          return { ok: false, cancelled: true };
        }
        return { ok: false, error: e?.message || 'error' };
      }
    },
    [applyInfo]
  );

  // Dönen değer: geri yükleme sonrası Premium aktif mi
  const restore = useCallback(async () => {
    if (PREMIUM_MODE === 'mock') {
      const v = (await AsyncStorage.getItem(MOCK_KEY)) === '1';
      setIsPremium(v);
      return v;
    }
    if (PREMIUM_MODE !== 'revenuecat' || !Purchases) return false;
    const info = await Purchases.restorePurchases();
    applyInfo(info);
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  }, [applyInfo]);

  // Yalnızca geliştirme: sahte aboneliği aç/kapat
  const setMockPremium = useCallback(async (on) => {
    if (PREMIUM_MODE !== 'mock') return;
    await AsyncStorage.setItem(MOCK_KEY, on ? '1' : '0');
    setIsPremium(on);
  }, []);

  const value = useMemo(
    () => ({ mode: PREMIUM_MODE, ready, isPremium, plans, purchase, restore, setMockPremium, refresh, loading }),
    [ready, isPremium, plans, purchase, restore, setMockPremium, refresh, loading]
  );
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export const usePremium = () => useContext(PremiumContext);

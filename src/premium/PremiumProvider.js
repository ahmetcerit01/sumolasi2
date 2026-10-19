import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { IS_TEST_BUILD } from '../utils/env';

// Premium (abonelik) katmanı.
// - app.json → expo.extra.revenuecat.iosApiKey doluysa gerçek RevenueCat kullanılır.
// - Anahtar yoksa ve geliştirme sürümüyse SAHTE mod: planlanan fiyatlar gösterilir, "satın alma"
//   cihazda saklanır. Böylece paywall ve kilitli özellikler hesap açılmadan test edilebilir.
// - Anahtar yoksa ve mağaza sürümüyse Premium kapalı kalır (sahte mod asla mağazaya çıkmaz).

export const ENTITLEMENT_ID = 'premium';
const MOCK_KEY = 'PREMIUM_MOCK_ACTIVE';

const rcConfig = Constants.expoConfig?.extra?.revenuecat || {};
const API_KEY = Platform.OS === 'ios' ? rcConfig.iosApiKey : rcConfig.androidApiKey;
export const PREMIUM_MODE = API_KEY ? 'revenuecat' : IS_TEST_BUILD ? 'mock' : 'off';

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
const toPlan = (pkg) => {
  const p = pkg.product || {};
  const intro = p.introPrice;
  const trialDays =
    intro && intro.price === 0
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

const MOCK_PLANS = [
  { id: '$rc_annual', kind: 'annual', priceString: '₺299,99', price: 299.99, currencyCode: 'TRY', trialDays: 7, raw: null },
  { id: '$rc_monthly', kind: 'monthly', priceString: '₺49,99', price: 49.99, currencyCode: 'TRY', trialDays: 0, raw: null },
];

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

  const applyInfo = useCallback((info) => {
    setIsPremium(!!info?.entitlements?.active?.[ENTITLEMENT_ID]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (PREMIUM_MODE === 'revenuecat' && Purchases) {
          Purchases.configure({ apiKey: API_KEY });
          Purchases.addCustomerInfoUpdateListener(applyInfo);
          const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
          if (cancelled) return;
          applyInfo(info);
          const current = offerings?.current;
          const pkgs = [current?.annual, current?.monthly].filter(Boolean);
          setPlans(pkgs.map(toPlan));
        } else if (PREMIUM_MODE === 'mock') {
          const v = await AsyncStorage.getItem(MOCK_KEY);
          if (cancelled) return;
          setIsPremium(v === '1');
          setPlans(MOCK_PLANS);
        }
      } catch (e) {
        console.warn('[premium] init failed', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyInfo]);

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
    () => ({ mode: PREMIUM_MODE, ready, isPremium, plans, purchase, restore, setMockPremium }),
    [ready, isPremium, plans, purchase, restore, setMockPremium]
  );
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export const usePremium = () => useContext(PremiumContext);

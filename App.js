import React, { useEffect, useMemo, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, DeviceEventEmitter, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useTheme } from './src/theme/theme';
import { loadThemePref } from './src/theme/themePreference';

// Navigasyon ve Ekranlar
import BottomTabs from './src/navigation/BottomTabs';
import OnboardWizard from './src/screens/OnboardWizard';

// Yeni Splash Bileşeni
import AnimatedSplash from './src/components/AnimatedSplash';

// Yardımcılar
import { ensureHydrated, useHydrationStore } from './src/storage/useHydrationStore';
import { i18n, LanguageContext, LANGUAGE_KEY, normalizeLang, getDeviceLang } from './src/i18n';
import { rescheduleIfEnabled } from './src/utils/reminders';
import { startWidgetSync, refreshWidgetLabels, setWidgetPremium } from './src/widgets/widgetSync';
import { setAdsPremium } from './src/ads/ads';
import { PremiumProvider, usePremium } from './src/premium/PremiumProvider';
import { PaywallProvider, usePaywall } from './src/premium/Paywall';
import { ensureMedCategory, ensureMedsHydrated, MED_ACTION_TAKEN, useMedsStore } from './src/storage/useMedsStore';
import { navRef, navigateWhenReady } from './src/navigation/navRef';

// Vitamin/ilaç bildirimine yanıt: "Aldım" → işaretle, bildirime dokunma → Vitamin ekranını aç
const handleNotificationResponse = async (response) => {
  const data = response?.notification?.request?.content?.data;
  if (data?.type !== 'MED') return;
  // Aynı yanıt her açılışta tekrar gelebilir (getLastNotificationResponseAsync): bir kez işle
  const key = `${response.notification.request.identifier}|${response.notification.date}|${response.actionIdentifier}`;
  if ((await AsyncStorage.getItem('LAST_HANDLED_NOTIF_RESPONSE')) === key) return;
  await AsyncStorage.setItem('LAST_HANDLED_NOTIF_RESPONSE', key);
  await ensureMedsHydrated();
  if (response.actionIdentifier === MED_ACTION_TAKEN) {
    await useMedsStore.getState().markTaken(data.medId, data.time);
  }
  navigateWhenReady('Meds');
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false); // Veriler hazır mı?
  const [splashFinished, setSplashFinished] = useState(false); // Animasyon bitti mi?
  const [showOnboard, setShowOnboard] = useState(false); // Onboard gösterilecek mi?
  const [locale, setLocale] = useState(i18n.locale); // aktif dil
  const { c, dark } = useTheme();
  // Ekran geçişlerinde beyaz parlama olmasın: navigasyon zemini temadan
  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: c.bg, card: c.card, text: c.ink, primary: c.accent } };
  }, [dark, c]);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        // 0. Dil seçimi: kayıtlı seçim varsa o, yoksa cihaz dili
        const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
        const initialLang = savedLang ? normalizeLang(savedLang) : getDeviceLang();
        i18n.locale = initialLang;
        setLocale(initialLang);

        // 1. Store'u yükle (gün devri de burada yapılır)
        await ensureHydrated();
        // Widget'tan eklenenleri al ve widget'ı güncel duruma getir (iOS)
        startWidgetSync();
        ensureMedsHydrated();
        ensureMedCategory();

        // 2. Onboard Durumu Kontrolü
        // Bildirim izni artık açılışta değil, onboarding sonunda isteniyor.
        const hasOnboarded = await AsyncStorage.getItem('HAS_ONBOARDED');
        setShowOnboard(!hasOnboarded);
      } catch (e) {
        console.warn(e);
      } finally {
        // Hazırlık bitti
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Bildirim yanıtları (uygulama kapalıyken gelen dahil)
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((r) => r && handleNotificationResponse(r)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, []);

  // Onboard Test Tetikleyicisi (Geliştirici Ayarları için)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_ONBOARD', async () => {
      try {
        await AsyncStorage.removeItem('HAS_ONBOARDED');
        setShowOnboard(true);
      } catch {}
    });
    return () => sub.remove();
  }, []);

  // Geliştirici: yalnızca giriş hikâyesini önizle (kayıtlı veriye ve onboarding durumuna dokunmaz)
  const [introPreview, setIntroPreview] = useState(false);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('PREVIEW_INTRO', () => {
      setIntroPreview(true);
      setShowOnboard(true);
    });
    return () => sub.remove();
  }, []);

  // Onboarding çıkış geçişi başlayınca ana sayfa arkada kurulur; geçiş bitince katman kalkar
  const [leavingOnboard, setLeavingOnboard] = useState(false);
  const [afterOnboard, setAfterOnboard] = useState(null); // { preview } → Premium önerisi
  const handleOnboardDone = () => {
    setShowOnboard(false);
    setLeavingOnboard(false);
    setAfterOnboard({ preview: introPreview, at: Date.now() });
    setIntroPreview(false);
  };

  // Görünüm tercihi yüklenmeden splash çizilmesin (yanlış temada parlamasın)
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    loadThemePref().finally(() => setThemeReady(true));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <PremiumProvider>
      <LanguageContext.Provider
        value={useMemo(() => ({
          locale,
          t: (key, opts) => i18n.t(key, opts),
          setLanguage: async (lang) => {
            const next = normalizeLang(lang);
            i18n.locale = next;
            setLocale(next);
            await AsyncStorage.setItem(LANGUAGE_KEY, next);
            // Planlanmış bildirim metinleri yeni dile geçsin
            const { profile } = useHydrationStore.getState();
            rescheduleIfEnabled({ wakeAt: profile.wakeAt, sleepAt: profile.sleepAt }).catch(() => {});
            refreshWidgetLabels();
            useMedsStore.getState().rescheduleAll().catch(() => {});
          },
        }), [locale])}
      >
      <PaywallProvider>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar barStyle={c.statusBar} backgroundColor="transparent" translucent />

        {/* 
           Mantık: 
           1. Veriler hazır olduğunda (appIsReady) Ana Uygulama (Navigation) altta render edilir.
           2. AnimatedSplash en üstte (zIndex ile) durur ve animasyonunu yapar.
           3. Animasyon bitince (onAnimationFinish) splashFinished true olur ve Splash DOM'dan kalkar.
        */}

        {appIsReady && fontsLoaded && (
          <NavigationContainer theme={navTheme} ref={navRef}>
            {(!showOnboard || leavingOnboard) && <BottomTabs />}
          </NavigationContainer>
        )}

        {/* Onboarding ana sayfanın üstünde bir katman: çıkışta arkadaki ana sayfaya karışır */}
        {appIsReady && fontsLoaded && showOnboard && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <LanguageContext.Consumer>
              {({ t, locale, setLanguage }) => (
                <OnboardWizard
                  onDone={handleOnboardDone}
                  onLeaveStart={() => setLeavingOnboard(true)}
                  introActive={splashFinished}
                  preview={introPreview}
                  t={t}
                  locale={locale}
                  setLanguage={setLanguage}
                />
              )}
            </LanguageContext.Consumer>
          </View>
        )}

        <AfterOnboardOffer trigger={afterOnboard} />
        <PremiumEffects />

        {/* Fontlar yüklenene kadar yalnızca zemin (yerel splash ile aynı renk) görünür */}
        {!splashFinished && fontsLoaded && themeReady && (
          <AnimatedSplash 
            onAnimationFinish={() => setSplashFinished(true)} 
          />
        )}
        
      </View>
      </PaywallProvider>
      </LanguageContext.Provider>
      </PremiumProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Onboarding bitip ana sayfaya geçilince Premium önerisi (bir kez; Premium olanlara gösterilmez).
// Geliştirici önizlemesinde her seferinde gösterilir ve kayıt tutulmaz.
const OFFER_KEY = 'PAYWALL_SHOWN_AFTER_ONBOARD';
function AfterOnboardOffer({ trigger }) {
  const { open } = usePaywall();
  const { isPremium } = usePremium();
  useEffect(() => {
    if (!trigger || isPremium) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!trigger.preview) {
        if ((await AsyncStorage.getItem(OFFER_KEY)) === '1') return;
        await AsyncStorage.setItem(OFFER_KEY, '1');
      }
      if (!cancelled) open();
    }, 1100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trigger]);
  return null;
}

// Premium durumuna bağlı işler: widget kilidi ve vitamin/ilaç hatırlatmaları.
// Premium bilgisi yüklenmeden bir şey yapılmaz (aboneler bir an kilitli görmesin).
function PremiumEffects() {
  const { ready, isPremium } = usePremium();
  useEffect(() => {
    if (!ready) return;
    setWidgetPremium(isPremium);
    setAdsPremium(isPremium);
    (async () => {
      await ensureMedsHydrated();
      const meds = useMedsStore.getState();
      if (isPremium) await meds.rescheduleAll({ activate: true });
      else await meds.suspendAll();
    })().catch(() => {});
  }, [ready, isPremium]);
  return null;
}

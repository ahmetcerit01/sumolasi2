import React, { useEffect, useMemo, useState } from 'react';
import 'react-native-gesture-handler';
import { View, DeviceEventEmitter, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Navigasyon ve Ekranlar
import BottomTabs from './src/navigation/BottomTabs';
import OnboardWizard from './src/screens/OnboardWizard';

// Yeni Splash Bileşeni
import AnimatedSplash from './src/components/AnimatedSplash';

// Yardımcılar
import { ensureHydrated, useHydrationStore } from './src/storage/useHydrationStore';
import { i18n, LanguageContext, LANGUAGE_KEY, normalizeLang, getDeviceLang } from './src/i18n';
import { rescheduleIfEnabled } from './src/utils/reminders';

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

  // Onboard bittiğinde çağrılacak
  const handleOnboardDone = () => {
    setShowOnboard(false);
  };

  return (
    <SafeAreaProvider>
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
          },
        }), [locale])}
      >
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* 
           Mantık: 
           1. Veriler hazır olduğunda (appIsReady) Ana Uygulama (Navigation) altta render edilir.
           2. AnimatedSplash en üstte (zIndex ile) durur ve animasyonunu yapar.
           3. Animasyon bitince (onAnimationFinish) splashFinished true olur ve Splash DOM'dan kalkar.
        */}

        {appIsReady && (
          <NavigationContainer>
            {showOnboard ? (
              <LanguageContext.Consumer>
                {({ t, locale, setLanguage }) => (
                  <OnboardWizard
                    onDone={handleOnboardDone}
                    t={t}
                    locale={locale}
                    setLanguage={setLanguage}
                  />
                )}
              </LanguageContext.Consumer>
            ) : (
              <BottomTabs />
            )}
          </NavigationContainer>
        )}

        {!splashFinished && (
          <AnimatedSplash 
            onAnimationFinish={() => setSplashFinished(true)} 
          />
        )}
        
      </View>
      </LanguageContext.Provider>
    </SafeAreaProvider>
  );
}
import React, { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { View, Platform, AppState, DeviceEventEmitter, StatusBar } from 'react-native';
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
import { performRolloverIfNeeded } from './src/utils/rollover';
import { useHydrationStore } from './src/storage/useHydrationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false); // Veriler hazır mı?
  const [splashFinished, setSplashFinished] = useState(false); // Animasyon bitti mi?
  const [showOnboard, setShowOnboard] = useState(false); // Onboard gösterilecek mi?

  useEffect(() => {
    async function prepare() {
      try {
        // 1. iOS İzinleri
        if (Platform.OS === 'ios') {
          await Notifications.requestPermissionsAsync();
        }

        // 2. Android Kanalı
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('hydration-daily', {
            name: 'Water Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        // 3. Rollover (Gün Devri) Kontrolü
        await performRolloverIfNeeded();

        // 4. Onboard Durumu Kontrolü
        const hasOnboarded = await AsyncStorage.getItem('HAS_ONBOARDED');
        setShowOnboard(!hasOnboarded); // Eğer onboard yapılmadıysa göster

        // 5. Store'a Onboard Verilerini Yükle (Senkronizasyon)
        if (hasOnboarded) {
           const entries = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
           const profileStr = entries.find(x => x[0] === 'ONBOARD_PROFILE')?.[1];
           const goalStr = entries.find(x => x[0] === 'DAILY_GOAL_ML')?.[1];
           
           if (profileStr) {
             // Store'u güncelle (Arka planda)
             const profile = JSON.parse(profileStr);
             useHydrationStore.getState().updateProfile({
               weight: profile.weightKg,
               height: profile.heightCm,
               wakeAt: profile.wakeAt,
               sleepAt: profile.sleepAt,
               gender: profile.gender
             });
           }
           if (goalStr) {
             useHydrationStore.getState().setGoalMl(Number(goalStr));
           }
        }

      } catch (e) {
        console.warn(e);
      } finally {
        // Hazırlık bitti
        setAppIsReady(true);
      }
    }

    prepare();

    // App State Listener (Uygulama arkaplandan dönünce gün devri kontrolü)
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        performRolloverIfNeeded();
      }
    });

    return () => sub?.remove();
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
              <OnboardWizard onDone={handleOnboardDone} />
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
    </SafeAreaProvider>
  );
}
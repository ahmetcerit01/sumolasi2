// App.js
import React, { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { Platform, AppState, DeviceEventEmitter } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import BottomTabs from './src/navigation/BottomTabs';
// import OnboardScreen from './src/screens/OnBoardScreen';
import OnboardWizard from './src/screens/OnboardWizard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performRolloverIfNeeded } from './src/utils/rollover';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const FORCE_ONBOARD = false; // Test bitti: zorlamayı kapat

  useEffect(() => {
    // iOS izin
    (async () => {
      if (Platform.OS === 'ios') {
        await Notifications.requestPermissionsAsync();
      }
    })();

    // Android kanal
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('hydration-daily', {
        name: 'Water Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }).catch(() => {});
    }

    // İlk açılışta LAST_OPEN_DATE yoksa bugünü kaydet
(async () => {
  const today = new Date();
  const pad = n => (n < 10 ? `0${n}` : `${n}`);
  const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const last = await AsyncStorage.getItem('LAST_OPEN_DATE');
  if (!last) await AsyncStorage.setItem('LAST_OPEN_DATE', key);
})();

// --- Gün devri kontrolü ---
performRolloverIfNeeded();
const sub = AppState.addEventListener('change', (st) => {
  if (st === 'active') {
    performRolloverIfNeeded();
  }
});

// İlk açılış kontrolü (onboarding)
(async () => {
  try {
    const seen = await AsyncStorage.getItem('HAS_LAUNCHED');
    if (seen === null) {
      await AsyncStorage.setItem('HAS_LAUNCHED', 'true');
      setIsFirstLaunch(true);
    } else {
      setIsFirstLaunch(false);
    }
  } catch {
    setIsFirstLaunch(false);
  }
})();

// Onboarding tamamlandı mı?
(async () => {
  try {
    const done = await AsyncStorage.getItem('HAS_ONBOARDED');
    setHasOnboarded(!!done);
  } catch {
    setHasOnboarded(false);
  }
})();

return () => sub?.remove?.();

  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_ONBOARD', async () => {
      try {
        await AsyncStorage.removeItem('HAS_ONBOARDED');
      } catch {}
      console.log('[App] OPEN_ONBOARD received → opening onboarding');
      setHasOnboarded(false);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      if (hasOnboarded) {
        try {
          const entries = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
          const profileStr = entries.find(x => x[0] === 'ONBOARD_PROFILE')?.[1];
          const goalStr = entries.find(x => x[0] === 'DAILY_GOAL_ML')?.[1];
          const profile = profileStr ? JSON.parse(profileStr) : null;
          const dailyGoalMl = goalStr ? Number(goalStr) : null;
          console.log('[App] Loaded onboard data:', { profile, dailyGoalMl });
          // TODO: Burada global store'a aktarabilirsiniz, örn:
          // useHydrationStore.getState().setDailyGoalMl(dailyGoalMl);
          // useHydrationStore.getState().setWakeSleep(profile.wakeAt, profile.sleepAt);
        } catch (e) {
          console.warn('[App] Failed to load onboard data', e);
        }
      }
    })();
  }, [hasOnboarded]);

  if (isFirstLaunch === null || hasOnboarded === null) return null; // kısa yüklenme anı

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {(FORCE_ONBOARD || !hasOnboarded)
          ? <OnboardWizard onDone={() => { setIsFirstLaunch(false); setHasOnboarded(true); }} />
          : <BottomTabs />
        }
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// App.js
import React, { useEffect } from 'react';
import 'react-native-gesture-handler';
import { Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import BottomTabs from './src/navigation/BottomTabs';
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
return () => sub?.remove?.();

  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <BottomTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

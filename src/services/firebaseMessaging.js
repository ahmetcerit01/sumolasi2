import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getMessaging } from '@react-native-firebase/messaging';
import { getAnalytics } from '@react-native-firebase/analytics';
import { ensureNotificationPermission } from '../utils/reminders';
import { openStorePage } from './appUpdateChecker';

export const PUSH_TOPIC = 'hydromate_all';
const OPT_IN = 'HYDROMATE_ANNOUNCEMENTS_OPT_IN_V1';
const CLEANUP = 'HYDROMATE_PUSH_CLEANUP_V1';
let queue = Promise.resolve();
const enqueue = (job) => { const next = queue.then(job, job); queue = next.catch(() => {}); return next; };
const native = () => Platform.OS === 'ios' || Platform.OS === 'android';
export const getAnnouncementPreference = async () => (await AsyncStorage.getItem(OPT_IN)) === '1';

export function initializeFirebaseMessaging() {
  return enqueue(async () => {
    if (!native()) return null;
    const messaging = getMessaging();
    // Analytics configuration must not prevent opt-out token cleanup.
    await getAnalytics().setAnalyticsCollectionEnabled(false).catch(() => {});
    if (!(await getAnnouncementPreference())) {
      await messaging.setAutoInitEnabled(false);
      if ((await AsyncStorage.getItem(CLEANUP)) !== '1') {
        await messaging.unsubscribeFromTopic(PUSH_TOPIC);
        await messaging.unsubscribeFromTopic('su_dostu_all');
        await messaging.deleteToken();
        await AsyncStorage.setItem(CLEANUP, '1');
      }
      return null;
    }
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return null;
    await AsyncStorage.removeItem(CLEANUP);
    await messaging.setAutoInitEnabled(true);
    if (Platform.OS === 'ios') {
      await messaging.registerDeviceForRemoteMessages();
      // APNs registration can complete after registerDeviceForRemoteMessages resolves.
      // Retry briefly; foreground initialization will retry again if still unavailable.
      let apnsToken = await messaging.getAPNSToken();
      for (let attempt = 0; !apnsToken && attempt < 5; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        apnsToken = await messaging.getAPNSToken();
      }
      if (!apnsToken) throw new Error('apns_token_unavailable');
    }
    const token = await messaging.getToken();
    await messaging.subscribeToTopic(PUSH_TOPIC);
    return token;
  });
}

export async function setAnnouncementPreference(enabled) {
  if (enabled && !(await ensureNotificationPermission())) return false;
  await AsyncStorage.setItem(OPT_IN, enabled ? '1' : '0');
  await AsyncStorage.removeItem(CLEANUP);
  await initializeFirebaseMessaging();
  return enabled;
}

export function subscribeToForegroundMessages() {
  if (!native()) return () => {};
  const messaging = getMessaging();
  const unsubscribeMessage = messaging.onMessage(async (message) => {
    if (!(await getAnnouncementPreference())) return;
    const title = message.notification?.title || message.data?.title;
    const body = message.notification?.body || message.data?.body;
    if (!title && !body) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: title || 'Hydromate', body: body || '', sound: 'default', data: message.data || {} },
      trigger: null,
    }).catch(() => {});
  });
  const unsubscribeToken = messaging.onTokenRefresh(() => { initializeFirebaseMessaging().catch(() => {}); });
  // Uygulama arka plandayken / kapalıyken gelen push'a dokunma.
  const handleOpened = (message) => {
    if (message?.data?.type === 'APP_UPDATE') openStorePage(message.data.url);
  };
  const unsubscribeOpened = messaging.onNotificationOpenedApp(handleOpened);
  messaging.getInitialNotification().then(handleOpened).catch(() => {});
  return () => { unsubscribeMessage(); unsubscribeToken(); unsubscribeOpened(); };
}

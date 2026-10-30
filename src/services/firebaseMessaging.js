import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  AuthorizationStatus,
  getMessaging,
} from '@react-native-firebase/messaging';
import { getAnalytics } from '@react-native-firebase/analytics';

export const PUSH_TOPIC = 'hydromate_all';

let initialized = false;
let initializationPromise = null;
let cachedToken = null;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function canUseNativeMessaging() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function getFcmTokenWithRetry() {
  // Keep the classic FCM token flow enabled explicitly. It works with both
  // development and App Store APNs environments and is what Firebase Console
  // topic delivery uses for this app.
  const messagingInstance = getMessaging();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = await messagingInstance.getToken().catch(() => null);
    if (token) return token;
    await wait(1000);
  }
  return null;
}

export async function initializeFirebaseMessaging() {
  if (!canUseNativeMessaging()) return null;
  if (initialized) return cachedToken;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      // Expo Notifications and Firebase Messaging share the iOS permission,
      // but explicitly asking here makes the first-run flow reliable.
      await Notifications.requestPermissionsAsync().catch(() => null);

      // Remote Config uses the Analytics native dependency, but this app does not
      // collect analytics events. Keep collection disabled explicitly.
      await getAnalytics().setAnalyticsCollectionEnabled(false).catch(() => {});
      const messagingInstance = getMessaging();

      const permission = await messagingInstance.requestPermission({
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      });
      const authorized =
        permission === AuthorizationStatus.AUTHORIZED ||
        permission === AuthorizationStatus.PROVISIONAL;
      if (!authorized) {
        console.warn('[FirebaseMessaging] notification permission not authorized', permission);
        return null;
      }

      await messagingInstance.setAutoInitEnabled(true).catch(() => {});
      await messagingInstance.registerDeviceForRemoteMessages().catch(() => {});

      // iOS can expose the APNs token a moment after registration. FCM topic
      // subscription is unreliable if we race that registration on first launch.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const apnsToken = await messagingInstance.getAPNSToken().catch(() => null);
        if (apnsToken) {
          console.log('[FirebaseMessaging] APNs token ready');
          break;
        }
        await wait(500);
      }

      const token = await getFcmTokenWithRetry();
      if (!token) throw new Error('FCM token unavailable');
      let subscribed = false;
      for (let attempt = 0; attempt < 4 && !subscribed; attempt += 1) {
        subscribed = await messagingInstance.subscribeToTopic(PUSH_TOPIC).then(() => true).catch(() => false);
        if (!subscribed) await wait(1000);
      }
      if (!subscribed) throw new Error(`Topic subscription failed: ${PUSH_TOPIC}`);
      console.log(`[FirebaseMessaging] subscribed to ${PUSH_TOPIC}`);
      cachedToken = token;
      initialized = true;
      return cachedToken;
    } catch (error) {
      console.warn('[FirebaseMessaging] initialization failed', error);
      return null;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

export function subscribeToForegroundMessages() {
  if (!canUseNativeMessaging()) return () => {};

  const messagingInstance = getMessaging();
  if (typeof messagingInstance.onMessage !== 'function') {
    console.warn('[FirebaseMessaging] foreground message listener unavailable');
    return () => {};
  }
  const unsubscribeMessage = messagingInstance.onMessage(async (remoteMessage) => {
    const title = remoteMessage?.notification?.title || remoteMessage?.data?.title;
    const body = remoteMessage?.notification?.body || remoteMessage?.data?.body;
    if (!title && !body) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'Su Dostu',
        body: body || '',
        data: remoteMessage?.data || {},
        sound: 'default',
      },
      trigger: null,
    }).catch(() => {});
  });

  // APNs/FCM tokens can rotate. Re-subscribe automatically so the topic does
  // not silently lose a device after reinstall, restore, or token refresh.
  // Re-subscribe when the FCM token rotates.
  let unsubscribeToken = () => {};
  try {
    const resubscribe = () => messagingInstance.subscribeToTopic(PUSH_TOPIC).catch(() => {});
    unsubscribeToken = messagingInstance.onTokenRefresh(resubscribe);
  } catch (error) {
    console.warn('[FirebaseMessaging] token refresh listener unavailable', error);
  }

  return () => {
    unsubscribeMessage();
    unsubscribeToken();
  };
}

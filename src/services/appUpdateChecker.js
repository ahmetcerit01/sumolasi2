import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import remoteConfig from '@react-native-firebase/remote-config';
import * as Application from 'expo-application';

const SHOWN_VERSION_KEY = 'HYDROMATE_UPDATE_PROMPT_VERSION';

const DEFAULTS = {
  latest_version: '1.0.1',
  minimum_version: '1.0.0',
  ios_url: '',
  android_url: '',
  update_message_tr: 'Su Dostu için yeni bir sürüm hazır.',
  update_message_en: 'A new version of Hydromate is available.',
};

function versionParts(version) {
  return String(version || '0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0);
  }
  return 0;
}

function storeUrl(values) {
  const configured = Platform.OS === 'ios' ? values.ios_url : values.android_url;
  if (configured) return configured;
  if (Platform.OS === 'android') return 'market://details?id=com.farukoz.hydromate';
  return '';
}

export async function checkForAppUpdate({ locale = 'tr' } = {}) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

  const currentVersion = Application.nativeApplicationVersion || '1.0.0';
  const config = remoteConfig();
  await config.setDefaults(DEFAULTS);
  await config.setConfigSettings({
    minimumFetchIntervalMillis: __DEV__ ? 0 : 6 * 60 * 60 * 1000,
    fetchTimeoutMillis: 10 * 1000,
  });
  await config.fetchAndActivate();

  const latestVersion = config.getValue('latest_version').asString() || DEFAULTS.latest_version;
  const minimumVersion = config.getValue('minimum_version').asString() || DEFAULTS.minimum_version;
  const updateUrl = storeUrl({
    ios_url: config.getValue('ios_url').asString(),
    android_url: config.getValue('android_url').asString(),
  });
  if (compareVersions(currentVersion, latestVersion) >= 0) return;

  const forced = compareVersions(currentVersion, minimumVersion) < 0;
  const shownFor = await AsyncStorage.getItem(SHOWN_VERSION_KEY);
  if (!forced && shownFor === latestVersion) return;
  if (!forced) await AsyncStorage.setItem(SHOWN_VERSION_KEY, latestVersion);

  const message = locale === 'en'
    ? config.getValue('update_message_en').asString()
    : config.getValue('update_message_tr').asString();
  const actions = [];
  if (!forced) actions.push({ text: locale === 'en' ? 'Later' : 'Daha sonra', style: 'cancel' });
  if (updateUrl) {
    actions.push({
      text: locale === 'en' ? 'Update' : 'Güncelle',
      onPress: () => Linking.openURL(updateUrl).catch(() => {}),
    });
  }
  if (actions.length) {
    Alert.alert(
      locale === 'en' ? 'Update available' : 'Güncelleme hazır',
      message || (locale === 'en' ? 'Please update the app.' : 'Lütfen uygulamayı güncelle.'),
      actions,
    );
  }
}

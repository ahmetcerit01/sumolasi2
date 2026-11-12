import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAndActivate, getRemoteConfig, getValue } from '@react-native-firebase/remote-config';
import * as Application from 'expo-application';

const SHOWN_VERSION_KEY = 'HYDROMATE_UPDATE_PROMPT_VERSION';
export const IOS_STORE_URL = 'https://apps.apple.com/app/id6824668841';
export const ANDROID_STORE_URL = 'market://details?id=com.farukoz.hydromate';
let alertOpen = false;

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
  return Platform.OS === 'android' ? ANDROID_STORE_URL : IOS_STORE_URL;
}

// Push bildirimine dokunulunca ya da uyarıdaki "Güncelle" ile mağaza sayfasını açar.
let lastOpenAt = 0;
export function openStorePage(url) {
  // Aynı dokunuş hem Firebase hem expo-notifications dinleyicisinden gelebilir.
  if (Date.now() - lastOpenAt < 3000) return Promise.resolve();
  lastOpenAt = Date.now();
  return Linking.openURL(url || (Platform.OS === 'android' ? ANDROID_STORE_URL : IOS_STORE_URL)).catch(() => {});
}

export async function checkForAppUpdate({ locale = 'tr' } = {}) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (alertOpen) return;

  const currentVersion = Application.nativeApplicationVersion || '1.0.0';
  // @react-native-firebase v22+ modüler API: remoteConfig() / setDefaults() artık yok.
  const config = getRemoteConfig();
  config.defaultConfig = DEFAULTS;
  config.settings = {
    minimumFetchIntervalMillis: __DEV__ ? 0 : 6 * 60 * 60 * 1000,
    fetchTimeoutMillis: 10 * 1000,
  };
  // Ağ/Firebase hatasında kontrolü bırakma: son çekilen (ya da varsayılan) değerlerle devam et.
  // fetchAndActivate bazı durumlarda zaman aşımına uğramadan asılı kalabildiği için süre sınırı var.
  await Promise.race([
    fetchAndActivate(config),
    new Promise((resolve) => setTimeout(resolve, 12 * 1000)),
  ]).catch(() => {});

  const latestVersion = getValue(config, 'latest_version').asString() || DEFAULTS.latest_version;
  const minimumVersion = getValue(config, 'minimum_version').asString() || DEFAULTS.minimum_version;
  const updateUrl = storeUrl({
    ios_url: getValue(config, 'ios_url').asString(),
    android_url: getValue(config, 'android_url').asString(),
  });
  if (compareVersions(currentVersion, latestVersion) >= 0) return;

  const forced = compareVersions(currentVersion, minimumVersion) < 0;
  const shownFor = await AsyncStorage.getItem(SHOWN_VERSION_KEY);
  if (!forced && shownFor === latestVersion) return;
  if (!forced) await AsyncStorage.setItem(SHOWN_VERSION_KEY, latestVersion);

  const message = locale === 'en'
    ? getValue(config, 'update_message_en').asString()
    : getValue(config, 'update_message_tr').asString();
  const actions = [];
  if (!forced) actions.push({ text: locale === 'en' ? 'Later' : 'Daha sonra', style: 'cancel', onPress: () => { alertOpen = false; } });
  if (updateUrl) {
    actions.push({
      text: locale === 'en' ? 'Update' : 'Güncelle',
      onPress: () => { alertOpen = false; openStorePage(updateUrl); },
    });
  }
  if (actions.length) {
    alertOpen = true;
    Alert.alert(
      locale === 'en' ? 'Update available' : 'Güncelleme hazır',
      message || (locale === 'en' ? 'Please update the app.' : 'Lütfen uygulamayı güncelle.'),
      actions,
      { cancelable: !forced, onDismiss: () => { alertOpen = false; } },
    );
  }
}

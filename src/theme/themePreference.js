import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Görünüm tercihi: 'system' (telefonu takip et) | 'light' | 'dark'.
// Appearance.setColorScheme uygulama genelinde geçerlidir: useColorScheme(), saat seçici
// ve durum çubuğu gibi yerel parçalar da seçime uyar.

export const THEME_PREF_KEY = 'THEME_PREF';
const listeners = new Set();
let current = 'system';

const apply = (pref) => {
  Appearance.setColorScheme(pref === 'system' ? 'auto' : pref);
};

export async function loadThemePref() {
  try {
    const saved = await AsyncStorage.getItem(THEME_PREF_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') current = saved;
  } catch {}
  apply(current);
  return current;
}

export async function setThemePref(pref) {
  current = pref;
  apply(pref);
  listeners.forEach((l) => l(pref));
  await AsyncStorage.setItem(THEME_PREF_KEY, pref).catch(() => {});
}

export function useThemePref() {
  const [pref, setPref] = useState(current);
  useEffect(() => {
    listeners.add(setPref);
    return () => listeners.delete(setPref);
  }, []);
  return pref;
}

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ana sayfadaki 3 hızlı ekleme butonu (widget'taki butonlar da bunları kullanır).
// Kullanıcı Profil'den miktarını, simgesini ve adını değiştirebilir (ör. "Suluk 450 ml").
// name boşsa simgenin varsayılan adı gösterilir.

const KEY = 'QUICK_ADDS_V1';
export const QUICK_ICONS = ['cup', 'mug', 'bottle', 'flask'];
export const QUICK_MIN = 50;
export const QUICK_MAX = 2000;

const DEFAULTS = [
  { id: 'q1', icon: 'cup', ml: 200, name: '' },
  { id: 'q2', icon: 'mug', ml: 300, name: '' },
  { id: 'q3', icon: 'bottle', ml: 500, name: '' },
];

let current = DEFAULTS;
let loaded = false;
const listeners = new Set();

const sanitize = (list) =>
  DEFAULTS.map((d, i) => {
    const it = (Array.isArray(list) && list[i]) || d;
    const ml = Math.round(Number(it.ml));
    return {
      id: d.id,
      icon: QUICK_ICONS.includes(it.icon) ? it.icon : d.icon,
      ml: Number.isFinite(ml) ? Math.min(QUICK_MAX, Math.max(QUICK_MIN, ml)) : d.ml,
      name: typeof it.name === 'string' ? it.name.slice(0, 18) : '',
    };
  });

export async function loadQuickAdds() {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = sanitize(JSON.parse(raw));
  } catch {}
  loaded = true;
  listeners.forEach((l) => l(current));
  return current;
}

export const getQuickAdds = () => current;

export async function updateQuickAdd(index, patch) {
  const next = current.slice();
  next[index] = { ...next[index], ...patch };
  current = sanitize(next);
  listeners.forEach((l) => l(current));
  await AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export function subscribeQuickAdds(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useQuickAdds() {
  const [list, setList] = useState(current);
  useEffect(() => {
    const off = subscribeQuickAdds(setList);
    loadQuickAdds().then(setList);
    return off;
  }, []);
  return list;
}

// Görünen ad: kullanıcının verdiği ad ya da simgenin dildeki adı
export const quickLabel = (item, t) => item.name || t(`quickAdd.icons.${item.icon}`);

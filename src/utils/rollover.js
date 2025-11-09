import AsyncStorage from '@react-native-async-storage/async-storage';

const pad = n => (n < 10 ? `0${n}` : `${n}`);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Uygulama açıldığında veya öne geldiğinde çağır.
 * Eğer kaydedilmiş son gün bugünden farklıysa:
 *  - dünkü toplamı Geçmiş'e ekler
 *  - bugünkü sayacı sıfırlar
 *  - LAST_OPEN_DATE'i bugüne çeker
 */
export async function performRolloverIfNeeded() {
  const today = todayKey();
  const [[, last], [, todayConsumedStr], [, historyStr]] = await AsyncStorage.multiGet([
    'LAST_OPEN_DATE',
    'TODAY_CONSUMED_ML',
    'HYDRATION_HISTORY_JSON',
  ]);

  const lastOpen = last || today;
  if (lastOpen === today) return;

  const yConsumed = Number(todayConsumedStr || 0);
  const yDate = lastOpen;

  let history = [];
  try { history = JSON.parse(historyStr || '[]'); } catch {}
  const exists = history.some(it => it?.date === yDate);
  if (!exists && yConsumed > 0) {
    history.push({ date: yDate, totalMl: yConsumed });
  }

  await AsyncStorage.multiSet([
    ['HYDRATION_HISTORY_JSON', JSON.stringify(history)],
    ['TODAY_CONSUMED_ML', '0'],
    ['LAST_OPEN_DATE', today],
  ]);
}

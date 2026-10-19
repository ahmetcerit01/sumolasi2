// Test derlemesi: geliştirme sürümü ya da EXPO_PUBLIC_TEST_BUILD=1 ile derlenmiş (Metro'suz) cihaz sürümü.
// Test paneli ve sahte Premium yalnızca bu durumda açılır; mağaza derlemelerinde bu değişken verilmez.
export const IS_TEST_BUILD = __DEV__ || process.env.EXPO_PUBLIC_TEST_BUILD === '1';

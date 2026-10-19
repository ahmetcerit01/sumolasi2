import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useTheme } from '../theme/theme';
import { AD_UNITS, adsAllowed, ensureAds, subscribeAds } from './ads';

// Küçük, ekranın akışına oturan banner. Premium'da ya da reklam istenemiyorsa hiç yer kaplamaz.
export default function AdBanner({ style }) {
  const { c, radius } = useTheme();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(adsAllowed());

  useEffect(() => subscribeAds(() => setAllowed(adsAllowed())), []);
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    ensureAds().then((ok) => alive && setReady(ok));
    return () => {
      alive = false;
    };
  }, [allowed]);

  if (!allowed || !ready) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: c.card, borderRadius: radius.card }, style]}>
      <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', overflow: 'hidden', paddingVertical: 6 },
});

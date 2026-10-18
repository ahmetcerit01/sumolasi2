import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Text, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import ParticleMorph from '../animation/ParticleMorph';
import { SCENE } from '../animation/particleScenes';
import { useTheme } from '../theme/theme';
import { i18n } from '../i18n';

// Açılış: dağınık ışık tozu tek bir sütunda toplanır, iki tüpe ayrılıp "mola" (duraklat ‖) simgesini
// oluşturur, tüpler alttan suyla dolar, ardından marka yazısı gelir.
// Zemin temadan gelir (yerel splash ile aynı renk), böylece geçişte parlama olmaz.

const ENTRY_MS = 1300;

export default function AnimatedSplash({ onAnimationFinish }) {
  const { c, type, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(reduceMotion ? 0 : 10)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const R = Math.min(width, height) * 0.27;
  const cy = height * 0.44;

  useEffect(() => {
    // Hareketi Azalt: sabit simge, kısa bekleme
    const textDelay = reduceMotion ? 250 : 1750;
    const hold = reduceMotion ? 900 : 1100;
    const anim = Animated.sequence([
      Animated.delay(textDelay),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(hold),
      Animated.timing(containerOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) onAnimationFinish?.();
    });
    return () => anim.stop();
  }, []);

  return (
    <Animated.View style={[styles.container, { backgroundColor: c.bg, opacity: containerOpacity }]} pointerEvents="none">
      <View style={StyleSheet.absoluteFill}>
        <ParticleMorph
          width={width}
          height={height}
          centerX={width / 2}
          centerY={cy}
          radius={R}
          scene={SCENE.TUBES}
          colors={c}
          dark={dark}
          reduceMotion={reduceMotion}
          entryMs={ENTRY_MS}
          count={560}
        />
      </View>

      <Animated.View style={[styles.textWrap, { top: cy + R * 0.95, opacity: textOpacity, transform: [{ translateY: textY }] }]}>
        <Text style={[type.title, styles.brand, { color: c.accentInk }]}>{i18n.t('app.name')}</Text>
        <Text style={[type.body, styles.tagline, { color: c.ink2 }]}>{i18n.t('app.tagline')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Tam ekran kapla. (RN 0.88'de StyleSheet.absoluteFillObject kaldırıldı; yayılınca hiçbir şey
    // eklemiyordu ve splash uygulamanın altına normal blok olarak yerleşip ekranı ikiye bölüyordu.)
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999, // En üstte
  },
  textWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  brand: { fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  tagline: { fontSize: 16, marginTop: 4, textAlign: 'center' },
});

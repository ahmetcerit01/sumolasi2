import React, { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Damla maskotu: Blender'da üretilen 3B karakterin ruh hali görselleri
// (docs/damla-3d/damla_moods.py → assets/mascot). Widget aynı görselleri kullanır.
// mood: thirsty | normal | happy | celebrate | sleepy

const IMAGES = {
  thirsty: require('../../assets/mascot/damla_thirsty.png'),
  normal: require('../../assets/mascot/damla_normal.png'),
  happy: require('../../assets/mascot/damla_happy.png'),
  celebrate: require('../../assets/mascot/damla_celebrate.png'),
  sleepy: require('../../assets/mascot/damla_sleepy.png'),
};

export function moodFor({ totalMl = 0, goalMl = 2500, sleepAt, lastAddAt, now = new Date() }) {
  const pct = totalMl / Math.max(goalMl, 1);
  if (pct >= 1) return 'celebrate';
  // Uyku saatinden sonra (gece yarısını geçen uyku saatleri dahil) uykulu
  if (sleepAt) {
    const [h, m] = String(sleepAt).split(':').map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const sleepMin = h * 60 + (m || 0);
    const late = sleepMin >= 12 * 60 ? nowMin >= sleepMin || nowMin < 5 * 60 : nowMin >= sleepMin && nowMin < 5 * 60;
    if (late) return 'sleepy';
  }
  const hoursSince = lastAddAt ? (now - new Date(lastAddAt)) / 3600000 : Infinity;
  if (pct < 0.25 || hoursSince >= 3) return 'thirsty';
  if (pct >= 0.75) return 'happy';
  return 'normal';
}

// Hafif "nefes": uykuluyken yavaş, kutlarken zıplayarak. Hareketi Azalt açıksa durağan.
export default function Mascot({ mood = 'normal', size = 120, style, accessibilityLabel }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const half = mood === 'sleepy' ? 2200 : mood === 'celebrate' ? 420 : 1500;
    t.value = 0;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: half, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [mood, reduceMotion]);

  const anim = useAnimatedStyle(() => {
    const lift = mood === 'celebrate' ? 0.06 : 0.015;
    return {
      transform: [{ translateY: -t.value * size * lift }, { scaleX: 1 + t.value * 0.012 }, { scaleY: 1 + t.value * 0.025 }],
    };
  });

  return (
    <Animated.View
      style={[{ width: size, height: size }, anim, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      <Image source={IMAGES[mood] || IMAGES.normal} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

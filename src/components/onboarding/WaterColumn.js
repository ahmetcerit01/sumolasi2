import React, { useEffect } from 'react';
import { Canvas, LinearGradient, Path, useClock, usePathValue, vec } from '@shopify/react-native-skia';
import { useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

// Ekranın altından yükselen soluk su sütunu. level (0..1) değiştikçe yaylı şekilde yükselir/alçalır,
// her değişimde yüzey hafifçe çalkalanır. Kilo/boy adımında hedefin değişimini hissettirir.
// props: width, height, level, colors (tema)

export default function WaterColumn({ width, height, level = 0.3, colors: c }) {
  const clock = useClock();
  const lv = useSharedValue(0);
  const slosh = useSharedValue(4);

  useEffect(() => {
    lv.value = withSpring(level, { damping: 16, stiffness: 60 });
    slosh.value = withSequence(withTiming(9, { duration: 140 }), withTiming(4, { duration: 1100 }));
  }, [level]);

  const surface = (phase, k) =>
    usePathValue((b) => {
      'worklet';
      const t = clock.value / 1000;
      const top = height - lv.value * height;
      const amp = slosh.value * k;
      for (let x = 0; x <= width + 8; x += 8) {
        const y = top + amp * Math.sin(x * 0.018 + t * 1.4 + phase) + amp * 0.5 * Math.sin(x * 0.041 - t * 2 + phase);
        if (x === 0) b.moveTo(0, y);
        else b.lineTo(x, y);
      }
      b.lineTo(width, height);
      b.lineTo(0, height);
      b.close();
    });
  const back = surface(2.1, 0.8);
  const front = surface(0, 1);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Path path={back} color={c.waterTop} opacity={0.08} />
      <Path path={front} opacity={0.16}>
        <LinearGradient start={vec(0, height * 0.4)} end={vec(0, height)} colors={[c.waterTop, c.waterDeep]} />
      </Path>
    </Canvas>
  );
}

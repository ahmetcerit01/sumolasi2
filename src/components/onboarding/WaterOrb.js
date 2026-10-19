import React, { useEffect, useMemo } from 'react';
import { Canvas, Circle, Group, LinearGradient, Path, RadialGradient, Skia, useClock, usePathValue, vec } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

// Su küresi: cam bir kürenin içinde dalgalanan su. progress (0..1) değişince seviye yumuşakça yükselir.
// Onboarding'in hesaplama/final adımında hedefin "dolduğunu" gösterir.
// props: size, progress, colors (tema), duration (ms)

export default function WaterOrb({ size = 220, progress = 0, colors: c, duration = 1600 }) {
  const S = size;
  const R = S / 2 - 3;
  const clock = useClock();
  const level = useSharedValue(0);

  useEffect(() => {
    level.value = withTiming(Math.max(0, Math.min(1, progress)), { duration, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const sphere = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.addCircle(S / 2, S / 2, R);
    return p.build();
  }, [S, R]);

  const wave = (phase, ampK, lift) =>
    usePathValue((b) => {
      'worklet';
      const t = clock.value / 1000;
      const top = S / 2 + R - level.value * 2 * R - lift;
      // seviye dolarken dalga biraz büyür, durunca sakinleşir
      const amp = (4 + 5 * Math.sin(Math.PI * Math.min(1, level.value))) * ampK;
      for (let x = 0; x <= S + 6; x += 6) {
        const y = top + amp * Math.sin(x * 0.04 + t * 2.2 + phase) + amp * 0.4 * Math.sin(x * 0.09 - t * 3 + phase);
        if (x === 0) b.moveTo(0, y);
        else b.lineTo(x, y);
      }
      b.lineTo(S, S + 4);
      b.lineTo(0, S + 4);
      b.close();
    });
  const back = wave(1.7, 0.8, 4);
  const front = wave(0, 1, 0);

  return (
    <Canvas style={{ width: S, height: S }}>
      {/* cam küre */}
      <Circle cx={S / 2} cy={S / 2} r={R} color={c.glass} />
      <Group clip={sphere}>
        <Path path={back} color={c.waterTop} opacity={0.5} />
        <Path path={front}>
          <LinearGradient start={vec(0, S * 0.2)} end={vec(0, S)} colors={[c.waterTop, c.water, c.waterDeep]} />
        </Path>
        {/* iç gölge: kürenin kenarları biraz koyu, ortası aydınlık */}
        <Circle cx={S / 2} cy={S / 2} r={R}>
          <RadialGradient c={vec(S * 0.42, S * 0.38)} r={R * 1.05} colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(0,30,60,0.18)']} />
        </Circle>
      </Group>
      <Circle cx={S / 2} cy={S / 2} r={R} color={c.glassEdge} style="stroke" strokeWidth={2} />
      {/* parlama */}
      <Circle cx={S * 0.33} cy={S * 0.28} r={S * 0.07} color="rgba(255,255,255,0.45)" />
      <Circle cx={S * 0.25} cy={S * 0.4} r={S * 0.025} color="rgba(255,255,255,0.35)" />
    </Canvas>
  );
}

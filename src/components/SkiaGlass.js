import React, { useEffect, useMemo } from 'react';
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RoundedRect,
  Skia,
  useClock,
  usePathValue,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Accelerometer } from 'expo-sensors';

// Fizikli su bardağı (Skia).
// - Su yüzeyi her karede yeniden çizilen iki katmanlı dalga.
// - Telefon eğilince yüzey yerçekimine göre yatay kalır (ivmeölçer), yaylı geçişle çalkalanır.
// - Su eklenince yukarıdan damla düşer, yüzeye değince halka yayılır ve dalga kabarır.
// - Su içinde kabarcıklar yükselir.
//
// props: width, height, progress (0..1+), addSignal (her eklemede artan sayı), colors (tema)

const MAX_FILL = 0.9; // tam dolu bardakta ağızda boşluk kalsın
const TILT_LIMIT = 0.42;

export default function SkiaGlass({ width = 236, height = 300, progress = 0, addSignal = 0, colors }) {
  const W = width;
  const H = height;
  const inset = W * 0.1; // bardağın alta doğru daralması

  // Bardak gövdesi (alt köşeleri yuvarlatılmış yamuk)
  const glassPath = useMemo(() => {
    const r = 18;
    const p = Skia.PathBuilder.Make();
    p.moveTo(2, 0);
    p.lineTo(W - 2, 0);
    p.lineTo(W - inset, H - r);
    p.quadTo(W - inset - 1, H, W - inset - r, H);
    p.lineTo(inset + r, H);
    p.quadTo(inset + 1, H, inset, H - r);
    p.close();
    return p.build();
  }, [W, H, inset]);

  // Damla şekli (0,0 merkezli), Group transform ile taşınır
  const dropShape = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(0, -11);
    p.cubicTo(5, -4, 8, 1, 8, 5);
    p.cubicTo(8, 10, 4, 13, 0, 13);
    p.cubicTo(-4, 13, -8, 10, -8, 5);
    p.cubicTo(-8, 1, -5, -4, 0, -11);
    p.close();
    return p.build();
  }, []);

  const clock = useClock();
  const level = useSharedValue(Math.min(progress, 1) * MAX_FILL);
  const tilt = useSharedValue(0);
  const slosh = useSharedValue(3); // dalga genliği
  const dropY = useSharedValue(-40);
  const dropOpacity = useSharedValue(0);
  const ripple = useSharedValue(0);
  const rippleOpacity = useSharedValue(0);

  // Seviye: yaylı yükselme
  useEffect(() => {
    level.value = withSpring(Math.min(Math.max(progress, 0), 1) * MAX_FILL, { damping: 14, stiffness: 70 });
  }, [progress]);

  // Su ekleme animasyonu: damla düşer → halka + çalkalanma
  useEffect(() => {
    if (!addSignal) return;
    const surface = H - level.value * H;
    dropOpacity.value = 1;
    dropY.value = -16;
    dropY.value = withTiming(Math.max(surface, 20), { duration: 420, easing: Easing.in(Easing.quad) }, (done) => {
      if (!done) return;
      dropOpacity.value = withTiming(0, { duration: 80 });
      ripple.value = 0;
      rippleOpacity.value = 0.7;
      ripple.value = withTiming(W * 0.38, { duration: 650, easing: Easing.out(Easing.cubic) });
      rippleOpacity.value = withTiming(0, { duration: 650 });
      slosh.value = withSequence(withTiming(11, { duration: 120 }), withTiming(3, { duration: 1400, easing: Easing.out(Easing.quad) }));
      tilt.value = withSequence(withTiming(tilt.value + 0.08, { duration: 120 }), withSpring(tilt.value, { damping: 4, stiffness: 60 }));
    });
  }, [addSignal]);

  // Telefon eğimi: su yüzeyi yerçekimine dik kalır
  useEffect(() => {
    let sub;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok) return;
        Accelerometer.setUpdateInterval(50);
        sub = Accelerometer.addListener(({ x }) => {
          const target = Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, -x));
          tilt.value = withSpring(target, { damping: 6, stiffness: 40, mass: 1.2 });
        });
      })
      .catch(() => {});
    return () => sub?.remove();
  }, []);

  // Su gövdesi: dalgalı üst kenar + bardağın tabanı
  const waterPath = usePathValue((b) => {
    'worklet';
    const t = clock.value / 1000;
    const surface = H - level.value * H;
    const amp = level.value > 0.01 ? slosh.value : 0;
    const step = 6;
    for (let x = 0; x <= W + step; x += step) {
      const y =
        surface +
        tilt.value * (x - W / 2) +
        amp * Math.sin(x * 0.045 + t * 2.4) +
        amp * 0.45 * Math.sin(x * 0.11 - t * 3.1);
      if (x === 0) b.moveTo(0, y);
      else b.lineTo(x, y);
    }
    b.lineTo(W, H + 4);
    b.lineTo(0, H + 4);
    b.close();
  });

  // Arka dalga: daha açık renk, faz kaydırılmış (derinlik hissi)
  const backWave = usePathValue((b) => {
    'worklet';
    const t = clock.value / 1000;
    const surface = H - level.value * H - 3;
    const amp = level.value > 0.01 ? slosh.value * 0.8 : 0;
    const step = 6;
    for (let x = 0; x <= W + step; x += step) {
      const y = surface + tilt.value * (x - W / 2) + amp * Math.sin(x * 0.05 - t * 1.9 + 1.7);
      if (x === 0) b.moveTo(0, y);
      else b.lineTo(x, y);
    }
    b.lineTo(W, H + 4);
    b.lineTo(0, H + 4);
    b.close();
  });

  // Kabarcıklar: alttan yüzeye doğru döngüyle yükselir (hook'lar her render'da aynı sırayla çağrılır)
  const bubble = (fx, speed, offset, r) => ({
    cx: useDerivedValue(() => fx * W + 3 * Math.sin(clock.value / 600 + offset * 6)),
    cy: useDerivedValue(() => {
      const fill = Math.max(level.value * H, 1);
      const travel = ((clock.value / 1000) * speed + offset * fill) % fill;
      return H - 8 - travel;
    }),
    r,
  });
  const b1 = bubble(0.22, 22, 0.1, 3.5);
  const b2 = bubble(0.48, 16, 0.55, 2.5);
  const b3 = bubble(0.66, 26, 0.3, 3);
  const b4 = bubble(0.8, 19, 0.8, 2);

  const dropTransform = useDerivedValue(() => [{ translateX: W / 2 }, { translateY: dropY.value }]);
  const rippleY = useDerivedValue(() => H - level.value * H);

  const c = colors;

  return (
    <Canvas style={{ width: W, height: H + 2 }}>
      {/* cam */}
      <Path path={glassPath} color={c.glass} />

      <Group clip={glassPath}>
        <Path path={backWave} color={c.waterTop} opacity={0.55} />
        <Path path={waterPath}>
          <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={[c.waterTop, c.water, c.waterDeep]} />
        </Path>
        <Group clip={waterPath}>
          {[b1, b2, b3, b4].map((b, i) => (
            <Circle key={i} cx={b.cx} cy={b.cy} r={b.r} color="rgba(255,255,255,0.55)" style="stroke" strokeWidth={1.6} />
          ))}
        </Group>
        <Circle cx={W / 2} cy={rippleY} r={ripple} color="#FFFFFF" opacity={rippleOpacity} style="stroke" strokeWidth={2} />
      </Group>

      {/* düşen damla */}
      <Group transform={dropTransform} opacity={dropOpacity}>
        <Path path={dropShape} color={c.waterDeep} />
      </Group>

      {/* cam kenarı ve parlama */}
      <Path path={glassPath} color={c.glassEdge} style="stroke" strokeWidth={2} />
      <Group transform={[{ translateX: W * 0.14 }, { translateY: 18 }, { rotate: -0.12 }]}>
        <RoundedRect x={0} y={0} width={9} height={H * 0.62} r={5} color="rgba(255,255,255,0.5)" />
      </Group>
    </Canvas>
  );
}

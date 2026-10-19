import React, { useEffect } from 'react';
import { Canvas, Circle, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Easing, interpolateColor, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

// Saate göre canlı gökyüzü: gece lacivert, şafakta pembe-turuncu, gündüz mavi, akşam gün batımı.
// Güneş gündüz yayın üstünde yürür; gece yerini aya bırakır. Üst kenar tema arka planına karışır
// (üstteki yazılar düz zeminde kalsın diye gökyüzü aşağıdan yükselir).
// props: width, height, minutes (gün içindeki dakika, 0..1439), bg (tema arka planı), opacity

// [saat, üst renk, alt renk]
const KEYS = [
  [0, '#0B1530', '#1B2A4E'],
  [4.5, '#151F45', '#2E3366'],
  [6, '#4B3F78', '#E58F7A'],
  [7.5, '#F2A07B', '#FBD8A8'],
  [9.5, '#5DB4F0', '#C4E6FB'],
  [16, '#4AA6EA', '#BFE1F8'],
  [18.5, '#E27A5C', '#F7C58C'],
  [20, '#3B3468', '#93608A'],
  [22, '#0F1B3C', '#22305A'],
  [24, '#0B1530', '#1B2A4E'],
];
const HOURS = KEYS.map((k) => k[0]);
const TOPS = KEYS.map((k) => k[1]);
const BOTS = KEYS.map((k) => k[2]);

const pick = (h, list) => {
  'worklet';
  let i = 0;
  while (i < HOURS.length - 2 && h >= HOURS[i + 1]) i++;
  const f = (h - HOURS[i]) / (HOURS[i + 1] - HOURS[i]);
  return interpolateColor(f, [0, 1], [list[i], list[i + 1]]);
};

export default function SkyBackdrop({ width, height, minutes, bg, opacity = 1 }) {
  const m = useSharedValue(minutes);
  useEffect(() => {
    m.value = withTiming(minutes, { duration: 900, easing: Easing.inOut(Easing.cubic) });
  }, [minutes]);

  const colors = useDerivedValue(() => {
    const h = ((m.value / 60) % 24 + 24) % 24;
    return [bg, pick(h, TOPS), pick(h, BOTS)];
  });

  // Güneş 06–19 arası yayda yürür; ay 19–06 arası. Ufuk çizgisinin altına inince görünmez olur.
  const arc = (from, to) => {
    'worklet';
    const h = ((m.value / 60) % 24 + 24) % 24;
    let span = to - from;
    if (span <= 0) span += 24;
    let p = h - from;
    if (p < 0) p += 24;
    return p / span; // 0..1 içi görünür
  };
  const horizon = height * 0.92;
  const sunP = useDerivedValue(() => arc(6, 19));
  const moonP = useDerivedValue(() => arc(19, 6));
  const pos = (pv) => ({
    cx: useDerivedValue(() => width * (0.1 + 0.8 * Math.min(1, Math.max(0, pv.value)))),
    cy: useDerivedValue(() => {
      const p = pv.value;
      if (p < 0 || p > 1) return horizon + 60;
      return horizon - Math.sin(Math.PI * p) * height * 0.5;
    }),
    op: useDerivedValue(() => {
      const p = pv.value;
      if (p < 0 || p > 1) return 0;
      return Math.min(1, Math.sin(Math.PI * p) * 3);
    }),
  });
  const sun = pos(sunP);
  const moon = pos(moonP);

  return (
    <Canvas style={{ width, height, opacity }} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} positions={[0, 0.4, 1]} colors={colors} />
      </Rect>
      <Group opacity={sun.op}>
        <Circle cx={sun.cx} cy={sun.cy} r={46} color="rgba(255,214,140,0.22)" />
        <Circle cx={sun.cx} cy={sun.cy} r={24} color="#FFD27A" />
      </Group>
      <Group opacity={moon.op}>
        <Circle cx={moon.cx} cy={moon.cy} r={38} color="rgba(220,230,255,0.12)" />
        <Circle cx={moon.cx} cy={moon.cy} r={18} color="#EEF2FA" />
        <Circle cx={useDerivedValue(() => moon.cx.value - 5)} cy={useDerivedValue(() => moon.cy.value - 4)} r={4} color="#D3DCEC" />
        <Circle cx={useDerivedValue(() => moon.cx.value + 6)} cy={useDerivedValue(() => moon.cy.value + 6)} r={3} color="#D3DCEC" />
      </Group>
    </Canvas>
  );
}

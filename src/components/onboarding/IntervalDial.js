import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  SweepGradient,
  Text as SkText,
  useClock,
  useFont,
  usePathValue,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/theme';
import { upper } from '../../utils/format';

// Hatırlatma aralığı kadranı (30–180 dk, 15'lik adımlar).
// Akıcılık için her şey UI thread'de: jest (Gesture Handler) → paylaşılan açı → Skia çizimi.
// - Sürüklerken tutamak parmağı kesintisiz izler; bırakınca yayla en yakın adıma oturur.
// - Her adım değişiminde hafif titreşim ve sayıda küçük bir "nefes".
// - İçteki su seviyesi değere göre yükselir, hızlı çevirince çalkalanır.
// React'e yalnızca adım değişince haber verilir (çipler ve özet metni için).

export const DIAL_MIN = 30;
export const DIAL_MAX = 180;
const STEP = 15;
const SIZE = 256;
const C = SIZE / 2;
const R = 100;
const R_IN = R - 16;
const FRAC_MIN = DIAL_MIN / DIAL_MAX;
const TAU = Math.PI * 2;

const springSnap = { damping: 16, stiffness: 190, mass: 0.7 };

export default function IntervalDial({ minutes, onChange, topLabel, subLabel }) {
  const { c, type, dark } = useTheme();
  const tail = dark ? '#8BE8D6' : '#5CC6E6';
  const font = useFont(require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'), 64);

  const frac = useSharedValue(minutes / DIAL_MAX); // sürekli (parmağı izler)
  const live = useSharedValue(minutes); // anlık adım değeri
  const dragging = useSharedValue(0);
  const grab = useSharedValue(0); // tutamak büyümesi
  const pulse = useSharedValue(1);
  const slosh = useSharedValue(0);

  // Dışarıdan (çipler) gelen değişiklik: yayla oraya ak
  useEffect(() => {
    if (dragging.value) return;
    live.value = minutes;
    frac.value = withSpring(minutes / DIAL_MAX, springSnap);
    slosh.value = withSequence(withTiming(5, { duration: 120 }), withSpring(0, { damping: 6, stiffness: 50 }));
  }, [minutes]);

  const notify = (m) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(m);
  };

  const track = (x, y) => {
    'worklet';
    const dx = x - C;
    const dy = y - C;
    if (dx * dx + dy * dy < 36 * 36) return; // merkez belirsiz
    let f = (Math.atan2(dy, dx) + Math.PI / 2) / TAU;
    if (f < 0) f += 1;
    // tepeden karşı uca sıçrama yok: en yakın sarımı seç, uçlarda dur
    const cur = frac.value;
    if (f - cur > 0.5) f -= 1;
    else if (cur - f > 0.5) f += 1;
    f = Math.min(1, Math.max(FRAC_MIN, f));
    slosh.value = Math.min(9, slosh.value + Math.abs(f - cur) * 40);
    frac.value = f;
    const m = Math.round((f * DIAL_MAX) / STEP) * STEP;
    if (m !== live.value) {
      live.value = m;
      pulse.value = withSequence(withTiming(1.06, { duration: 70 }), withSpring(1, { damping: 10, stiffness: 260 }));
      scheduleOnRN(notify, m);
    }
  };

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      dragging.value = 1;
      grab.value = withSpring(1, { damping: 14, stiffness: 260 });
      track(e.x, e.y);
    },
    onUpdate: (e) => {
      'worklet';
      track(e.x, e.y);
    },
    onFinalize: () => {
      'worklet';
      dragging.value = 0;
      grab.value = withSpring(0, { damping: 14, stiffness: 220 });
      frac.value = withSpring(live.value / DIAL_MAX, springSnap);
      slosh.value = withSpring(0, { damping: 5, stiffness: 40 });
    },
  });

  // ---- çizim -------------------------------------------------------------------------
  const ring = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.addArc(Skia.XYWHRect(C - R, C - R, R * 2, R * 2), -90, 359.9);
    return p.build();
  }, []);
  const ticks = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const r1 = i % 5 === 0 ? 128 : 124;
      p.moveTo(C + 118 * Math.cos(a), C + 118 * Math.sin(a));
      p.lineTo(C + r1 * Math.cos(a), C + r1 * Math.sin(a));
    }
    return p.build();
  }, []);

  const end = useDerivedValue(() => Math.min(0.9999, Math.max(0, frac.value)));
  const thumb = useDerivedValue(() => {
    const a = frac.value * TAU - Math.PI / 2;
    return [{ translateX: C + R * Math.cos(a) }, { translateY: C + R * Math.sin(a) }, { scale: 1 + grab.value * 0.28 }];
  });
  const haloOpacity = useDerivedValue(() => 0.18 + grab.value * 0.22);

  // iç su: seviye değerle yükselir, yüzey hafifçe dalgalanır
  const clock = useClock();
  const water = usePathValue((b) => {
    'worklet';
    const t = clock.value / 1000;
    const level = C + R_IN - (0.18 + 0.62 * frac.value) * R_IN * 2 * 0.62;
    const amp = 2 + slosh.value;
    for (let x = C - R_IN; x <= C + R_IN + 4; x += 4) {
      const y = level + amp * Math.sin(x * 0.06 + t * 2.2) + amp * 0.4 * Math.sin(x * 0.13 - t * 3);
      if (x === C - R_IN) b.moveTo(x, y);
      else b.lineTo(x, y);
    }
    b.lineTo(C + R_IN + 4, C + R_IN + 4);
    b.lineTo(C - R_IN, C + R_IN + 4);
    b.close();
  });
  const inner = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.addCircle(C, C, R_IN);
    return p.build();
  }, []);

  const label = useDerivedValue(() => String(live.value));
  const labelX = useDerivedValue(() => (font ? C - font.measureText(label.value).width / 2 : C));
  const labelT = useDerivedValue(() => [{ translateX: C }, { translateY: C + 8 }, { scale: pulse.value }, { translateX: -C }, { translateY: -(C + 8) }]);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={topLabel}
      accessibilityValue={{ text: `${minutes} ${subLabel}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const d = e.nativeEvent.actionName === 'increment' ? STEP : -STEP;
        onChange(Math.max(DIAL_MIN, Math.min(DIAL_MAX, minutes + d)));
      }}
    >
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={{ width: SIZE, height: SIZE }}>
            <Path path={ticks} color={c.ink3} style="stroke" strokeWidth={1.5} opacity={0.5} />
            <Path path={ticks} color={c.accent} style="stroke" strokeWidth={1.8} start={0} end={end} />

            <Group clip={inner}>
              <Circle cx={C} cy={C} r={R_IN}>
                <RadialGradient c={vec(C, C * 0.9)} r={R_IN} colors={[c.accent + (dark ? '29' : '1A'), c.accent + '00']} />
              </Circle>
              <Path path={water} color={c.accent} opacity={dark ? 0.1 : 0.08} />
            </Group>

            <Path path={ring} color={c.track} style="stroke" strokeWidth={14} />
            <Path path={ring} style="stroke" strokeWidth={14} strokeCap="round" start={0} end={end}>
              <SweepGradient c={vec(C, C)} colors={[c.accent, tail]} transform={[{ rotate: -Math.PI / 2 - 0.12 }]} origin={vec(C, C)} />
            </Path>

            <Group transform={thumb}>
              <Circle cx={0} cy={0} r={21} color={tail} opacity={haloOpacity} />
              <Circle cx={0} cy={0} r={11} color={dark ? '#EFFFFC' : '#FFFFFF'} />
              <Circle cx={0} cy={0} r={11} color={tail} style="stroke" strokeWidth={4} />
            </Group>

            {font && (
              <Group transform={labelT}>
                <SkText x={labelX} y={C + 26} text={label} font={font} color={c.ink} />
              </Group>
            )}
          </Canvas>
        </View>
      </GestureDetector>
      <View style={styles.top} pointerEvents="none">
        <Text style={[type.overline, { color: c.ink2, fontSize: 11 }]}>{upper(topLabel)}</Text>
      </View>
      <View style={styles.bottom} pointerEvents="none">
        <Text style={[type.body, { color: c.ink2, fontSize: 15 }]}>{subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: C - 58, alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, top: C + 38, alignItems: 'center' },
});

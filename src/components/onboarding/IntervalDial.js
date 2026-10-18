import React, { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/theme';
import { upper } from '../../utils/format';

// Hatırlatma aralığı kadranı: tepeden saat yönünde dolan yay, sürüklenebilen tutamak.
// Değer dakika (30–180, 15'lik adımlar); yay oranı değer / 180.

export const DIAL_MIN = 30;
export const DIAL_MAX = 180;
const STEP = 15;
const SIZE = 252;
const R = 100;
const C = SIZE / 2;

const polar = (frac, r) => {
  const a = frac * Math.PI * 2 - Math.PI / 2;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const arcPath = (frac, r) => {
  const f = Math.min(frac, 0.9999);
  const [x0, y0] = polar(0, r);
  const [x1, y1] = polar(f, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x1} ${y1}`;
};

export default function IntervalDial({ minutes, onChange, topLabel, subLabel }) {
  const { c, type, dark } = useTheme();
  const live = useRef({ minutes, onChange });
  live.current = { minutes, onChange };
  const origin = useRef({ x: 0, y: 0 });

  const fromTouch = (px, py) => {
    const dx = px - origin.current.x - C;
    const dy = py - origin.current.y - C;
    if (dx * dx + dy * dy < 40 * 40) return; // merkeze yakın dokunuş belirsiz
    let frac = (Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2);
    if (frac < 0) frac += 1;
    const cur = live.current.minutes / DIAL_MAX;
    // tepeden diğer uca sıçramayı engelle (180 → 30 gibi)
    if (Math.abs(frac - cur) > 0.5) return;
    const next = Math.max(DIAL_MIN, Math.min(DIAL_MAX, Math.round((frac * DIAL_MAX) / STEP) * STEP));
    if (next !== live.current.minutes) {
      Haptics.selectionAsync().catch(() => {});
      live.current.onChange(next);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        origin.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX, y: e.nativeEvent.pageY - e.nativeEvent.locationY };
        fromTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (_, g) => fromTouch(g.moveX, g.moveY),
    })
  ).current;

  const frac = minutes / DIAL_MAX;
  const [tx, ty] = polar(frac, R);
  const tail = dark ? '#8BE8D6' : '#5CC6E6';

  return (
    <View
      style={styles.wrap}
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={topLabel}
      accessibilityValue={{ text: `${minutes} ${subLabel}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const d = e.nativeEvent.actionName === 'increment' ? STEP : -STEP;
        onChange(Math.max(DIAL_MIN, Math.min(DIAL_MAX, minutes + d)));
      }}
    >
      <Svg width={SIZE} height={SIZE} pointerEvents="none">
        <Defs>
          <LinearGradient id="dialArc" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.accent} />
            <Stop offset="1" stopColor={tail} />
          </LinearGradient>
          <RadialGradient id="dialCore" cx="50%" cy="45%" r="55%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={dark ? 0.16 : 0.1} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* dış çentik halkası */}
        {Array.from({ length: 60 }, (_, i) => {
          const [x0, y0] = polar(i / 60, 118);
          const [x1, y1] = polar(i / 60, i % 5 === 0 ? 127 : 123);
          return <Line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={c.ink3} strokeOpacity={i % 5 === 0 ? 0.8 : 0.45} strokeWidth={1.5} />;
        })}
        <Circle cx={C} cy={C} r={R - 12} fill="url(#dialCore)" />
        <Circle cx={C} cy={C} r={R} stroke={c.track} strokeWidth={14} fill="none" />
        <Path d={arcPath(frac, R)} stroke="url(#dialArc)" strokeWidth={14} strokeLinecap="round" fill="none" />
        <Circle cx={tx} cy={ty} r={20} fill={tail} fillOpacity={0.18} />
        <Circle cx={tx} cy={ty} r={11} fill={dark ? '#EFFFFC' : '#FFFFFF'} stroke={tail} strokeWidth={4} />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[type.overline, { color: c.ink2, fontSize: 11 }]}>{upper(topLabel)}</Text>
        <Text style={[type.display, styles.value, { color: c.ink }]}>{minutes}</Text>
        <Text style={[type.body, { color: c.ink2, fontSize: 15 }]}>{subLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 64, lineHeight: 74, letterSpacing: -3, marginVertical: 2 },
});

import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/theme';

// Büyük sayı + kaydırılabilen cetvel + kaydırıcı. Cetvel değerle birlikte akar (5'in katları uzun çizgi).
// Cetvelde sağa-sola sürükleme ve kaydırıcı aynı değeri değiştirir.
// props: value, min, max, onChange, unit, format (görünen metin), minLabel, maxLabel
// compact: daha küçük sayı ve cetvel, kaydırıcı yok (iki ölçek aynı sayfaya sığsın diye)

const TICK_GAP = 10;
const TICKS = 15; // merkezden her yana

export default function ValueScale({ value, min, max, onChange, unit, format = String, minLabel, maxLabel, compact = false }) {
  const { c, type } = useTheme();
  const [trackW, setTrackW] = useState(1);
  const live = useRef({ value, min, max, onChange, trackW });
  live.current = { value, min, max, onChange, trackW };

  const set = (v) => {
    const { min: lo, max: hi, value: cur, onChange: cb } = live.current;
    const next = Math.max(lo, Math.min(hi, Math.round(v)));
    if (next !== cur) {
      Haptics.selectionAsync().catch(() => {});
      cb(next);
    }
  };

  // cetvel: sürükleme yönünün tersine akar (parmağın altındaki çizgi parmakla gider)
  const rulerStart = useRef(value);
  const ruler = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        rulerStart.current = live.current.value;
      },
      onPanResponderMove: (_, g) => set(rulerStart.current - g.dx / TICK_GAP),
    })
  ).current;

  const trackX = useRef(0);
  const slider = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // ekran koordinatıyla çalış: locationX parmak çocuk görünüme geçince kayabiliyor
      onPanResponderGrant: (e) => {
        trackX.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        setFromX(e.nativeEvent.locationX);
      },
      onPanResponderMove: (_, g) => setFromX(g.moveX - trackX.current),
    })
  ).current;
  const setFromX = (x) => {
    const { min: lo, max: hi, trackW: w } = live.current;
    set(lo + (Math.max(0, Math.min(w, x)) / w) * (hi - lo));
  };

  const frac = (value - min) / (max - min);

  return (
    <View style={styles.wrap}>
      <View style={styles.numberRow}>
        <Text style={[type.display, styles.number, compact && styles.numberCompact, { color: c.ink }]}>{format(value)}</Text>
        {unit ? <Text style={[type.heading, styles.unit, { color: c.ink2 }]}>{unit}</Text> : null}
      </View>

      <View
        style={[styles.ruler, compact && styles.rulerCompact]}
        {...ruler.panHandlers}
        {...(compact && {
          accessible: true,
          accessibilityRole: 'adjustable',
          accessibilityValue: { min, max, now: value },
          accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
          onAccessibilityAction: (e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1)),
        })}
      >
        {Array.from({ length: TICKS * 2 + 1 }, (_, k) => {
          const off = k - TICKS;
          const v = value + off;
          if (v < min || v > max) return null;
          const center = off === 0;
          const major = v % 5 === 0;
          const fade = 1 - Math.abs(off) / (TICKS + 1);
          return (
            <View
              key={k}
              style={[
                styles.tick,
                {
                  left: '50%',
                  marginLeft: off * TICK_GAP - 1,
                  height: (center ? 92 : major ? 70 : 46) * (compact ? 0.62 : 1),
                  width: center ? 2.5 : 1.5,
                  backgroundColor: center ? c.accent : c.ink3,
                  opacity: center ? 1 : fade * (major ? 0.9 : 0.55),
                },
              ]}
            />
          );
        })}
      </View>

      {!compact && (
      <>
      <View
        style={styles.sliderHit}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...slider.panHandlers}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      >
        <View style={[styles.track, { backgroundColor: c.track }]} pointerEvents="none">
          <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: c.accent }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: frac * trackW - 14, backgroundColor: c.accent, shadowColor: c.accent }]}
        />
      </View>
      <View style={styles.labels}>
        <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>{minLabel}</Text>
        <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>{maxLabel}</Text>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  number: { fontSize: 88, lineHeight: 100, letterSpacing: -4 },
  numberCompact: { fontSize: 58, lineHeight: 66, letterSpacing: -2.5 },
  unit: { marginLeft: 6, fontSize: 24 },
  ruler: { height: 100, marginTop: 14, justifyContent: 'center', overflow: 'hidden' },
  rulerCompact: { height: 64, marginTop: 6 },
  tick: { position: 'absolute', borderRadius: 1 },
  sliderHit: { height: 44, marginTop: 22, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});

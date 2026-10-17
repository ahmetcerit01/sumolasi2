import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';

// Maketteki çizgi ikonlar (bardak, kupa, şişe)
const ICONS = {
  cup: ['M6 3h12l-1.6 17a1.5 1.5 0 0 1-1.5 1.4H9.1a1.5 1.5 0 0 1-1.5-1.4z', 'M6.8 10h10.4'],
  mug: ['M4 6h12v9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M16 9h2a2.5 2.5 0 0 1 0 5h-2'],
  bottle: ['M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z', 'M8 12h8'],
};

export function DrinkIcon({ name, size = 26, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(ICONS[name] || ICONS.cup).map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

export function QuickAddRow({ items, onAdd, style }) {
  const { c, type, radius } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {items.map((it) => (
        <TouchableOpacity
          key={it.key}
          activeOpacity={0.75}
          onPress={() => onAdd(it.ml)}
          accessibilityRole="button"
          accessibilityLabel={`${it.label}, ${it.ml} ml`}
          style={[styles.tile, { backgroundColor: c.card, borderRadius: radius.tile }, cardShadow(c)]}
        >
          <DrinkIcon name={it.icon} color={c.accent} />
          <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{it.label}</Text>
          <Text style={[type.label, { color: c.ink2 }]}>{`${fmtNumber(it.ml)} ml`}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 6, minHeight: 44 },
});

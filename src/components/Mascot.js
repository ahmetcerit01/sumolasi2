import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Damla maskotu. Tasarım maketindeki Mascot bileşeninin birebir karşılığı:
// 160pt'lik bir tuval üzerinde mutlak konumlu şekiller, `size` ile ölçeklenir.
// mood: thirsty | normal | happy | celebrate | sleepy

const BODY = { thirsty: '#AFCFEA', normal: '#4FA9F0', happy: '#3A9BF2', celebrate: '#2B8FE8', sleepy: '#4A79A8' };
const INK = '#0F2233';

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

const Dot = ({ l, t, w, h, r, bg, extra }) => (
  <View style={[{ position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: r ?? Math.max(w, h) / 2, backgroundColor: bg }, extra]} />
);

const Arc = ({ l, t, w, h, up, color = INK, thick = 3 }) => (
  <View
    style={{
      position: 'absolute',
      left: l,
      top: t,
      width: w,
      height: h,
      borderWidth: thick,
      borderColor: color,
      ...(up
        ? { borderBottomWidth: 0, borderTopLeftRadius: w, borderTopRightRadius: w }
        : { borderTopWidth: 0, borderBottomLeftRadius: w, borderBottomRightRadius: w }),
    }}
  />
);

export default function Mascot({ mood = 'normal', size = 120, style, accessibilityLabel }) {
  const s = size / 160;
  const body = BODY[mood] || BODY.normal;
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ width: 160, height: 160, transform: [{ scale: s }], transformOrigin: 'top left' }}>
        {/* gövde: sol üst köşesi sivri, 45° döndürülmüş kare */}
        <View
          style={{
            position: 'absolute',
            left: 26,
            top: 40,
            width: 108,
            height: 108,
            backgroundColor: body,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 54,
            borderBottomLeftRadius: 54,
            borderBottomRightRadius: 54,
            transform: [{ rotate: '45deg' }],
          }}
        />
        {/* parlama */}
        <Dot l={50} t={66} w={16} h={26} bg="rgba(255,255,255,0.55)" extra={{ transform: [{ rotate: '-22deg' }] }} />

        {(mood === 'happy' || mood === 'celebrate') && (
          <>
            <Dot l={44} t={112} w={15} h={8} bg="rgba(255,157,181,0.75)" />
            <Dot l={101} t={112} w={15} h={8} bg="rgba(255,157,181,0.75)" />
          </>
        )}

        {/* gözler */}
        {mood === 'normal' && (
          <>
            <Dot l={60} t={92} w={10} h={14} bg={INK} />
            <Dot l={90} t={92} w={10} h={14} bg={INK} />
            <Dot l={62} t={94} w={3} h={3} bg="#FFFFFF" />
            <Dot l={92} t={94} w={3} h={3} bg="#FFFFFF" />
          </>
        )}
        {(mood === 'happy' || mood === 'celebrate') && (
          <>
            <Arc l={57} t={95} w={14} h={9} up />
            <Arc l={88} t={95} w={14} h={9} up />
          </>
        )}
        {mood === 'thirsty' && (
          <>
            <View style={[styles.abs, { left: 59, top: 97, width: 12, height: 7, backgroundColor: INK, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }]} />
            <View style={[styles.abs, { left: 89, top: 97, width: 12, height: 7, backgroundColor: INK, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }]} />
            <Dot l={56} t={90} w={15} h={3} r={2} bg={INK} extra={{ transform: [{ rotate: '-14deg' }] }} />
            <Dot l={89} t={90} w={15} h={3} r={2} bg={INK} extra={{ transform: [{ rotate: '14deg' }] }} />
          </>
        )}
        {mood === 'sleepy' && (
          <>
            <Arc l={57} t={96} w={15} h={8} />
            <Arc l={87} t={96} w={15} h={8} />
          </>
        )}

        {/* ağız */}
        {(mood === 'normal' || mood === 'happy') && <Arc l={mood === 'happy' ? 68 : 71} t={110} w={mood === 'happy' ? 22 : 16} h={mood === 'happy' ? 11 : 9} />}
        {mood === 'celebrate' && (
          <View style={[styles.abs, { left: 67, top: 110, width: 26, height: 14, backgroundColor: INK, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' }]}>
            <Dot l={7} t={8} w={12} h={8} bg="#FF8FA8" />
          </View>
        )}
        {mood === 'thirsty' && <Dot l={75} t={112} w={9} h={11} bg={INK} />}
        {mood === 'sleepy' && <Dot l={74} t={114} w={12} h={3} r={2} bg={INK} />}

        {/* süsler */}
        {mood === 'thirsty' && (
          <View
            style={[
              styles.abs,
              {
                left: 116, top: 62, width: 13, height: 13, backgroundColor: '#CFE8FB', borderWidth: 2, borderColor: '#8DBBE0',
                borderTopLeftRadius: 0, borderTopRightRadius: 7, borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        )}
        {mood === 'celebrate' && (
          <Svg width={160} height={160} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Path d="M22 44 L25 52 L33 55 L25 58 L22 66 L19 58 L11 55 L19 52 Z" fill="#F6B73C" />
            <Path d="M136 28 L138 34 L144 36 L138 38 L136 44 L134 38 L128 36 L134 34 Z" fill="#F6B73C" />
            <Path d="M140 96 L142 101 L147 103 L142 105 L140 110 L138 105 L133 103 L138 101 Z" fill="#5CC8F0" />
            <Circle cx={30} cy={104} r={3} fill="#FF9DB5" />
            <Circle cx={118} cy={16} r={3} fill="#2FA37A" />
          </Svg>
        )}
        {mood === 'sleepy' && (
          <>
            <Text style={[styles.abs, styles.z, { left: 112, top: 26, fontSize: 18, color: '#7B93AA' }]}>z</Text>
            <Text style={[styles.abs, styles.z, { left: 126, top: 10, fontSize: 13, color: '#9DB0C0' }]}>z</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  z: { fontFamily: 'Inter_700Bold' },
});

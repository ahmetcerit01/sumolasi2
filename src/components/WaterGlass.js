import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../theme/colors';

// Bardağın içi: dikey dolum (LinearGradient)
// Arkadaki halka: tepeden başlayarak gradyanlı, yüzdeye göre dolan Animated SVG ring

export default function WaterGlass({ totalMl, goalMl }) {
  const percent = goalMl ? totalMl / goalMl : 0;
  const clamped = Math.min(percent, 1);

  // Bardak içi dolum animasyonu
  const fillH = useRef(new Animated.Value(clamped)).current;
  const spill = useRef(new Animated.Value(0)).current;

  // Halka dolum animasyonu (0..1)
  const ringProgress = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(fillH, { toValue: clamped, duration: 500, useNativeDriver: false }).start();

    Animated.timing(ringProgress, { toValue: Math.min(percent, 1), duration: 600, useNativeDriver: false }).start();

    if (percent > 1) {
      spill.setValue(0);
      Animated.sequence([
        Animated.timing(spill, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(spill, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [totalMl, goalMl]);

  // Bardak içi yükseklik
  const height = fillH.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });

  // Halka boyutları
  const size = 170;              // önceki ring görünümü ile aynı
  const strokeWidth = 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - strokeWidth / 2; // stroke merkeze çizilir
  const C = 2 * Math.PI * r;            // çevre

  // strokeDashoffset = C * (1 - progress)
  const dashOffset = ringProgress.interpolate({ inputRange: [0, 1], outputRange: [C, 0] });

  return (
    <View style={styles.wrapper}>
      {/* Arkadaki halka: zemin + animasyonlu ilerleme */}
      <View style={{ position: 'absolute', width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={COLORS.primaryStart} />
              <Stop offset="100%" stopColor={COLORS.primaryEnd} />
            </SvgLinearGradient>
          </Defs>

          {/* Arka plan (tam halka) */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="rgba(76,140,255,0.15)"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* İlerleyen halka: tepeden başlamak için -90° döndürülür */}
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={C}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx}, ${cy}`}
            fill="none"
          />
        </Svg>
      </View>

      {/* Bardak gövdesi + su dolumu */}
      <View style={styles.glass}>
        <Animated.View style={[styles.fillContainer, { height }]}>          
          <LinearGradient colors={[COLORS.primaryStart, COLORS.primaryEnd]} style={styles.fill}/>
        </Animated.View>
      </View>

      {/* Hedef aşımında üstte küçük "spill" efekti */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.spill,
          { opacity: spill, transform: [{ translateY: spill.interpolate({ inputRange: [0, 1], outputRange: [10, -12] }) }] },
        ]}
      />
    </View>
  );
}

// Animated SVG Circle
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  glass: {
    width: 90,
    height: 140,
    borderRadius: 20,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#E6EDF7',
    backgroundColor: '#F8FAFF',
    overflow: 'hidden',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  fillContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  fill: { width: '100%', height: '100%' },
  spill: { position: 'absolute', top: 10, width: 110, height: 10, borderRadius: 10, backgroundColor: 'rgba(124,232,255,0.8)' },
});
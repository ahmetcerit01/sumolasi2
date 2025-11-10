import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated, Easing, Image } from 'react-native';
import OnboardLottie from '../components/OnboardLottie';
import AnimatedWave from '../components/AnimatedWave';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const WAVE_H = 96; // alt dalga yüksekliği

const OPTIONS = [
  { key: 'hydrate', label: 'Sulu Kal' },
  { key: 'lose', label: 'Kilo Vermek' },
  { key: 'look', label: 'Muhteşem Görünüyorsun' },
  { key: 'fit', label: 'Fit Olmak' },
];

export default function OnboardScreen({ navigation, onDone }) {
  const insets = useSafeAreaInsets();

  // 1) Damla bob animasyonu
  const dropY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dropY, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(dropY, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [dropY]);

  // 2) Su seviyesi (0..1)
  const [selected, setSelected] = useState({});
  const level = useMemo(() => {
    const count = Object.values(selected).filter(Boolean).length;
    return count / OPTIONS.length;
  }, [selected]);

  const levelAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(levelAnim, {
      toValue: level,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [level, levelAnim]);

  // Su kabı ölçüleri
  const TANK_W = width * 0.62;
  const TANK_H = width * 0.62;
  const riseTranslateY = levelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TANK_H * 0.25, -TANK_H * 0.15], // hafif yukarı çıkar
  });

  // Bitir animasyonu: dalgayı aşağı indir, sonra ana ekrana geç
  const [finishing, setFinishing] = useState(false);
  const waveDown = useRef(new Animated.Value(0)).current; // 0 -> 1 (aşağı)
  const onFinish = () => {
    if (finishing) return;
    setFinishing(true);
    // önce suyu biraz daha yükselt
    Animated.parallel([
      Animated.timing(levelAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(waveDown, { toValue: 1, delay: 200, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      // Ana ekrana geç
      if (typeof onDone === 'function') {
        onDone();
      } else if (navigation?.replace) {
        // yedek: eğer bir stack içindeysek
        navigation.replace('BottomTabs');
      }
    });
  };

  const waveTranslateY = waveDown.interpolate({
    inputRange: [0, 1],
    outputRange: [0, WAVE_H + 120], // aşağı kay
  });

  const toggle = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerArea}>
        {/* Damla */}
        <Animated.View style={{ transform: [{ translateY: dropY }] }}>
          <Image source={require('../../assets/subardagi.png')} style={{ width: 72, height: 72, resizeMode: 'contain' }} />
        </Animated.View>

        <Text style={styles.title}>Her gün yeterince su içiyor musun?</Text>
        <Text style={styles.subtitle}>SuMolası senin için kişisel bir su planı oluşturur, hatırlatır ve motive eder.</Text>
      </View>

      {/* Su tankı: Lottie içeriği, yükselen translateY ile */}
      <View style={[styles.tank, { width: TANK_W, height: TANK_H }]}>
        <Animated.View style={{ transform: [{ translateY: riseTranslateY }] }}>
          <OnboardLottie source={require('../../assets/lottie/wave.json')} style={{ width: TANK_W, height: TANK_H }} />
        </Animated.View>
      </View>

      {/* Seçenekler */}
      <View style={styles.optionsWrap}>
        {OPTIONS.map(o => {
          const active = !!selected[o.key];
          return (
            <TouchableOpacity key={o.key} onPress={() => toggle(o.key)} activeOpacity={0.9} style={[styles.opt, active && styles.optActive]}>
              <Text style={[styles.optTxt, active && styles.optTxtActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Devam butonu */}
      <View style={styles.footerSpace} />
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          disabled={Object.values(selected).filter(Boolean).length === 0 || finishing}
          onPress={onFinish}
          style={[styles.cta, (Object.values(selected).filter(Boolean).length === 0 || finishing) && { opacity: 0.6 }]}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaTxt}>{finishing ? 'Hazırlanıyor...' : 'Bitti'}</Text>
        </TouchableOpacity>
      </View>

      {/* Alt dalga */}
      <Animated.View style={[styles.waveWrap, { transform: [{ translateY: waveTranslateY }] }]} pointerEvents="none">
        <AnimatedWave height={WAVE_H} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FAFF' },
  headerArea: { alignItems: 'center', paddingHorizontal: 24, marginTop: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginTop: 12, maxWidth: 320 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 340 },

  tank: {
    alignSelf: 'center',
    marginTop: 18,
    borderRadius: 16,
    overflow: 'hidden', // Lottie yukarı çıkarken taşan kısımları kes
    backgroundColor: '#E9F3FF',
  },

  optionsWrap: {
    marginTop: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 10,
  },
  opt: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optActive: {
    backgroundColor: '#DCEBFF',
    borderWidth: 1,
    borderColor: '#4C8CFF',
  },
  optTxt: { color: '#334155', fontWeight: '700' },
  optTxtActive: { color: '#1E40AF' },

  ctaWrap: {
    position: 'absolute',
    left: 24, right: 24,
    bottom: WAVE_H + 16,
    zIndex: 2,
  },
  cta: { backgroundColor: '#4C8CFF', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '800' },

  waveWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1 },
  footerSpace: { height: WAVE_H + 56 },
});
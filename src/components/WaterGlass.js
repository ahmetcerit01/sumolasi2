import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, ClipPath, G } from 'react-native-svg';

// SVG bileşenlerini animasyonlu hale getiriyoruz
const AnimatedG = Animated.createAnimatedComponent(G);

export default function WaterGlass({ totalMl, goalMl }) {
  // Hedef sıfırsa hata vermesin diye kontrol
  const rawPercent = goalMl > 0 ? totalMl / goalMl : 0;
  // %0 ile %110 arasında sınırla (Taşma efekti için biraz pay bıraktık)
  const percent = Math.min(Math.max(rawPercent, 0), 1.1); 

  // --- ANİMASYON DEĞERLERİ ---
  const fillAnim = useRef(new Animated.Value(percent)).current;
  const waveAnimFront = useRef(new Animated.Value(0)).current;
  const waveAnimBack = useRef(new Animated.Value(0)).current;

  // 1. YÜKSELME ANİMASYONU (TURBO MOD 🚀)
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: percent,
      duration: 400, // 800ms -> 400ms'ye düşürüldü (Anında tepki)
      easing: Easing.out(Easing.cubic), // Hızlı başla, yumuşak dur
      useNativeDriver: true, 
    }).start();
  }, [percent]);

  // 2. DALGA ANİMASYONLARI (SAKİN AKIŞ 🌊)
  useEffect(() => {
    const loop = Animated.parallel([
      // Ön Dalga
      Animated.loop(
        Animated.timing(waveAnimFront, {
          toValue: 1,
          duration: 5000, 
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      // Arka Dalga
      Animated.loop(
        Animated.timing(waveAnimBack, {
          toValue: 1,
          duration: 9000, // Derinlik için daha yavaş
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);
    
    loop.start();
    return () => loop.stop();
  }, []);

  // --- INTERPOLASYONLAR ---

  // Dalga Döngüsü
  const xFront = waveAnimFront.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });
  const xBack = waveAnimBack.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });

  // Su Yüksekliği (220 piksel bardak boyu)
  const yFill = fillAnim.interpolate({
    inputRange: [0, 0.5, 1], 
    outputRange: [220, 110, 15], 
  });

  return (
    <View style={styles.container}>
      <Svg width={160} height={220} viewBox="0 0 160 220">
        <Defs>
          {/* Canlı Mavi Gradyan */}
          <LinearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#29B6F6" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#0288D1" stopOpacity="1" />
          </LinearGradient>

          {/* Bardak Maskesi */}
          <ClipPath id="glassShape">
            <Path d="M20,10 L35,180 Q40,210 80,210 H80 Q120,210 125,180 L140,10" />
          </ClipPath>
        </Defs>

        {/* 1. BOŞ BARDAK ZEMİNİ */}
        <Path
          d="M20,10 L35,180 Q40,210 80,210 H80 Q120,210 125,180 L140,10"
          fill="#E1F5FE" 
          fillOpacity={0.4}
        />

        {/* 2. SU ALANI (MASKELENMİŞ) */}
        <G clipPath="url(#glassShape)">
          
          {/* Yükselme Grubu */}
          <AnimatedG style={{ transform: [{ translateY: yFill }] }}>
            
            {/* A) ARKA DALGA */}
            <AnimatedG style={{ transform: [{ translateX: xBack }] }}>
              <Path
                fill="#0277BD" 
                fillOpacity={0.4}
                d="M0,10 Q45,-15 90,10 T180,10 T270,10 T360,10 V300 H0 Z"
              />
            </AnimatedG>

            {/* B) ÖN DALGA */}
            <AnimatedG style={{ transform: [{ translateX: xFront }] }}>
              <Path
                fill="url(#waterGrad)"
                d="M0,15 Q45,35 90,15 T180,15 T270,15 T360,15 V300 H0 Z"
              />
            </AnimatedG>

          </AnimatedG>
        </G>

        {/* 3. DETAYLAR */}
        <Path
          d="M20,10 L35,180 Q40,210 80,210 H80 Q120,210 125,180 L140,10"
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        
        <Path
          d="M35,30 L42,160"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        <Path
          d="M20,10 Q80,-5 140,10"
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth="2"
        />

      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#0277BD",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
});
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

  // 1. YÜKSELME ANİMASYONU (HIZLANDIRILDI ⚡️)
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: percent,
      duration: 800, // 1.5 saniye yerine 0.8 saniye (Çok daha seri)
      easing: Easing.out(Easing.cubic), // Yaylanmayı kaldırdık, net duruş.
      useNativeDriver: true, 
    }).start();
  }, [percent]);

  // 2. DALGA ANİMASYONLARI (SAKİNLEŞTİRİLDİ 🌊)
  useEffect(() => {
    const loop = Animated.parallel([
      // Ön Dalga (Sakin akış)
      Animated.loop(
        Animated.timing(waveAnimFront, {
          toValue: 1,
          duration: 5000, // 2000 yerine 5000 (Daha yavaş ve huzurlu)
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
      // Arka Dalga (Daha da yavaş - Derinlik için)
      Animated.loop(
        Animated.timing(waveAnimBack, {
          toValue: 1,
          duration: 4000, // 4000 yerine 9000
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);
    
    loop.start();
    return () => loop.stop();
  }, []);

  // --- INTERPOLASYONLAR ---

  // Dalga Döngüsü (0'dan -180'e kayıp başa saracak)
  const xFront = waveAnimFront.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });
  const xBack = waveAnimBack.interpolate({ inputRange: [0, 1], outputRange: [0, -180] });

  // Su Yüksekliği (220 piksel bardak boyu)
  const yFill = fillAnim.interpolate({
    inputRange: [0, 0.5, 1], 
    // Bardak tabanı dar olduğu için seviye ayarlaması:
    // [Boş, Yarım, Dolu] piksel değerleri
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
            
            {/* A) ARKA DALGA (Daha koyu/opak, yavaş, ters faz) */}
            <AnimatedG style={{ transform: [{ translateX: xBack }] }}>
              <Path
                fill="#0277BD" // Daha koyu mavi
                fillOpacity={0.4}
                // Geniş dalga deseni
                d="M0,10 Q45,-15 90,10 T180,10 T270,10 T360,10 V300 H0 Z"
              />
            </AnimatedG>

            {/* B) ÖN DALGA (Parlak, ana dalga) */}
            <AnimatedG style={{ transform: [{ translateX: xFront }] }}>
              <Path
                fill="url(#waterGrad)"
                // Arka dalgadan biraz farklı fazda
                d="M0,15 Q45,35 90,15 T180,15 T270,15 T360,15 V300 H0 Z"
              />
            </AnimatedG>

          </AnimatedG>
        </G>

        {/* 3. DETAYLAR (Çerçeve ve Parlama) */}
        <Path
          d="M20,10 L35,180 Q40,210 80,210 H80 Q120,210 125,180 L140,10"
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        
        {/* Cam Yansıması */}
        <Path
          d="M35,30 L42,160"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        
        {/* Bardak Ağzı */}
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
    // Bardağa 3D derinlik katan gölge
    shadowColor: "#0277BD",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
});
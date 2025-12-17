import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, G, ClipPath } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);

export default function AnimatedSplash({ onAnimationFinish }) {
  // Animasyon Değerleri
  const fillAnim = useRef(new Animated.Value(0)).current; // Su seviyesi (0 -> 1)
  const bubbleAnim = useRef(new Animated.Value(0)).current; // Baloncuk hareketi
  const textOpacity = useRef(new Animated.Value(0)).current; // Logo yazısı
  const containerOpacity = useRef(new Animated.Value(1)).current; // Çıkış için

  useEffect(() => {
    // 1. SUYUN DOLMASI
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 2000, // 2 saniyede dolsun
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG width/height değiştireceğiz
    }).start();

    // 2. BALONCUKLARIN YÜKSELMESİ (Sonsuz)
    Animated.loop(
      Animated.timing(bubbleAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    // 3. YAZININ GELMESİ (Su dolmaya yakın)
    Animated.timing(textOpacity, {
      toValue: 1,
      duration: 800,
      delay: 1200,
      useNativeDriver: true,
    }).start(() => {
      // 4. HER ŞEY BİTİNCE (Çıkış)
      setTimeout(() => {
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          if (onAnimationFinish) onAnimationFinish();
        });
      }, 1600); // Yazı geldikten 1.5sn sonra uygulamayı aç
    });
  }, []);

  // --- INTERPOLASYONLAR ---
  
  // Su yüksekliği (Tüp boyu 200br)
  // Dolarken aşağıdan yukarı (y koordinatı azalır)
  // height 0 -> 200
  // y 200 -> 0
  const fillHeight = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] });
  const fillY = fillAnim.interpolate({ inputRange: [0, 1], outputRange: [250, 50] });

  // Baloncuk Hareketleri (Yükselme)
  const bubbleY1 = bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [250, 50] });
  const bubbleY2 = bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [280, 80] });
  const bubbleOp = bubbleAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <AnimatedView style={[styles.container, { opacity: containerOpacity }]}>
      {/* Zemin */}
      <ExpoLinearGradient
        colors={['#FFFFFF', '#F0F8FF']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.logoContainer}>
        <Svg width={200} height={260} viewBox="0 0 200 260">
          <Defs>
            <LinearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#4FC3F7" />
              <Stop offset="100%" stopColor="#0277BD" />
            </LinearGradient>
            
            {/* Tüp Şekilleri Maskesi */}
            <ClipPath id="tubesClip">
               {/* Sol Tüp */}
               <Rect x="20" y="50" width="60" height="200" rx="30" />
               {/* Sağ Tüp */}
               <Rect x="120" y="50" width="60" height="200" rx="30" />
            </ClipPath>
          </Defs>

          {/* --- BOŞ TÜPLER (Gri Arkaplan) --- */}
          <G>
            <Rect x="20" y="50" width="60" height="200" rx="30" fill="#E1F5FE" />
            <Rect x="120" y="50" width="60" height="200" rx="30" fill="#E1F5FE" />
          </G>

          {/* --- SU DOLUMU (Maskelenmiş) --- */}
          <G clipPath="url(#tubesClip)">
            {/* Sol ve Sağ tüp için tek bir büyük su kütlesi yükseliyor */}
            <AnimatedRect
              x="0"
              y={fillY}
              width="200"
              height={fillHeight}
              fill="url(#waterGrad)"
            />

            {/* Baloncuklar (Fokurdama) */}
            <AnimatedCircle cx="50" cy={bubbleY1} r="8" fill="white" fillOpacity={0.4} opacity={bubbleOp} />
            <AnimatedCircle cx="150" cy={bubbleY2} r="6" fill="white" fillOpacity={0.4} opacity={bubbleOp} />
            <AnimatedCircle cx="60" cy={bubbleY2} r="4" fill="white" fillOpacity={0.3} opacity={bubbleOp} />
          </G>

          {/* --- CAM PARLAMASI (Highlight) --- */}
          <Rect x="28" y="60" width="10" height="180" rx="5" fill="white" fillOpacity={0.4} />
          <Rect x="128" y="60" width="10" height="180" rx="5" fill="white" fillOpacity={0.4} />

        </Svg>

        {/* --- LOGO YAZISI --- */}
        <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: 20 }] }}>
          <Text style={styles.brandName}>  Su Molası</Text>
          <Text style={styles.tagline}>Sağlıklı bir mola zamanı.</Text>
        </Animated.View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Tam ekran kapla
    zIndex: 9999, // En üstte
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0277BD',
    letterSpacing: -1,
    marginTop: 10,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4FC3F7',
    textAlign: 'center',
    marginTop: 5,
    letterSpacing: 1,
  }
});
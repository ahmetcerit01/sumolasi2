import React, { useRef, useEffect, useState } from 'react';
import LottieView from 'lottie-react-native';
import { Audio } from 'expo-av';
import { View, StyleSheet } from 'react-native';

export default function WaterEffect({ visible, onFinish, soundOnly = false }) {
  const [sound, setSound] = useState(null);
  const lottieRef = useRef(null);

  // 1. Sesi önceden yükle (Preload) - Gecikmeyi önler
  useEffect(() => {
    let isMounted = true;

    async function loadSound() {
      try {
        const { sound: soundObject } = await Audio.Sound.createAsync(
          require('../../assets/sounds/water_pop.mp3'), // Modern ses dosyası (aşağıda açıklama var)
          { shouldPlay: false, volume: 1.0 }
        );
        if (isMounted) setSound(soundObject);
      } catch (error) {
        console.log('Ses yüklenemedi:', error);
      }
    }

    loadSound();

    return () => {
      isMounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // 2. Tetiklendiğinde çalıştır
  useEffect(() => {
    if (visible) {
      // Sesi Oynat
      if (sound) {
        sound.replayAsync();
      }

      // Animasyonu Oynat
      if (!soundOnly && lottieRef.current) {
        lottieRef.current.play();
      } else if (soundOnly) {
        // Eğer sadece ses ise, kısa bir süre sonra işlemi bitir
        setTimeout(() => {
          onFinish && onFinish();
        }, 800);
      }
    }
  }, [visible, sound, soundOnly]);

  if (!visible || soundOnly) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LottieView
        ref={lottieRef}
        source={require('../../assets/animations/water-splash.json')}
        loop={false}
        autoPlay={false} // Manuel tetikliyoruz
        speed={0.8} // Modern ve akıcı bir hız (Çok yavaş olmamalı)
        resizeMode="cover" // Ekranı veya alanı tam kaplaması için
        onAnimationFinish={() => {
          // Lottie bitince otomatik tetiklenir
          onFinish && onFinish();
        }}
        style={styles.lottie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0, // İkonun veya ekranın altından başlasın
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'center', // Ortala
    alignItems: 'center',
    zIndex: 999, // En üstte görünsün
    elevation: 999,
  },
  lottie: {
    width: 300, // Daha geniş bir alan
    height: 300,
  },
});
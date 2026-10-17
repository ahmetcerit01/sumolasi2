import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';
import { useAudioPlayer } from 'expo-audio';
import { View, StyleSheet } from 'react-native';

export default function WaterEffect({ visible, onFinish, soundOnly = false }) {
  // 1. Sesi önceden yükle (Preload) - Gecikmeyi önler. Hook unmount'ta player'ı kendisi bırakır.
  const player = useAudioPlayer(require('../../assets/sounds/watersound2.mp3'));
  const lottieRef = useRef(null);

  // 2. Tetiklendiğinde çalıştır
  useEffect(() => {
    if (visible) {
      // Sesi baştan oynat
      try {
        player.seekTo(0);
        player.play();
      } catch (error) {
        console.log('Ses çalınamadı:', error);
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
  }, [visible, player, soundOnly]);

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
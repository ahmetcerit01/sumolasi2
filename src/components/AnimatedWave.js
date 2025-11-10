// src/components/AnimatedWave.js
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

export default function AnimatedWave({ height = 180 }) {
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  // -20..0..-20 translateX ile sağa-sola süzülen katmanlar
  const t1 = x.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-20, 0, -20] });
  const t2 = x.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -15, 0] });

  return (
    <View style={{ height }}>
      <Animated.View style={[styles.layer, { transform: [{ translateX: t1 }] }]} />
      <Animated.View style={[styles.layer2, { transform: [{ translateX: t2 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#4C8CFF',
  },
  layer2: {
    ...StyleSheet.absoluteFillObject,
    top: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#7CE8FF',
    opacity: 0.8,
  },
});
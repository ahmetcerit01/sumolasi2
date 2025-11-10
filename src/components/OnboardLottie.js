import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';

export default function OnboardLottie({ source, style, loop = true, autoPlay = true }) {
  const ref = useRef(null);

  useEffect(() => {
    // Bazı cihazlarda autoPlay güvenceye almak için
    if (autoPlay && ref.current) ref.current.play();
  }, [autoPlay]);

  return (
    <LottieView
      ref={ref}
      source={source}
      autoPlay={autoPlay}
      loop={loop}
      style={style}
      // progress veya speed ile ince ayar yapabilirsin
    />
  );
}
import React, { useRef } from 'react';
import LottieView from 'lottie-react-native';
import { Audio } from 'expo-av';

export default function WaterEffect({ visible, onFinish, soundOnly = true }) {
  const soundRef = useRef(null);
  const anim = useRef(null);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/water.mp3'),
          { volume: 1.0, shouldPlay: false }
        );
        if (isMounted) soundRef.current = sound;
      } catch (e) {
        console.warn('Water sound could not be loaded:', e?.message || e);
      }
    })();
    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  React.useEffect(() => {
    const play = async () => {
      try {
        if (soundRef.current) {
          // Replay from start each time
          await soundRef.current.replayAsync();
        }
      } catch (e) {
        console.warn('Water sound play failed:', e?.message || e);
      }
    };

    if (visible) {
      play();
      if (!soundOnly) {
        anim.current?.play();
      }
      // Animasyon/işaret süresi dolunca kapat
      setTimeout(() => onFinish && onFinish(), 1200);
    }
  }, [visible, soundOnly, onFinish]);

  return (
    visible && !soundOnly ? (
      <LottieView
        ref={anim}
        source={require('../../assets/animations/water-splash.json')}
        autoPlay
        loop={false}
        style={{
          width: 200,
          height: 200,
          position: 'absolute',
          bottom: 200,
          alignSelf: 'center',
          zIndex: 10,
        }}
      />
    ) : null
  );
}
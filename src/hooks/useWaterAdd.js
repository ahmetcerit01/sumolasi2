import { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useHydrationStore } from '../storage/useHydrationStore';

// Su ekleme: store + ses + dokunsal geri bildirim + bardaktaki damla animasyonu için sinyal.
// Sinyal uygulama genelinde paylaşılır: "+" sayfasından eklenen su da Ana Sayfa'daki bardağa damla düşürür.

let signal = 0;
const listeners = new Set();
const bump = () => {
  signal += 1;
  listeners.forEach((l) => l(signal));
};

let audioModeSet = false;

export function useWaterAdd() {
  const add = useHydrationStore((s) => s.add);
  const soundEnabled = useHydrationStore((s) => s.soundEnabled);
  const player = useAudioPlayer(require('../../assets/sounds/water_add.m4a'));
  const [addSignal, setAddSignal] = useState(signal);

  useEffect(() => {
    listeners.add(setAddSignal);
    if (!audioModeSet) {
      audioModeSet = true;
      // Sessiz modda da çalsın, müziği kısaca kıssın
      setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'duckOthers' }).catch(() => {});
    }
    return () => listeners.delete(setAddSignal);
  }, []);

  const addWater = (ml) => {
    const amount = Number(ml) || 0;
    if (amount <= 0) return;
    add(amount);
    bump();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (soundEnabled !== false) {
      try {
        player.seekTo(0);
        player.play();
      } catch {}
    }
  };

  return { addWater, addSignal };
}

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { BADGES } from '../constants/badges';
import { useHydrationStore } from '../storage/useHydrationStore';
import { LanguageContext } from '../i18n';
import { useTheme } from '../theme/theme';
import { badgeTint } from '../constants/badgeStyle';
import { upper } from '../utils/format';

// Yeni rozet kazanılınca hangi ekranda olunursa olunsun kutlama göster.
// (Eskiden sadece Rozetler sekmesi açıkken çalışıyordu.)
export default function BadgeCelebration() {
  const { t } = useContext(LanguageContext);
  const { c, type, dark } = useTheme();
  const badges = useHydrationStore((s) => s.badges) || {};
  const isHydrated = useHydrationStore((s) => s.isHydrated);
  const [badge, setBadge] = useState(null);
  const scale = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(require('../../assets/sounds/water_add.m4a'));
  const known = useRef(null);

  useEffect(() => {
    if (!isHydrated) return;
    const ids = Object.keys(badges);
    // İlk yüklemede mevcut rozetleri "bilinen" say; sonra gelen yeniler kutlanır
    if (known.current === null) {
      known.current = new Set(ids);
      return;
    }
    const fresh = ids.find((id) => !known.current.has(id));
    ids.forEach((id) => known.current.add(id));
    const data = fresh && BADGES.find((b) => b.id === fresh);
    if (!data) return;
    // Su ekleme animasyonu bitsin diye kısa gecikme
    setTimeout(() => {
      setBadge(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      try {
        player.seekTo(0);
        player.play();
      } catch {}
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    }, 700);
  }, [badges, isHydrated]);

  if (!badge) return null;
  const tint = badgeTint(badge.id, dark);
  const { width } = Dimensions.get('window');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setBadge(null)}>
      <View style={[styles.overlay, { backgroundColor: c.overlay }]}>
        <ConfettiCannon count={120} origin={{ x: width / 2, y: -20 }} fadeOut autoStart explosionSpeed={320} fallSpeed={2600} />
        <Animated.View style={[styles.card, { backgroundColor: c.card, transform: [{ scale }] }]}>
          <View style={[styles.icon, { backgroundColor: tint.bg }]}>
            <Ionicons name={badge.icon} size={52} color={tint.fg} />
          </View>
          <Text style={[type.overline, { color: c.accentInk }]}>{upper(t('badges.congrats'))}</Text>
          <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{t(badge.titleKey)}</Text>
          <Text style={[type.body, { color: c.ink2, textAlign: 'center', fontSize: 15 }]}>{t(badge.descriptionKey)}</Text>
          <TouchableOpacity onPress={() => setBadge(null)} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 17 }]}>{t('badges.awesome')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 340, borderRadius: 28, padding: 24, alignItems: 'center', gap: 10 },
  icon: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cta: { alignSelf: 'stretch', marginTop: 10, borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
});

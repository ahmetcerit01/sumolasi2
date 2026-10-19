import React, { useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Mascot from '../components/Mascot';
import { BADGES } from '../constants/badges';
import { badgeTint, lockedTint } from '../constants/badgeStyle';
import { useHydrationStore } from '../storage/useHydrationStore';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtLongDate } from '../utils/format';
import AdBanner from '../ads/AdBanner';

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, radius, dark } = useTheme();
  const earned = useHydrationStore((s) => s.badges) || {};
  const [selected, setSelected] = useState(null);

  const earnedCount = BADGES.filter((b) => earned[b.id]).length;
  const level = Math.floor(earnedCount / 3) + 1;
  const next = BADGES.find((b) => !earned[b.id]);
  const allDone = !next;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 22, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.title, { color: c.ink }]}>{t('badges.title')}</Text>

        <View style={[styles.levelCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          <Mascot mood={allDone ? 'celebrate' : 'happy'} size={72} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.section, { color: c.ink }]}>{t('badges.levelLine', { level, count: earnedCount, total: BADGES.length })}</Text>
            <View style={[styles.track, { backgroundColor: c.chip }]}>
              <View style={[styles.fill, { width: `${(earnedCount / BADGES.length) * 100}%`, backgroundColor: c.accent }]} />
            </View>
            <Text style={[type.label, { color: c.ink2 }]} numberOfLines={2}>
              {allDone ? t('badges.motivationComplete') : t('badges.nextLine', { name: t(next.titleKey) })}
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          {BADGES.map((b) => {
            const on = !!earned[b.id];
            const tint = on ? badgeTint(b.id, dark) : lockedTint(dark);
            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.8}
                onPress={() => setSelected(b)}
                accessibilityRole="button"
                accessibilityLabel={`${t(b.titleKey)}, ${on ? t('badges.earned') : t('badges.locked')}`}
                style={[styles.tile, { backgroundColor: c.card, borderRadius: radius.tile }, cardShadow(c)]}
              >
                <View style={[styles.iconCircle, { backgroundColor: tint.bg }]}>
                  <Ionicons name={on ? b.icon : 'lock-closed'} size={on ? 26 : 20} color={tint.fg} />
                </View>
                <Text style={[type.labelStrong, { color: on ? c.ink : c.ink2, textAlign: 'center' }]} numberOfLines={2}>
                  {t(b.titleKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Premium olmayanlara küçük banner */}
        <AdBanner />
      </ScrollView>

      {/* rozet detayı */}
      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={[styles.overlay, { backgroundColor: c.overlay }]} onPress={() => setSelected(null)}>
          {selected && (() => {
            const on = !!earned[selected.id];
            const tint = on ? badgeTint(selected.id, dark) : lockedTint(dark);
            return (
              <Pressable style={[styles.detail, { backgroundColor: c.card }]} onPress={() => {}}>
                <View style={[styles.bigIcon, { backgroundColor: tint.bg }]}>
                  <Ionicons name={on ? selected.icon : 'lock-closed'} size={on ? 48 : 36} color={tint.fg} />
                </View>
                <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{t(selected.titleKey)}</Text>
                <View style={[styles.statusChip, { backgroundColor: on ? c.successBg : c.track }]}>
                  <Text style={[type.labelStrong, { color: on ? c.successInk : c.ink2 }]}>
                    {on ? `${t('badges.earned')} · ${fmtLongDate(new Date(earned[selected.id]))}` : t('badges.locked')}
                  </Text>
                </View>
                <Text style={[type.body, { color: c.ink2, textAlign: 'center', fontSize: 15 }]}>{t(selected.descriptionKey)}</Text>
                <View style={[styles.howTo, { backgroundColor: c.cardAlt }]}>
                  <Ionicons name="flag-outline" size={16} color={c.accentInk} />
                  <Text style={[type.label, { color: c.ink, flex: 1, fontSize: 14 }]}>{t(selected.howToEarnKey)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={[styles.close, { backgroundColor: c.chip }]} accessibilityRole="button">
                  <Text style={[type.bodyStrong, { color: c.chipInk }]}>{t('common.close')}</Text>
                </TouchableOpacity>
              </Pressable>
            );
          })()}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  track: { height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '30.9%', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 6 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  detail: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 24, alignItems: 'center', gap: 12 },
  bigIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  statusChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  howTo: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 14, padding: 12, alignSelf: 'stretch' },
  close: { alignSelf: 'stretch', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
});

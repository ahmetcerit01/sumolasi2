import React, { useCallback, useContext, useRef, useState } from 'react';
import { Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useHydrationStore } from '../storage/useHydrationStore';
import { DEFAULT_GOAL } from '../utils/goal';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtLiters, fmtNumber } from '../utils/format';
import AdBanner from '../ads/AdBanner';
import { maybeShowInterstitial } from '../ads/ads';

const CHART_H = 180;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const [range, setRange] = useState('week');

  const goal = useHydrationStore((s) => s.goalMl) || DEFAULT_GOAL;
  const days = useHydrationStore((s) => s.getDays(range === 'week' ? 7 : 30));
  const streakDays = useHydrationStore((s) => s.streakDays) || 0;
  const longest = useHydrationStore((s) => s.getLongestStreak());
  const totalToday = useHydrationStore((s) => s.totalMl) || 0;

  // Ekrana her gelişte çubuklar sıfırdan büyüsün
  const grow = useRef(new Animated.Value(0)).current;
  useFocusEffect(
    useCallback(() => {
      grow.setValue(0);
      Animated.spring(grow, { toValue: 1, damping: 16, stiffness: 90, useNativeDriver: false }).start();
    }, [range])
  );
  // Geçmiş'ten çıkış doğal bir duraklama: geçiş reklamı yalnızca burada ve seyrek (sınır ads.js'te).
  // Hafta/ay geçişi tetiklemesin diye ayrı ve bağımlılıksız.
  useFocusEffect(
    useCallback(() => () => {
      maybeShowInterstitial();
    }, [])
  );

  const tracked = days.filter((d) => d.isTracked);
  const avg = tracked.length ? tracked.reduce((a, d) => a + (d.ml || 0), 0) / tracked.length : 0;
  const metCount = tracked.filter((d) => d.ml > 0 && d.ml >= (d.goal || goal)).length;
  const currentStreak = streakDays + (totalToday >= goal ? 1 : 0);
  const max = Math.max(goal * 1.35, ...days.map((d) => d.ml || 0));
  const goalY = (goal / max) * CHART_H;

  const recent = days.slice(-7).reverse();
  const dayName = (d, i) => (i === 0 ? t('home.today') : t(`days.long.${d.dayIndex}`));

  const Stat = ({ value, label }) => (
    <View style={[styles.stat, { backgroundColor: c.card, borderRadius: 18 }, cardShadow(c)]}>
      <Text style={[type.heading, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[type.caption, { color: c.ink2 }]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 22, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[type.title, { color: c.ink }]}>{t('history.title')}</Text>
          <View style={[styles.segment, { backgroundColor: c.track }]}>
            {['week', 'month'].map((r) => {
              const on = r === range;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRange(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.segBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                >
                  <Text style={[on ? type.labelStrong : type.label, { fontSize: 14, color: on ? c.ink : c.ink2 }]}>
                    {r === 'week' ? t('history.week') : t('history.month')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat value={fmtLiters(avg)} label={t('history.dailyAvg')} />
          <Stat value={`${metCount}/${tracked.length || days.length}`} label={t('history.goalDays')} />
          <Stat value={`${Math.max(currentStreak, longest)}`} label={t('history.bestStreak')} />
        </View>

        <View style={[styles.chartCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          <View style={styles.chartHeader}>
            <Text style={[type.section, { color: c.ink }]}>{range === 'week' ? t('history.thisWeek') : t('history.last30')}</Text>
            <View style={styles.legend}>
              <View style={[styles.legendDash, { borderColor: c.ink3 }]} />
              <Text style={[type.caption, { color: c.ink2 }]}>{t('history.goalLabel', { goal: fmtNumber(goal) })}</Text>
            </View>
          </View>

          <View style={{ height: CHART_H }}>
            <View style={[styles.goalLine, { bottom: goalY, borderColor: c.divider }]} />
            <View style={[styles.bars, { gap: range === 'week' ? 10 : 3 }]}>
              {days.map((d) => {
                const h = Math.max(((d.ml || 0) / max) * CHART_H, d.ml > 0 ? 6 : 4);
                const met = d.ml > 0 && d.ml >= (d.goal || goal);
                const color = d.isToday ? c.accent : met ? c.barGoal : c.barMuted;
                return (
                  <View key={d.fullDate} style={styles.barSlot} accessible accessibilityLabel={`${d.fullDate}: ${fmtNumber(d.ml)} ml`}>
                    <Animated.View
                      style={{
                        width: '100%',
                        maxWidth: range === 'week' ? 30 : 8,
                        height: grow.interpolate({ inputRange: [0, 1], outputRange: [4, h] }),
                        borderRadius: range === 'week' ? 10 : 4,
                        backgroundColor: color,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={[styles.labels, { gap: range === 'week' ? 10 : 3 }]}>
            {days.map((d, i) => (
              <Text
                key={d.fullDate}
                style={[type.caption, styles.dayLabel, { color: d.isToday ? c.accentInk : c.ink2 }]}
                numberOfLines={1}
              >
                {range === 'week' ? t(`days.short.${d.dayIndex}`) : (i % 5 === 4 || d.isToday ? String(d.date) : '')}
              </Text>
            ))}
          </View>
        </View>

        <View style={[styles.listCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          {recent.map((d, i) => {
            const met = d.ml > 0 && d.ml >= (d.goal || goal);
            return (
              <View key={d.fullDate} style={[styles.listRow, i < recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.divider }]}>
                <View style={{ gap: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{dayName(d, i)}</Text>
                  <Text style={[type.label, { color: met ? c.successInk : c.ink2 }]}>
                    {met ? t('history.goalMet') : d.ml > 0 ? t('history.entriesCount', { count: d.count || 0 }) : t('history.noData')}
                  </Text>
                </View>
                <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{`${fmtNumber(d.ml)} ml`}</Text>
              </View>
            );
          })}
        </View>

        {/* Premium olmayanlara küçük banner */}
        <AdBanner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, minHeight: 34, justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, gap: 2 },
  chartCard: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDash: { width: 14, borderTopWidth: 2, borderStyle: 'dashed' },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  labels: { flexDirection: 'row' },
  dayLabel: { flex: 1, textAlign: 'center' },
  listCard: { paddingHorizontal: 16, paddingVertical: 4 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
});

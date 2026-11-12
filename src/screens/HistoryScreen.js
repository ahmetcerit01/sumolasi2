import React, { useCallback, useContext, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useHydrationStore } from '../storage/useHydrationStore';
import { DEFAULT_GOAL } from '../utils/goal';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtLiters, fmtNumber } from '../utils/format';
import { summarizeHistory } from '../utils/historyAnalytics';
import AdBanner from '../ads/AdBanner';
import { maybeShowInterstitial } from '../ads/ads';

const CHART_H = 180;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const [range, setRange] = useState('week');
  const [selectedDate, setSelectedDate] = useState(null);
  const removeEntry = useHydrationStore((s) => s.removeEntry);
  const confirmRemove = (day, entry) => Alert.alert(t('history.removeTitle'), t('history.removeMessage'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('history.remove'), style: 'destructive', onPress: () => removeEntry(day, entry.id).catch(() => Alert.alert(t('alert.error'), t('profile.saveError'))) },
  ]);

  const goal = useHydrationStore((s) => s.goalMl) || DEFAULT_GOAL;
  const period = range === 'week' ? 7 : 30;
  const allDays = useHydrationStore((s) => s.getDays(period * 2));
  const days = allDays.slice(-period);
  const previousDays = allDays.slice(0, period);
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

  const analytics = summarizeHistory(days, previousDays);
  const currentStreak = streakDays + (totalToday >= goal ? 1 : 0);
  const max = Math.max(goal * 1.35, ...days.map((d) => d.ml || 0));
  const goalY = (goal / max) * CHART_H;

  const recent = days.filter((d) => d.isTracked).reverse();
  const dayName = (d) => d.isToday ? t('home.today') : t(`days.long.${d.dayIndex}`);
  const shortDate = (d) => `${d.fullDate.slice(8, 10)}.${d.fullDate.slice(5, 7)}`;

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
          <Stat value={fmtLiters(analytics.currentAverage)} label={t('history.dailyAvg')} />
          <Stat value={`${analytics.goalDays}/${analytics.completedCount}`} label={t('history.goalDays')} />
          <Stat value={`${Math.max(currentStreak, longest)}`} label={t('history.bestStreak')} />
        </View>

        <View style={[styles.insightCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          <Text style={[type.section, { color: c.ink }]}>{t('history.analysis')}</Text>
          <View style={styles.insightRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.heading, { color: c.ink }]}>{fmtLiters(analytics.total)}</Text>
              <Text style={[type.caption, { color: c.ink2 }]}>{t('history.periodTotal')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.heading, { color: analytics.trendPercent == null ? c.ink2 : analytics.trendPercent >= 0 ? c.successInk : c.ink }]}>
                {analytics.trendPercent == null ? '—' : `${analytics.trendPercent > 0 ? '+' : ''}${analytics.trendPercent}%`}
              </Text>
              <Text style={[type.caption, { color: c.ink2 }]}>{t('history.vsPrevious')}</Text>
            </View>
          </View>
          <Text style={[type.caption, { color: c.ink2 }]}>{t('history.completedDaysOnly')}</Text>
          {analytics.completedCount > 0 && (
            <>
              <View style={[styles.distribution, { backgroundColor: c.track }]}>
                {[
                  [analytics.goalDays, c.success],
                  [analytics.closeDays, c.accent],
                  [analytics.lowDays, c.barMuted],
                  [analytics.emptyDays, c.divider],
                ].filter(([count]) => count > 0).map(([count, color], index) => <View key={index} style={{ flex: count, backgroundColor: color }} />)}
              </View>
              <Text style={[type.label, { color: c.ink2 }]}>
                {t('history.distribution', { met: analytics.goalDays, close: analytics.closeDays, low: analytics.lowDays, empty: analytics.emptyDays })}
              </Text>
            </>
          )}
        </View>

        {analytics.shifts.length > 0 && (
          <View style={[styles.insightCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
            <Text style={[type.section, { color: c.ink }]}>{t('history.shiftAnalysis')}</Text>
            {analytics.shifts.map((shift) => (
              <View key={shift.mode} style={styles.shiftRow}>
                <Text style={[type.bodyStrong, { color: c.ink }]}>{t(`shift.${shift.mode}`)}</Text>
                <Text style={[type.label, { color: c.ink2 }]}>{t('history.shiftResult', { average: fmtLiters(shift.average), met: shift.goalDays, days: shift.days })}</Text>
              </View>
            ))}
            <Text style={[type.caption, { color: c.ink2 }]}>{t('history.shiftRecordedOnly')}</Text>
          </View>
        )}

        <View style={[styles.chartCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          <View style={styles.chartHeader}>
            <Text style={[type.section, { color: c.ink }]}>{range === 'week' ? t('history.last7') : t('history.last30')}</Text>
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

        <Text style={[type.section, { color: c.ink }]}>{t('history.dayByDay')}</Text>
        <View style={[styles.listCard, { backgroundColor: c.card, borderRadius: radius.cardLg }, cardShadow(c)]}>
          {recent.map((d, i) => {
            const met = d.ml > 0 && d.ml >= (d.goal || goal);
            const isSelected = selectedDate === d.fullDate;
            const percent = Math.round((d.ml || 0) / Math.max(d.goal || goal, 1) * 100);
            return (
              <React.Fragment key={d.fullDate}>
              <TouchableOpacity onPress={() => setSelectedDate(isSelected ? null : d.fullDate)} accessibilityRole="button" accessibilityState={{ selected: isSelected }} style={[styles.listRow, i < recent.length - 1 && !isSelected && { borderBottomWidth: 1, borderBottomColor: c.divider }]}>
                <View style={{ gap: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{`${dayName(d)} · ${shortDate(d)}`}</Text>
                  <Text style={[type.label, { color: met ? c.successInk : c.ink2 }]}>
                    {met ? t('history.goalMet') : d.ml > 0 ? t('history.entriesCount', { count: d.count || 0 }) : t('history.noData')}
                  </Text>
                </View>
                <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15 }]}>{`${fmtNumber(d.ml)} ml  ${isSelected ? '⌃' : '⌄'}`}</Text>
              </TouchableOpacity>
              {isSelected && (
                <View style={[styles.inlineDetail, { borderTopColor: c.divider, borderBottomColor: c.divider }]}>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{`${fmtNumber(d.ml)} / ${fmtNumber(d.goal || goal)} ml · ${percent}%`}</Text>
                  <View style={[styles.detailTrack, { backgroundColor: c.track }]}><View style={{ width: `${Math.min(percent, 100)}%`, height: '100%', borderRadius: 6, backgroundColor: c.accent }} /></View>
                  <Text style={[type.label, { color: c.ink2 }]}>{t('history.entriesCount', { count: d.count || 0 })}</Text>
                  {(d.entries || []).map((entry) => (
                    <View key={entry.id} style={styles.shiftRow}>
                      <Text style={[type.label, { color: c.ink2 }]}>{new Date(entry.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
                      <Text style={[type.bodyStrong, { color: c.ink }]}>{`${fmtNumber(entry.ml)} ml`}</Text>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('history.remove')} onPress={() => confirmRemove(d.fullDate, entry)} style={{ padding: 12 }}><Text style={[type.labelStrong, { color: c.accentInk }]}>{t('history.remove')}</Text></TouchableOpacity>
                    </View>
                  ))}
                  {!d.isToday && !d.entries?.length && <Text style={[type.caption, { color: c.ink2 }]}>{t('history.pastDaySummary')}</Text>}
                </View>
              )}
              </React.Fragment>
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
  insightCard: { padding: 18, gap: 12 },
  insightRow: { flexDirection: 'row', gap: 12 },
  distribution: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row' },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  detailTrack: { height: 10, borderRadius: 6, overflow: 'hidden' },
  inlineDetail: { paddingVertical: 13, gap: 9, borderTopWidth: 1, borderBottomWidth: 1 },
});

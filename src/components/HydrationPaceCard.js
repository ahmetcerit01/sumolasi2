import React, { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';
import { getHydrationPace } from '../utils/hydrationPace';
import { getEffectiveShiftStart, getShiftForDate } from '../utils/shiftSchedule';

export default function HydrationPaceCard({ now, waterDayKey, shiftSchedule, profile, goalMl, totalMl, style }) {
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const date = waterDayKey ? new Date(`${waterDayKey}T12:00:00`) : new Date();
  const shift = shiftSchedule?.enabled ? getShiftForDate(shiftSchedule, date) : profile;
  const startAt = shiftSchedule?.enabled ? getEffectiveShiftStart(shiftSchedule, date) : null;
  const pace = getHydrationPace({ now, waterDayKey, wakeAt: shift?.wakeAt, sleepAt: shift?.sleepAt, startAt, goalMl, totalMl });
  if (!pace) return null;
  const isOnPace = totalMl >= pace.plannedMl;
  const detail = pace.phase === 'before' ? t('pace.before')
    : pace.phase === 'after' ? t('pace.after')
      : isOnPace ? t('pace.onTrack') : t('pace.plannedNow', { amount: fmtNumber(pace.plannedMl) });

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c), style]}>
      <View style={styles.header}>
        <Text style={[type.section, { color: c.ink }]}>{t('pace.title')}</Text>
        <Text style={[type.caption, { color: c.ink2 }]}>
          {shiftSchedule?.enabled && shift?.mode ? `${t(`shift.${shift.mode}`)} · ` : profile?.workStyle === 'office' ? `${t('onboard.flow.rhythm.work.office')} · ` : ''}
          {startAt ? `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}` : shift?.wakeAt || '08:00'}–{shift?.sleepAt || '23:00'}
        </Text>
      </View>
      <Text style={[type.label, { color: c.ink2 }]}>{detail}</Text>
      <View style={styles.barRow}>
        <Text style={[type.caption, styles.barLabel, { color: c.ink2 }]}>{t('pace.plan')}</Text>
        <View style={[styles.barTrack, { backgroundColor: c.track }]}><View style={[styles.barFill, { width: `${pace.plannedFraction * 100}%`, backgroundColor: c.barMuted }]} /></View>
        <Text style={[type.caption, { color: c.ink2 }]}>{fmtNumber(pace.plannedMl)}</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={[type.caption, styles.barLabel, { color: c.ink2 }]}>{t('pace.actual')}</Text>
        <View style={[styles.barTrack, { backgroundColor: c.track }]}><View style={[styles.barFill, { width: `${pace.actualFraction * 100}%`, backgroundColor: c.accent }]} /></View>
        <Text style={[type.caption, { color: c.ink2 }]}>{fmtNumber(totalMl)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 9 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 48 },
  barTrack: { flex: 1, height: 8, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
});

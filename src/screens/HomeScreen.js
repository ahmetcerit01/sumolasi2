import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import SkiaGlass from '../components/SkiaGlass';
import { QuickAddRow } from '../components/QuickAdd';
import { quickLabel, useQuickAdds } from '../storage/quickAdds';
import MedsCard from '../components/MedsCard';
import { useHydrationStore } from '../storage/useHydrationStore';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtLongDate, fmtNumber, fmtTime } from '../utils/format';
import { computeReminderTimes, getReminderSettings } from '../utils/reminders';
import { useWaterAdd } from '../hooks/useWaterAdd';
import AdBanner from '../ads/AdBanner';
import DamlaTip from '../components/DamlaTip';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GLASS_W = 236;
const GLASS_H = 300;

const SIRI_TIP_KEY = 'TIP_SIRI_SEEN';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();

  const totalMl = useHydrationStore((s) => s.totalMl) || 0;
  const goalMl = useHydrationStore((s) => s.goalMl) || 2500;
  const streakDays = useHydrationStore((s) => s.streakDays) || 0;
  const entries = useHydrationStore((s) => s.entries) || [];
  const profile = useHydrationStore((s) => s.profile);
  const quickAdds = useQuickAdds();

  // Siri ipucu: ilk açılışta onboarding/Premium önerisi, ikincide reklam izni var;
  // çakışmasın diye üçüncü açılışta, bir kez
  const [siriTip, setSiriTip] = useState(false);
  useEffect(() => {
    let timer;
    AsyncStorage.multiGet(['APP_LAUNCHES', SIRI_TIP_KEY]).then(([[, launches], [, seen]]) => {
      if (Number(launches) >= 3 && seen !== '1') timer = setTimeout(() => setSiriTip(true), 1500);
    });
    return () => clearTimeout(timer);
  }, []);
  const closeSiriTip = () => {
    setSiriTip(false);
    AsyncStorage.setItem(SIRI_TIP_KEY, '1').catch(() => {});
  };
  const undoLast = useHydrationStore((s) => s.undoLast);

  const { addWater, addSignal } = useWaterAdd();

  const progress = totalMl / Math.max(goalMl, 1);
  const pct = Math.min(Math.round(progress * 100), 999);
  const done = totalMl >= goalMl;
  // Su seviyesi yazının hizasına çıkınca yazı beyaza döner (mavi üstünde okunaklı kalsın)
  const overWater = progress > 0.5;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodDay') : t('home.goodEvening');

  // Sıradaki hatırlatma: ayarlardan (aralık, açık/kapalı) ve profil saatlerinden hesaplanır
  const [reminder, setReminder] = useState({ enabled: true, intervalHours: 2 });
  useFocusEffect(
    React.useCallback(() => {
      getReminderSettings().then(setReminder).catch(() => {});
    }, [])
  );
  const nextReminder = useMemo(() => {
    if (!reminder.enabled) return null;
    const times = computeReminderTimes(profile?.wakeAt, profile?.sleepAt, reminder.intervalHours);
    if (!times.length) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const next = times.find((x) => x.hour * 60 + x.minute > nowMin) || times[0];
    const d = new Date();
    d.setHours(next.hour, next.minute, 0, 0);
    return fmtTime(d);
  }, [reminder, profile?.wakeAt, profile?.sleepAt]);

  const recent = entries.slice(-3).reverse();
  // Profil'den özelleştirilebilen hızlı ekleme butonları
  const quick = quickAdds.map((q) => ({ key: q.id, ml: q.ml, label: quickLabel(q, t), icon: q.icon }));

  const onUndo = async () => {
    const ok = await undoLast();
    if (ok) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* üst bölüm */}
        <View style={styles.header}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>{fmtLongDate()}</Text>
            <Text style={[type.title, { color: c.ink }]}>{greeting}</Text>
          </View>
          {streakDays > 0 && (
            <View style={[styles.chip, { backgroundColor: c.chip }]}>
              <Ionicons name="water" size={15} color={c.chipInk} />
              <Text style={[type.labelStrong, { color: c.chipInk, fontSize: 14 }]}>
                {t('home.streakChip', { count: streakDays, days: streakDays })}
              </Text>
            </View>
          )}
        </View>

        {/* kahraman: fizikli bardak + sayı */}
        <View style={styles.glassWrap} accessible accessibilityLabel={`${fmtNumber(totalMl)} / ${fmtNumber(goalMl)} ml`}>
          <SkiaGlass width={GLASS_W} height={GLASS_H} progress={progress} addSignal={addSignal} colors={c} />
          <View style={styles.glassLabel} pointerEvents="none">
            <Text style={[type.display, { color: overWater ? '#FFFFFF' : c.ink }]}>{fmtNumber(totalMl)}</Text>
            <Text style={[type.bodyStrong, { color: overWater ? 'rgba(255,255,255,0.85)' : c.ink2 }]}>
              {t('home.ofGoal', { goal: `${fmtNumber(goalMl)} ml` })}
            </Text>
          </View>
        </View>

        {/* durum satırı */}
        <View style={styles.statusRow}>
          <View style={[styles.chip, { backgroundColor: done ? c.successBg : c.chip }]}>
            {done && <Ionicons name="checkmark-circle" size={15} color={c.successInk} />}
            <Text style={[type.labelStrong, { fontSize: 14, color: done ? c.successInk : c.chipInk }]}>
              {done ? t('home.goalDone') : t('home.doneChip', { pct })}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: c.card }, cardShadow(c)]}>
            <Ionicons name={nextReminder ? 'alarm-outline' : 'notifications-off-outline'} size={15} color={c.ink2} />
            <Text style={[type.label, { fontSize: 14, color: c.ink2 }]}>
              {nextReminder ? t('home.nextReminder', { time: nextReminder }) : t('home.remindersOff')}
            </Text>
          </View>
        </View>

        {/* hızlı ekle */}
        <QuickAddRow items={quick} onAdd={addWater} style={{ marginTop: 22, marginHorizontal: 22 }} />

        {/* vitamin & ilaç */}
        <MedsCard style={{ marginTop: 18, marginHorizontal: 22 }} />

        {/* bugün */}
        <View style={[styles.todayCard, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c)]}>
          <View style={styles.todayHeader}>
            <Text style={[type.section, { color: c.ink }]}>{t('home.today')}</Text>
            {entries.length > 0 && (
              <TouchableOpacity onPress={onUndo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
                <Text style={[type.labelStrong, { color: c.accentInk }]}>{t('home.undo')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {recent.length === 0 ? (
            <Text style={[type.label, { color: c.ink2, fontSize: 15 }]}>
              {totalMl > 0 ? t('home.todayTotal', { amount: `${fmtNumber(totalMl)} ml` }) : t('home.noEntries')}
            </Text>
          ) : (
            recent.map((e) => (
              <View key={e.id} style={styles.entryRow}>
                <Text style={[type.body, { color: c.ink2, fontSize: 15 }]}>{fmtTime(new Date(e.at))}</Text>
                <Text style={[type.body, { color: c.ink, fontSize: 15 }]}>{`${fmtNumber(e.ml)} ml`}</Text>
              </View>
            ))
          )}
        </View>

        {/* Premium olmayanlara küçük banner */}
        <AdBanner style={{ marginHorizontal: 22, marginTop: 16 }} />
      </ScrollView>

      {/* Damla'nın Siri ipucu: 3. açılışta bir kez */}
      <DamlaTip visible={siriTip} onClose={closeSiriTip} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  glassWrap: { alignSelf: 'center', marginTop: 18, width: GLASS_W, height: GLASS_H + 2 },
  glassLabel: { position: 'absolute', left: 0, right: 0, top: 70, alignItems: 'center', gap: 2 },
  statusRow: { marginTop: 14, marginHorizontal: 22, flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  todayCard: { marginTop: 18, marginHorizontal: 22, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

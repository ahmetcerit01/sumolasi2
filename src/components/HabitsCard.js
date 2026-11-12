import React, { useContext } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { usePremium } from '../premium/PremiumProvider';
import { usePaywall } from '../premium/Paywall';
import { useHydrationStore } from '../storage/useHydrationStore';
import { useHabitsStore } from '../storage/useHabitsStore';
import { upper } from '../utils/format';

export default function HabitsCard({ style }) {
  const navigation = useNavigation();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const { isPremium } = usePremium();
  const { open: openPaywall } = usePaywall();
  const habits = useHabitsStore((state) => state.habits);
  const completed = useHabitsStore((state) => state.completed);
  const currentWaterDay = useHydrationStore((state) => state.lastDate);
  const done = (completed[currentWaterDay] || []).filter((id) => habits.some((habit) => habit.id === id)).length;
  const title = isPremium ? t('habits.homeTitle') : t('habits.premiumShort');
  const subtitle = !isPremium
    ? t('habits.homeLocked')
    : habits.length
      ? t('habits.progress', { done, total: habits.length })
      : t('habits.homeEmpty');

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => (isPremium ? navigation.navigate('Habits') : openPaywall(() => navigation.navigate('Habits')))}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c), style]}
    >
      <View style={[styles.icon, { backgroundColor: c.chip }]}><Ionicons name={isPremium ? 'sparkles-outline' : 'lock-closed-outline'} size={20} color={c.chipInk} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.overline, { color: c.ink2, fontSize: 11 }]}>{upper(title)}</Text>
        <Text style={[type.bodyStrong, { color: c.ink }]} numberOfLines={1}>{subtitle}</Text>
        {isPremium && habits.length > 0 && <Text style={[type.label, { color: c.ink2 }]}>{t('habits.customCount', { count: habits.length })}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.ink3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

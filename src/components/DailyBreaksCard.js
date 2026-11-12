import React, { useContext } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext } from '../i18n';
import { useTheme, cardShadow } from '../theme/theme';
import { useHydrationStore } from '../storage/useHydrationStore';
import { BREAKS, useDailyRoutineStore } from '../storage/useDailyRoutineStore';

export default function DailyBreaksCard({ style }) {
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const day = useHydrationStore((state) => state.lastDate);
  const { breaks, toggleBreak } = useDailyRoutineStore();
  const done = breaks[day] || [];
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 10 }, cardShadow(c), style]}>
      <Text style={[type.section, { color: c.ink }]}>{t('dailyBreaks.title')}</Text>
      <Text style={[type.label, { color: c.ink2 }]}>{t('dailyBreaks.subtitle')}</Text>
      {BREAKS.map((id) => <TouchableOpacity
        key={id} accessibilityRole="checkbox" accessibilityState={{ checked: done.includes(id) }}
        accessibilityLabel={t(`dailyBreaks.${id}`)}
        onPress={() => toggleBreak(id).catch(() => Alert.alert(t('alert.error'), t('profile.saveError')))}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        <Ionicons name={done.includes(id) ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done.includes(id) ? c.success : c.ink3} />
        <Text style={[type.body, { flex: 1, color: c.ink }]}>{t(`dailyBreaks.${id}`)}</Text>
      </TouchableOpacity>)}
      <Text style={[type.caption, { color: c.ink2 }]}>{t('dailyBreaks.hint')}</Text>
    </View>
  );
}

import React, { useContext } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { todayDoses, useMedsStore } from '../storage/useMedsStore';
import { upper } from '../utils/format';

// Ana Sayfa: Vitamin & İlaç özeti. Dokununca Vitamin ekranı açılır.
export default function MedsCard({ style }) {
  const navigation = useNavigation();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const meds = useMedsStore((s) => s.meds);
  const log = useMedsStore((s) => s.log);

  const doses = todayDoses(meds, log);
  const taken = doses.filter((d) => d.taken).length;
  const next = doses.find((d) => !d.taken);
  const allDone = doses.length > 0 && !next;

  const title = meds.length === 0 ? t('meds.cardEmptyTitle') : allDone ? t('meds.cardDone') : t('meds.cardNext', { name: next.med.name, time: next.time });
  const subtitle = meds.length === 0 ? t('meds.cardEmptySub') : t('meds.progress', { taken, total: doses.length });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('Meds')}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c), style]}
    >
      <View style={[styles.icon, { backgroundColor: allDone ? c.successBg : c.chip }]}>
        <Ionicons name={allDone ? 'checkmark' : 'medkit-outline'} size={20} color={allDone ? c.successInk : c.chipInk} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.overline, { color: c.ink2, fontSize: 11 }]}>{upper(t('meds.title'))}</Text>
        <Text style={[type.bodyStrong, { color: c.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[type.label, { color: c.ink2 }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.ink3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

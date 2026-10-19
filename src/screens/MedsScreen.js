import React, { useContext, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';

import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { todayDoses, useMedsStore, weekAdherence } from '../storage/useMedsStore';
import { usePremium } from '../premium/PremiumProvider';
import { usePaywall } from '../premium/Paywall';

// Vitamin ve ilaç hatırlatıcıları tamamen Premium'a özel (ücretsiz sürümde eklenemez)
export const FREE_MED_LIMIT = 0;
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromHHMM = (s) => {
  const [h, m] = s.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

export const medIcon = (kind) => (kind === 'vitamin' ? 'sunny-outline' : 'medkit-outline');

// Ekle / düzenle sayfası
function MedEditSheet({ visible, med, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, dark } = useTheme();
  const { addMed, updateMed, removeMed } = useMedsStore.getState();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('vitamin');
  const [times, setTimes] = useState(['09:00']);
  const [editing, setEditing] = useState(null); // düzenlenen saatin indeksi
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(med?.name || '');
    setKind(med?.kind || 'vitamin');
    setTimes(med?.times?.length ? med.times : ['09:00']);
    setEditing(null);
  }, [visible, med]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert(t('alert.error'), t('meds.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      if (med) await updateMed(med.id, { name, kind, times });
      else await addMed({ name, kind, times });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert(t('meds.deleteTitle'), t('meds.deleteMsg', { name: med.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('meds.delete'),
        style: 'destructive',
        onPress: async () => {
          await removeMed(med.id);
          onClose();
        },
      },
    ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[type.heading, { color: c.ink }]}>{med ? t('meds.editTitle') : t('meds.addTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('meds.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('meds.namePlaceholder')}
              placeholderTextColor={c.ink3}
              maxLength={40}
              style={[styles.input, type.bodyStrong, { color: c.ink, backgroundColor: c.cardAlt }]}
              accessibilityLabel={t('meds.name')}
            />
          </View>

          <View style={[styles.segment, { backgroundColor: c.track }]}>
            {['vitamin', 'pill'].map((k) => {
              const on = k === kind;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.segBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={medIcon(k)} size={16} color={on ? c.accentInk : c.ink2} />
                  <Text style={[on ? type.labelStrong : type.label, { fontSize: 14, color: on ? c.ink : c.ink2 }]}>{t(`meds.kind.${k}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('meds.times')}</Text>
            <View style={styles.timesRow}>
              {times.map((tm, i) => (
                <View key={`${tm}-${i}`} style={[styles.timeChip, { backgroundColor: editing === i ? c.chip : c.cardAlt, borderColor: editing === i ? c.accent : 'transparent' }]}>
                  <TouchableOpacity onPress={() => setEditing(editing === i ? null : i)} accessibilityRole="button" accessibilityLabel={`${t('meds.time')} ${tm}`}>
                    <Text style={[type.bodyStrong, { color: c.ink }]}>{tm}</Text>
                  </TouchableOpacity>
                  {times.length > 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        setTimes(times.filter((_, j) => j !== i));
                        setEditing(null);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={t('meds.removeTime')}
                    >
                      <Ionicons name="close-circle" size={18} color={c.ink3} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {times.length < 4 && (
                <TouchableOpacity
                  onPress={() => {
                    setTimes([...times, '21:00']);
                    setEditing(times.length);
                  }}
                  style={[styles.timeChip, { backgroundColor: c.cardAlt, borderColor: 'transparent' }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="add" size={18} color={c.accentInk} />
                  <Text style={[type.labelStrong, { color: c.accentInk }]}>{t('meds.addTime')}</Text>
                </TouchableOpacity>
              )}
            </View>
            {editing !== null && times[editing] && (
              <DateTimePicker
                value={fromHHMM(times[editing])}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant={dark ? 'dark' : 'light'}
                onValueChange={(e, d) => {
                  if (d) setTimes(times.map((x, j) => (j === editing ? toHHMM(d) : x)));
                  if (Platform.OS !== 'ios') setEditing(null);
                }}
                onDismiss={() => setEditing(null)}
                style={{ height: 140 }}
              />
            )}
          </View>

          <TouchableOpacity onPress={save} disabled={saving} style={[styles.cta, { backgroundColor: c.accent, opacity: saving ? 0.6 : 1 }]} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 17 }]}>{t('meds.save')}</Text>
          </TouchableOpacity>
          {med && (
            <TouchableOpacity onPress={remove} style={{ alignItems: 'center' }} accessibilityRole="button">
              <Text style={[type.labelStrong, { color: '#D64545' }]}>{t('meds.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MedsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const meds = useMedsStore((s) => s.meds);
  const log = useMedsStore((s) => s.log);
  const toggleTaken = useMedsStore((s) => s.toggleTaken);
  const { isPremium } = usePremium();
  const { open: openPaywall } = usePaywall();
  const [sheet, setSheet] = useState({ visible: false, med: null });

  const doses = todayDoses(meds, log);
  const takenCount = doses.filter((d) => d.taken).length;
  const week = weekAdherence(meds, log);
  const locked = !isPremium;

  const onAdd = () => {
    if (locked) {
      openPaywall(() => setSheet({ visible: true, med: null }));
      return;
    }
    setSheet({ visible: true, med: null });
  };

  const dotColor = { all: c.success, some: c.accent, none: c.track, empty: 'transparent' };
  const card = [{ backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c)];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 22, gap: 16 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('meds.back')}>
          <Ionicons name="chevron-back" size={22} color={c.accentInk} />
          <Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('tabs.home')}</Text>
        </TouchableOpacity>
        <Text style={[type.title, { color: c.ink }]}>{t('meds.title')}</Text>

        {/* son 7 gün */}
        {meds.length > 0 && (
          <View style={[styles.weekCard, ...card]}>
            {week.map((d) => (
              <View key={d.day} style={styles.weekDay}>
                <View style={[styles.weekDot, { backgroundColor: dotColor[d.state], borderColor: d.state === 'empty' ? c.divider : 'transparent' }]}>
                  {d.state === 'all' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={[type.caption, { color: c.ink2 }]}>{t(`days.short.${d.dayIndex}`)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* bugün */}
        <View style={[styles.card, ...card]}>
          <View style={styles.cardHeader}>
            <Text style={[type.section, { color: c.ink }]}>{t('home.today')}</Text>
            {doses.length > 0 && <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('meds.progress', { taken: takenCount, total: doses.length })}</Text>}
          </View>
          {doses.length === 0 ? (
            <Text style={[type.label, { color: c.ink2, fontSize: 15 }]}>{t('meds.empty')}</Text>
          ) : (
            doses.map(({ med, time, taken }) => (
              <TouchableOpacity
                key={`${med.id}@${time}`}
                onPress={() => {
                  toggleTaken(med.id, time);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={styles.doseRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: taken }}
                accessibilityLabel={`${med.name} ${time}`}
              >
                <View style={[styles.check, { borderColor: taken ? c.success : c.ink3, backgroundColor: taken ? c.success : 'transparent' }]}>
                  {taken && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: taken ? c.ink2 : c.ink, textDecorationLine: taken ? 'line-through' : 'none' }]}>{med.name}</Text>
                  <Text style={[type.label, { color: c.ink2 }]}>{time}</Text>
                </View>
                <Ionicons name={medIcon(med.kind)} size={20} color={c.ink3} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* liste */}
        {meds.length > 0 && (
          <View style={[styles.card, ...card, { paddingVertical: 4 }]}>
            {meds.map((m, i) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => (locked ? openPaywall() : setSheet({ visible: true, med: m }))}
                style={[styles.medRow, i < meds.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.divider }]}
                accessibilityRole="button"
              >
                <View style={[styles.medIcon, { backgroundColor: c.chip }]}>
                  <Ionicons name={medIcon(m.kind)} size={18} color={c.chipInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: c.ink }]}>{m.name}</Text>
                  <Text style={[type.label, { color: c.ink2 }]}>{m.times.join(' · ')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.ink3} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={onAdd} style={[styles.addBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
          <Ionicons name={locked ? 'lock-closed' : 'add'} size={20} color={c.onAccent} />
          <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 17 }]}>{t('meds.add')}</Text>
        </TouchableOpacity>
        {locked && <Text style={[type.label, { color: c.ink2, textAlign: 'center' }]}>{t('meds.premiumOnly')}</Text>}
      </ScrollView>

      <MedEditSheet visible={sheet.visible} med={sheet.med} onClose={() => setSheet({ visible: false, med: null })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44 },
  weekCard: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
  weekDay: { alignItems: 'center', gap: 6 },
  weekDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  doseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  medIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingVertical: 16 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, gap: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  timesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 2, minHeight: 44 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
});

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
import { usePremium } from '../premium/PremiumProvider';
import { usePaywall } from '../premium/Paywall';
import { useHydrationStore } from '../storage/useHydrationStore';
import { ensureHabitsHydrated, MAX_CUSTOM_HABITS, useHabitsStore } from '../storage/useHabitsStore';

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toHHMM = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const fromHHMM = (value) => {
  const [h, m] = String(value || '09:00').split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
};

function HabitEditSheet({ visible, habit, initialName, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type } = useTheme();
  const { addHabit, updateHabit } = useHabitsStore.getState();
  const [name, setName] = useState('');
  const [time, setTime] = useState('09:00');
  const [timeDraft, setTimeDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(habit?.name || initialName || '');
    setTime(habit?.time || '09:00');
    setTimeDraft(null);
    setPickerOpen(false);
  }, [visible, habit, initialName]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert(t('alert.error'), t('habits.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const saved = habit ? await updateHabit(habit.id, { name, time }) : await addHabit({ name, time });
      if (saved && !saved.notificationIds.length) Alert.alert(t('alert.error'), t('release.noReminder'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (error) {
      Alert.alert(t('alert.error'), t(error?.code === 'notification_capacity' ? 'release.reminderCapacity' : 'release.reminderFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHeader}>
            <Text style={[type.heading, { color: c.ink }]}>{habit ? t('habits.editTitle') : t('habits.addTitle')}</Text>
            <TouchableOpacity onPress={onClose}><Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
          <View style={{ gap: 7 }}>
            <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('habits.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('habits.namePlaceholder')}
              placeholderTextColor={c.ink3}
              maxLength={40}
              style={[styles.input, type.bodyStrong, { color: c.ink, backgroundColor: c.cardAlt }]}
              accessibilityLabel={t('habits.name')}
            />
          </View>
          <View style={{ gap: 7 }}>
            <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('habits.reminderTime')}</Text>
            <TouchableOpacity onPress={() => { setTimeDraft(fromHHMM(time)); setPickerOpen(true); }} style={[styles.timeButton, { backgroundColor: c.cardAlt }]}>
              <Ionicons name="alarm-outline" size={19} color={c.accentInk} />
              <Text style={[type.heading, { color: c.ink }]}>{time}</Text>
              <Ionicons name="chevron-down" size={17} color={c.ink3} />
            </TouchableOpacity>
          </View>
          {pickerOpen && (
            <DateTimePicker
              value={timeDraft || fromHHMM(time)}
              mode="time"
              is24Hour
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onValueChange={(event, date) => {
                if (!date) return;
                setTimeDraft(date);
                if (Platform.OS !== 'ios') {
                  setTime(toHHMM(date));
                  setPickerOpen(false);
                }
              }}
              onDismiss={() => setPickerOpen(false)}
              style={{ height: 145 }}
            />
          )}
          {pickerOpen && Platform.OS === 'ios' && (
            <TouchableOpacity onPress={() => { if (timeDraft) setTime(toHHMM(timeDraft)); setPickerOpen(false); }} style={{ alignItems: 'flex-end' }}>
              <Text style={[type.labelStrong, { color: c.accentInk }]}>{t('common.done')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.cta, { backgroundColor: c.accent, opacity: saving ? 0.6 : 1 }]}>
            <Text style={[type.bodyStrong, { color: c.onAccent }]}>{t('habits.save')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HabitsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();
  const { habits, completed, removeHabit, toggleHabit } = useHabitsStore();
  const today = useHydrationStore((state) => state.lastDate);
  const { isPremium } = usePremium();
  const { open: openPaywall } = usePaywall();
  const [draft, setDraft] = useState({ visible: false, habit: null, initialName: '' });
  const [editIndex, setEditIndex] = useState(null);
  const doneIds = completed[today] || [];
  const doneCount = habits.filter((habit) => doneIds.includes(habit.id)).length;

  const openAdd = async (initialName = '') => {
    if (!isPremium) {
      openPaywall();
      return;
    }
    await ensureHabitsHydrated();
    const currentHabits = useHabitsStore.getState().habits;
    if (currentHabits.length >= MAX_CUSTOM_HABITS) {
      Alert.alert(t('habits.limitTitle'), t('habits.limitMessage', { count: MAX_CUSTOM_HABITS }));
      return;
    }
    setDraft({ visible: true, habit: null, initialName });
  };

  const deleteHabit = (habit) => Alert.alert(t('habits.deleteTitle'), t('habits.deleteMessage', { name: habit.name }), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('habits.delete'), style: 'destructive', onPress: () => removeHabit(habit.id).catch(() => Alert.alert(t('alert.error'), t('profile.saveError'))) },
  ]);

  const card = [styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c)];

  if (!isPremium) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="chevron-back" size={22} color={c.accentInk} /><Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('tabs.home')}</Text></TouchableOpacity>
        <View style={[styles.lockedCard, card]}>
          <Ionicons name="sparkles" size={36} color={c.accentInk} />
          <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{t('habits.premiumTitle')}</Text>
          <Text style={[type.body, { color: c.ink2, textAlign: 'center', lineHeight: 23 }]}>{t('habits.premiumBody')}</Text>
          <TouchableOpacity onPress={() => openPaywall()} style={[styles.cta, { backgroundColor: c.accent }]}><Text style={[type.bodyStrong, { color: c.onAccent }]}>{t('premium.upgrade')}</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40, paddingHorizontal: 22, gap: 16 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button"><Ionicons name="chevron-back" size={22} color={c.accentInk} /><Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('tabs.home')}</Text></TouchableOpacity>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.title, { color: c.ink }]}>{t('habits.title')}</Text>
            <Text style={[type.body, { color: c.ink2 }]}>{t('habits.subtitle')}</Text>
          </View>
          <TouchableOpacity onPress={() => openAdd()} style={[styles.addCircle, { backgroundColor: c.accent }]} accessibilityRole="button" accessibilityLabel={t('habits.add')}><Ionicons name="add" size={24} color={c.onAccent} /></TouchableOpacity>
        </View>

        <View style={[styles.progressCard, card]}>
          <View style={styles.progressIcon}><Ionicons name="sparkles-outline" size={22} color={c.accentInk} /></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.labelStrong, { color: c.ink }]}>{t('habits.todayProgress')}</Text>
            <Text style={[type.heading, { color: c.ink }]}>{t('habits.progress', { done: doneCount, total: habits.length })}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: c.track }]}><View style={[styles.progressFill, { backgroundColor: c.success, width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }]} /></View>
        </View>

        {habits.length === 0 ? (
          <View style={[styles.emptyCard, card]}>
            <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{t('habits.emptyTitle')}</Text>
            <Text style={[type.body, { color: c.ink2, textAlign: 'center', lineHeight: 22 }]}>{t('habits.emptyBody')}</Text>
            <Text style={[type.labelStrong, { color: c.ink2, alignSelf: 'flex-start' }]}>{t('habits.suggestions')}</Text>
            {['stretch', 'breathe', 'read'].map((key) => (
              <TouchableOpacity key={key} onPress={() => openAdd(t(`habits.templates.${key}`))} style={[styles.suggestion, { backgroundColor: c.cardAlt }]}>
                <Ionicons name="add-circle-outline" size={19} color={c.accentInk} />
                <Text style={[type.bodyStrong, { color: c.ink }]}>{t(`habits.templates.${key}`)}</Text>
                <Text style={[type.label, { color: c.ink3, marginLeft: 'auto' }]}>{t('habits.suggestAdd')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[styles.listCard, card]}>
            {habits.map((habit, index) => {
              const done = doneIds.includes(habit.id);
              return (
                <View key={habit.id} style={[styles.habitRow, index < habits.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.divider }]}>
                  <TouchableOpacity onPress={() => toggleHabit(habit.id).catch(() => Alert.alert(t('alert.error'), t('profile.saveError')))} style={[styles.check, { backgroundColor: done ? c.success : 'transparent', borderColor: done ? c.success : c.ink3 }]} accessibilityRole="checkbox" accessibilityLabel={habit.name} accessibilityState={{ checked: done }}>
                    {done && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDraft({ visible: true, habit, initialName: '' })} style={{ flex: 1, gap: 4 }}>
                    <Text style={[type.bodyStrong, { color: done ? c.ink3 : c.ink, textDecorationLine: done ? 'line-through' : 'none' }]}>{habit.name}</Text>
                    <Text style={[type.label, { color: c.ink2 }]}>{habit.time} · {t('habits.daily')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditIndex(editIndex === index ? null : index)} style={styles.moreButton} accessibilityRole="button" accessibilityLabel={t('habits.actions')}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={c.ink3} />
                  </TouchableOpacity>
                  {editIndex === index && (
                    <View style={[styles.rowActions, { backgroundColor: c.cardAlt }]}>
                      <TouchableOpacity onPress={() => { setEditIndex(null); setDraft({ visible: true, habit, initialName: '' }); }}><Text style={[type.labelStrong, { color: c.accentInk }]}>{t('habits.edit')}</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditIndex(null); deleteHabit(habit); }}><Text style={[type.labelStrong, { color: '#D64545' }]}>{t('habits.delete')}</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <Text style={[type.label, { color: c.ink3, lineHeight: 19 }]}>{t('habits.limitHint', { count: MAX_CUSTOM_HABITS })}</Text>
      </ScrollView>
      <HabitEditSheet visible={draft.visible} habit={draft.habit} initialName={draft.initialName} onClose={() => setDraft({ visible: false, habit: null, initialName: '' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 38 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  card: { paddingHorizontal: 16 },
  progressCard: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  progressIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3F0FB' },
  progressTrack: { position: 'absolute', left: 16, right: 16, bottom: 9, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  emptyCard: { paddingVertical: 22, gap: 14, alignItems: 'center' },
  suggestion: { minHeight: 50, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'stretch' },
  listCard: { paddingVertical: 4 },
  habitRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, position: 'relative' },
  check: { width: 44, height: 44, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  moreButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowActions: { position: 'absolute', right: 0, top: 47, zIndex: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', gap: 18, ...cardShadow({ shadowColor: '#000', shadowOpacity: 0.12 }) },
  lockedCard: { margin: 22, paddingVertical: 28, alignItems: 'center', gap: 14 },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, gap: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 },
  timeButton: { minHeight: 54, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
});

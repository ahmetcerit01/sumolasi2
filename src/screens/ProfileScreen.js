import React, { useContext, useEffect, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { useHydrationStore } from '../storage/useHydrationStore';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';
import { getLiveActivityEnabled, isLiveActivitySupported, setLiveActivityEnabled } from '../widgets/liveActivity';
import { syncWidget } from '../widgets/widgetSync';
import {
  computeReminderTimes,
  disableReminders,
  getReminderSettings,
  rescheduleIfEnabled,
  scheduleReminders,
} from '../utils/reminders';

const INTERVALS = [1, 1.5, 2, 3];
const GOAL_STEP = 100;
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromHHMM = (s, fb) => {
  const [h, m] = String(s || fb).split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale, setLanguage } = useContext(LanguageContext);
  const { c, type, radius } = useTheme();

  const goalMl = useHydrationStore((s) => s.goalMl) || 2500;
  const recommended = useHydrationStore((s) => s.recommendedGoal) || 2500;
  const profile = useHydrationStore((s) => s.profile) || {};
  const soundEnabled = useHydrationStore((s) => s.soundEnabled) !== false;
  const { setGoalMl, updateProfile, setSound, setNotifications } = useHydrationStore.getState();

  const [reminders, setReminders] = useState({ enabled: true, intervalHours: 2 });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setReminders).catch(() => {});
  }, []);

  // Kilit ekranı canlı etkinliği (yalnızca iOS)
  const [liveOn, setLiveOn] = useState(true);
  useEffect(() => {
    getLiveActivityEnabled().then(setLiveOn).catch(() => {});
  }, []);
  const toggleLive = async (v) => {
    setLiveOn(v);
    await setLiveActivityEnabled(v);
    syncWidget(); // aç: hemen başlat / kapat: hemen kaldır
  };

  const fmtHours = (h) => (locale === 'tr' ? String(h).replace('.', ',') : String(h));
  const reminderCount = computeReminderTimes(profile.wakeAt, profile.sleepAt, reminders.intervalHours).length;

  // --- hedef ---
  const changeGoal = (delta) => {
    const next = Math.min(6000, Math.max(800, goalMl + delta));
    setGoalMl(next);
    Haptics.selectionAsync().catch(() => {});
  };

  // --- hatırlatıcılar: değişiklik anında uygulanır ---
  const permissionAlert = () =>
    Alert.alert(t('reminders.permissionTitle'), t('reminders.permissionMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('reminders.openSettings'), onPress: () => Linking.openSettings() },
    ]);

  const applyReminders = async (next) => {
    setReminders(next);
    setNotifications?.(next.enabled);
    if (!next.enabled) {
      await disableReminders();
      return;
    }
    const count = await scheduleReminders({ wakeAt: profile.wakeAt, sleepAt: profile.sleepAt, intervalHours: next.intervalHours });
    if (count < 0) {
      setReminders({ ...next, enabled: false });
      setNotifications?.(false);
      permissionAlert();
    }
  };

  // --- profil düzenleme ---
  const [form, setForm] = useState(null);
  const [picker, setPicker] = useState(null); // 'wake' | 'sleep' | null
  const openEdit = () => {
    setForm({
      weight: String(profile.weight || 70),
      height: String(profile.height || 170),
      wake: fromHHMM(profile.wakeAt, '08:00'),
      sleep: fromHHMM(profile.sleepAt, '23:00'),
    });
    setPicker(null);
    setEditing(true);
  };
  const saveEdit = async () => {
    const w = parseInt(form.weight, 10);
    const h = parseInt(form.height, 10);
    if (!w || !h || w < 30 || w > 250 || h < 100 || h > 250) {
      Alert.alert(t('alert.error'), t('profile.invalidInput'));
      return;
    }
    const wakeAt = toHHMM(form.wake);
    const sleepAt = toHHMM(form.sleep);
    await updateProfile({ weight: w, height: h, wakeAt, sleepAt });
    rescheduleIfEnabled({ wakeAt, sleepAt }).catch(() => {});
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const Row = ({ label, value, onPress, last, children }) => (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.6}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: c.divider }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={[type.body, { color: c.ink }]}>{label}</Text>
      {children || (
        <View style={styles.rowRight}>
          <Text style={[type.bodyStrong, { color: c.ink2 }]}>{value}</Text>
          {onPress && <Ionicons name="chevron-forward" size={16} color={c.ink3} />}
        </View>
      )}
    </TouchableOpacity>
  );

  const card = [styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c)];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 22, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.title, { color: c.ink }]}>{t('tabs.profile')}</Text>

        {/* günlük hedef */}
        <View style={[card, { paddingVertical: 14, gap: 10 }]}>
          <View style={styles.goalRow}>
            <View style={{ gap: 2 }}>
              <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('profile.dailyGoal')}</Text>
              <Text style={[type.title, { color: c.ink, fontSize: 28 }]}>{`${fmtNumber(goalMl)} ml`}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity onPress={() => changeGoal(-GOAL_STEP)} style={[styles.stepBtn, { backgroundColor: c.chip }]} accessibilityRole="button" accessibilityLabel={t('profile.goalDecrease')}>
                <Ionicons name="remove" size={22} color={c.chipInk} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => changeGoal(GOAL_STEP)} style={[styles.stepBtn, { backgroundColor: c.chip }]} accessibilityRole="button" accessibilityLabel={t('profile.goalIncrease')}>
                <Ionicons name="add" size={22} color={c.chipInk} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[type.label, { color: c.ink2 }]}>
            {t('profile.recommendedLine', { weight: profile.weight || 70, height: profile.height || 170, goal: fmtNumber(recommended) })}
          </Text>
          {goalMl !== recommended && (
            <TouchableOpacity onPress={() => setGoalMl(recommended)} accessibilityRole="button">
              <Text style={[type.labelStrong, { color: c.accentInk }]}>{t('profile.useRecommended')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* vücut ve rutin */}
        <View style={card}>
          <Row label={t('profile.weight')} value={`${profile.weight || '--'} kg`} onPress={openEdit} />
          <Row label={t('profile.height')} value={`${profile.height || '--'} cm`} onPress={openEdit} />
          <Row label={t('profile.wakeSleep')} value={`${profile.wakeAt || '--:--'} · ${profile.sleepAt || '--:--'}`} onPress={openEdit} last />
        </View>

        {/* hatırlatıcılar */}
        <Text style={[type.overline, { color: c.ink2, paddingHorizontal: 4, marginTop: 6 }]}>{t('reminders.title')}</Text>
        <View style={[card, { paddingBottom: 14, gap: 12 }]}>
          <Row label={t('settings.notifications')} last>
            <Switch
              value={reminders.enabled}
              onValueChange={(v) => applyReminders({ ...reminders, enabled: v })}
              trackColor={{ true: c.success, false: c.track }}
            />
          </Row>
          <View style={[styles.segment, { backgroundColor: c.track, opacity: reminders.enabled ? 1 : 0.45 }]} pointerEvents={reminders.enabled ? 'auto' : 'none'}>
            {INTERVALS.map((h) => {
              const on = h === reminders.intervalHours;
              return (
                <TouchableOpacity
                  key={h}
                  onPress={() => applyReminders({ ...reminders, intervalHours: h })}
                  style={[styles.segBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[on ? type.labelStrong : type.label, { fontSize: 14, color: on ? c.ink : c.ink2 }]}>
                    {t('reminders.everyShort', { hours: fmtHours(h) })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>
            {reminders.enabled
              ? t('reminders.summary', { from: profile.wakeAt || '08:00', to: profile.sleepAt || '23:00', count: reminderCount })
              : t('reminders.disabledInline')}
          </Text>
        </View>

        {/* ayarlar */}
        <View style={card}>
          <Row label={t('settings.language')}>
            <View style={[styles.langSeg, { backgroundColor: c.track }]}>
              {['tr', 'en'].map((l) => {
                const on = locale === l;
                return (
                  <TouchableOpacity
                    key={l}
                    onPress={() => setLanguage(l)}
                    style={[styles.langBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[on ? type.labelStrong : type.label, { fontSize: 14, color: on ? c.ink : c.ink2 }]}>
                      {l === 'tr' ? 'Türkçe' : 'English'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Row>
          <Row label={t('settings.soundFx')} last={!isLiveActivitySupported()}>
            <Switch value={soundEnabled} onValueChange={(v) => setSound(v)} trackColor={{ true: c.success, false: c.track }} />
          </Row>
          {isLiveActivitySupported() && (
            <Row label={t('live.setting')} last>
              <Switch value={liveOn} onValueChange={toggleLive} trackColor={{ true: c.success, false: c.track }} />
            </Row>
          )}
        </View>
        {isLiveActivitySupported() && (
          <Text style={[type.label, { color: c.ink3, paddingHorizontal: 4, marginTop: -6 }]}>{t('live.settingHint')}</Text>
        )}

        {/* geliştirici (yalnızca geliştirme sürümü) */}
        {__DEV__ && (
          <View style={[card, { paddingVertical: 12, gap: 8 }]}>
            <Text style={[type.overline, { color: c.ink3 }]}>{t('reminders.testPanel')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.devBtn, { backgroundColor: c.chip }]}
                onPress={async () => {
                  await Notifications.scheduleNotificationAsync({
                    content: { title: t('notifications.title'), body: t('notifications.body'), sound: 'default' },
                    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 },
                  });
                  Alert.alert(t('reminders.plannedTitle'), t('reminders.testInOneMinuteMsg'));
                }}
              >
                <Text style={[type.labelStrong, { color: c.chipInk }]}>{t('reminders.test1m')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devBtn, { backgroundColor: c.chip }]} onPress={() => DeviceEventEmitter.emit('OPEN_ONBOARD')}>
                <Text style={[type.labelStrong, { color: c.chipInk }]}>{t('reminders.onboard')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devBtn, { backgroundColor: c.chip }]} onPress={() => useHydrationStore.getState().resetToday()}>
                <Text style={[type.labelStrong, { color: c.chipInk }]}>{t('dev.reset')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* profil düzenleme sayfası */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={() => setEditing(false)} />
          {form && (
            <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.sheetHeader}>
                <Text style={[type.heading, { color: c.ink }]}>{t('profile.editTitle')}</Text>
                <TouchableOpacity onPress={() => setEditing(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  ['weight', t('profile.weightInput')],
                  ['height', t('profile.heightInput')],
                ].map(([key, label]) => (
                  <View key={key} style={{ flex: 1, gap: 6 }}>
                    <Text style={[type.labelStrong, { color: c.ink2 }]}>{label}</Text>
                    <TextInput
                      value={form[key]}
                      onChangeText={(v) => setForm({ ...form, [key]: v.replace(/[^0-9]/g, '') })}
                      keyboardType="number-pad"
                      maxLength={3}
                      style={[styles.input, type.heading, { color: c.ink, backgroundColor: c.cardAlt }]}
                      accessibilityLabel={label}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  ['wake', t('profile.wake')],
                  ['sleep', t('profile.sleep')],
                ].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setPicker(picker === key ? null : key)}
                    style={[styles.timeBtn, { backgroundColor: c.cardAlt, borderColor: picker === key ? c.accent : 'transparent' }]}
                    accessibilityRole="button"
                  >
                    <Text style={[type.labelStrong, { color: c.ink2 }]}>{label}</Text>
                    <Text style={[type.heading, { color: c.ink }]}>{toHHMM(form[key])}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {picker && (
                <DateTimePicker
                  value={form[picker]}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={(e, d) => {
                    if (d) setForm({ ...form, [picker]: d });
                    if (Platform.OS !== 'ios') setPicker(null);
                  }}
                  onDismiss={() => setPicker(null)}
                  style={{ height: 150 }}
                />
              )}
              <TouchableOpacity onPress={saveEdit} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 17 }]}>{t('profile.saveAndCalc')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { paddingHorizontal: 16 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', gap: 8 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 50, paddingVertical: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  langSeg: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  langBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  devBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, gap: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  timeBtn: { flex: 1, borderRadius: 16, padding: 12, gap: 2, borderWidth: 2 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
});

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
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useNotificationStatus } from '../notifications/scheduler';
import { openAdPrivacyOptions } from '../ads/ads';
import { getAnnouncementPreference, setAnnouncementPreference } from '../services/firebaseMessaging';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { useHydrationStore } from '../storage/useHydrationStore';
import { DEFAULT_GOAL } from '../utils/goal';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import { IS_TEST_BUILD } from '../utils/env';
import { quickLabel, useQuickAdds } from '../storage/quickAdds';
import { DrinkIcon } from '../components/QuickAdd';
import QuickAddEditor from '../components/QuickAddEditor';
import DamlaTip from '../components/DamlaTip';
import { setThemePref, useThemePref } from '../theme/themePreference';
import { fmtNumber, upper } from '../utils/format';
import { getLiveActivityEnabled, isLiveActivitySupported, setLiveActivityEnabled } from '../widgets/liveActivity';
import { syncWidget } from '../widgets/widgetSync';
import { PREMIUM_MODE, usePremium } from '../premium/PremiumProvider';
import { usePaywall } from '../premium/Paywall';
import Mascot from '../components/Mascot';
import {
  computeReminderTimes,
  computeScheduledReminderTimes,
  disableReminders,
  getReminderSettings,
  scheduleReminders,
} from '../utils/reminders';
import { DEFAULT_SHIFT_SCHEDULE, getShiftSchedule, saveShiftSchedule } from '../utils/shiftSchedule';
import { getShiftForDate } from '../utils/shiftSchedule';

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

// Ayar satırı. Bileşenin dışında tanımlı: içeride tanımlanınca her render'da yeni bir bileşen türü olur,
// React satırları (içindeki Switch'lerle) söküp yeniden kurar ve bir anahtar değişince diğerleri de oynar.
function Row({ label, value, onPress, last, children }) {
  const { c, type } = useTheme();
  return (
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
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale, setLanguage } = useContext(LanguageContext);
  const themePref = useThemePref();
  const quickAdds = useQuickAdds();
  const [quickEdit, setQuickEdit] = useState(null);
  const [siriTip, setSiriTip] = useState(false);
  const { c, type, radius } = useTheme();

  const goalMl = useHydrationStore((s) => s.goalMl) || DEFAULT_GOAL;
  const recommended = useHydrationStore((s) => s.recommendedGoal) || DEFAULT_GOAL;
  const profile = useHydrationStore((s) => s.profile) || {};
  const lastDate = useHydrationStore((s) => s.lastDate);
  const soundEnabled = useHydrationStore((s) => s.soundEnabled) !== false;
  const { setGoalMl, updateProfile, setSound, setNotifications } = useHydrationStore.getState();

  const { isPremium, setMockPremium, restore } = usePremium();
  const { open: openPaywall } = usePaywall();
  const [reminders, setReminders] = useState({ enabled: true, intervalHours: 2 });
  const [editing, setEditing] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [announcements, setAnnouncements] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);
  const notificationFailures = useNotificationStatus();
  const legal = Constants.expoConfig?.extra?.legal || {};
  useFocusEffect(React.useCallback(() => {
    getAnnouncementPreference().then(setAnnouncements).catch(() => {});
    Notifications.getPermissionsAsync().then((permission) => setNotificationsBlocked(permission.status !== 'granted')).catch(() => {});
    getReminderSettings().then(setReminders).catch(() => {});
  }, []));
  const openLink = (url) => Linking.openURL(url).catch(() => Alert.alert(t('alert.error'), t('profile.saveError')));
  const onAnnouncements = async (enabled) => {
    setPushBusy(true);
    try { setAnnouncements(await setAnnouncementPreference(enabled)); }
    catch { setAnnouncements(await getAnnouncementPreference()); Alert.alert(t('alert.error'), t('release.announcementFailed')); }
    finally { setPushBusy(false); }
  };
  const onRestore = async () => {
    try { const restored = await restore(); Alert.alert(t(restored ? 'premium.restoredTitle' : 'premium.notFoundTitle'), t(restored ? 'premium.restoredMsg' : 'premium.notFoundMsg')); }
    catch { Alert.alert(t('alert.error'), t('premium.failed')); }
  };
  const reminderError = (error) => Alert.alert(t('alert.error'), t(error?.code === 'notification_capacity' ? 'release.reminderCapacity' : 'release.reminderFailed'));

  const [shiftSchedule, setShiftSchedule] = useState(DEFAULT_SHIFT_SCHEDULE);
  const [shiftPicker, setShiftPicker] = useState(null);
  const [shiftTimeDraft, setShiftTimeDraft] = useState(null);
  const [shiftEditorOpen, setShiftEditorOpen] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setReminders).catch(() => {});
    getShiftSchedule().then(setShiftSchedule).catch(() => {});
  }, []);

  // Kilit ekranı canlı etkinliği (yalnızca iOS)
  const [liveOn, setLiveOn] = useState(false);
  useEffect(() => {
    getLiveActivityEnabled().then(setLiveOn).catch(() => {});
  }, []);
  const toggleLive = async (v) => {
    setLiveOn(v);
    await setLiveActivityEnabled(v);
    syncWidget(); // aç: hemen başlat / kapat: hemen kaldır
  };

  const fmtHours = (h) => (locale === 'tr' ? String(h).replace('.', ',') : String(h));
  const shiftReferenceDate = lastDate ? new Date(`${lastDate}T12:00:00`) : new Date();
  const activeReminderWindow = shiftSchedule.enabled ? getShiftForDate(shiftSchedule, shiftReferenceDate) : profile;
  const reminderCount = (shiftSchedule.enabled
    ? computeScheduledReminderTimes(activeReminderWindow.wakeAt, activeReminderWindow.sleepAt, reminders.intervalHours, shiftReferenceDate.getDay())
    : computeReminderTimes(activeReminderWindow.wakeAt, activeReminderWindow.sleepAt, reminders.intervalHours)).length;

  const updateShiftSchedule = async (next) => {
    if (savingSchedule) return;
    setSavingSchedule(true);
    try {
      if (reminders.enabled) {
        const window = next.enabled ? getShiftForDate(next, new Date()) : profile;
        const count = await scheduleReminders({ wakeAt: window.wakeAt, sleepAt: window.sleepAt, intervalHours: reminders.intervalHours, weeklySchedule: next.enabled ? next : null });
        if (count < 0) { permissionAlert(); return; }
      }
      await saveShiftSchedule(next);
      await useHydrationStore.getState().setShiftSchedule(next);
      setShiftSchedule(next);
    } catch (error) { reminderError(error); }
    finally { setSavingSchedule(false); }
  };
  const toggleShiftMode = (enabled) => updateShiftSchedule({ ...shiftSchedule, enabled });

  const setWeekdayMode = (dayIndex, mode) => {
    const week = shiftSchedule.week.map((current, index) => (index === dayIndex ? mode : current));
    updateShiftSchedule({ ...shiftSchedule, week });
  };

  const openShiftTimePicker = (key) => {
    setShiftTimeDraft(fromHHMM(shiftSchedule.shifts[shiftSchedule.active][key], '08:00'));
    setShiftPicker(shiftPicker === key ? null : key);
  };

  const saveShiftTime = async (key = shiftPicker, selectedTime = shiftTimeDraft) => {
    if (!key || !selectedTime) return;
    const shifts = {
      ...shiftSchedule.shifts,
      [shiftSchedule.active]: { ...shiftSchedule.shifts[shiftSchedule.active], [key]: toHHMM(selectedTime) },
    };
    setShiftPicker(null);
    setShiftTimeDraft(null);
    await updateShiftSchedule({ ...shiftSchedule, shifts });
  };

  // --- hedef ---
  const changeGoal = async (delta) => {
    try { await useHydrationStore.getState().adjustGoalMl(delta); Haptics.selectionAsync().catch(() => {}); }
    catch { Alert.alert(t('alert.error'), t('profile.saveError')); }
  };

  // --- hatırlatıcılar: değişiklik anında uygulanır ---
  const permissionAlert = () =>
    Alert.alert(t('reminders.permissionTitle'), t('reminders.permissionMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('reminders.openSettings'), onPress: () => Linking.openSettings() },
    ]);

  const applyReminders = async (next) => {
    if (savingSchedule) return;
    setSavingSchedule(true);
    try {
      if (!next.enabled) await disableReminders();
      else {
        const window = shiftSchedule.enabled ? getShiftForDate(shiftSchedule, new Date()) : profile;
        const count = await scheduleReminders({ wakeAt: window.wakeAt, sleepAt: window.sleepAt, intervalHours: next.intervalHours, weeklySchedule: shiftSchedule.enabled ? shiftSchedule : null });
        if (count < 0) { setNotificationsBlocked(true); permissionAlert(); return; }
        setNotificationsBlocked(false);
      }
      setReminders(next);
      await setNotifications?.(next.enabled);
    } catch (error) { reminderError(error); }
    finally { setSavingSchedule(false); }
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
    if (savingSchedule) return;
    setSavingSchedule(true);
    try {
      if (reminders.enabled) {
        const weeklySchedule = shiftSchedule.enabled ? shiftSchedule : null;
        const window = shiftSchedule.enabled ? getShiftForDate(shiftSchedule, new Date()) : { wakeAt, sleepAt };
        const result = await scheduleReminders({ wakeAt: window.wakeAt, sleepAt: window.sleepAt, intervalHours: reminders.intervalHours, weeklySchedule });
        if (result < 0) { Alert.alert(t('alert.error'), t('release.notificationsBlocked')); return; }
      }
      await updateProfile({ weight: w, height: h, wakeAt, sleepAt });
      setEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) { reminderError(error); }
    finally { setSavingSchedule(false); }
  };

  const card = [styles.card, { backgroundColor: c.card, borderRadius: radius.card }, cardShadow(c)];

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.statusBar} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120, paddingHorizontal: 22, gap: 14 }} showsVerticalScrollIndicator={false}>
        <Text style={[type.title, { color: c.ink }]}>{t('tabs.profile')}</Text>

        {/* premium */}
        <TouchableOpacity
          activeOpacity={isPremium ? 1 : 0.85}
          disabled={isPremium}
          onPress={() => openPaywall()}
          style={[styles.premium, { backgroundColor: isPremium ? c.successBg : c.chip }]}
          accessibilityRole="button"
        >
          <Mascot mood={isPremium ? 'celebrate' : 'happy'} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.bodyStrong, { color: isPremium ? c.successInk : c.chipInk }]}>
              {isPremium ? t('premium.active') : t('premium.upgrade')}
            </Text>
            <Text style={[type.label, { color: c.ink2 }]}>{isPremium ? t('premium.activeSub') : t('premium.upgradeSub')}</Text>
          </View>
          {!isPremium && <Ionicons name="chevron-forward" size={18} color={c.chipInk} />}
        </TouchableOpacity>

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
          <Text style={[type.caption, { color: c.ink2 }]}>{t('release.goalHint')}</Text>
          {goalMl !== recommended && (
            <TouchableOpacity onPress={() => setGoalMl(recommended).catch(() => Alert.alert(t('alert.error'), t('profile.saveError')))} accessibilityRole="button">
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

        {/* vardiya ayarlarına ayrı ekran */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => setShiftEditorOpen(true)}
          style={[card, styles.shiftEntry, { backgroundColor: c.card, borderRadius: radius.card }]}
          accessibilityRole="button"
        >
          <View style={[styles.shiftIcon, { backgroundColor: c.chip }]}>
            <Ionicons name="time-outline" size={21} color={c.accentInk} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[type.bodyStrong, { color: c.ink }]}>{t('shift.title')}</Text>
            <Text style={[type.label, { color: c.ink2 }]}>
            {shiftSchedule.enabled
                ? `${t(`shift.${activeReminderWindow.mode}`)} · ${activeReminderWindow.wakeAt}–${activeReminderWindow.sleepAt}`
                : t('shift.entryHint')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.ink3} />
        </TouchableOpacity>

        {/* hatırlatıcılar */}
        <Text style={[type.overline, { color: c.ink2, paddingHorizontal: 4, marginTop: 6 }]}>{upper(t('reminders.title'))}</Text>
        <View style={[card, { paddingBottom: 14, gap: 12 }]}>
          <Row label={t('settings.notifications')} last>
            <Switch
              value={reminders.enabled}
              disabled={savingSchedule}
              onValueChange={(v) => applyReminders({ ...reminders, enabled: v })}
              trackColor={{ true: c.success, false: c.track }}
            />
          </Row>
          <View style={[styles.segment, { backgroundColor: c.track, opacity: reminders.enabled ? 1 : 0.45 }]} pointerEvents={reminders.enabled && !savingSchedule ? 'auto' : 'none'}>
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
              ? shiftSchedule.enabled
                ? t('reminders.scheduleSummary', { from: activeReminderWindow.wakeAt || '08:00', to: activeReminderWindow.sleepAt || '23:00', count: reminderCount })
                : t('reminders.summary', { from: activeReminderWindow.wakeAt || '08:00', to: activeReminderWindow.sleepAt || '23:00', count: reminderCount })
              : t('reminders.disabledInline')}
          </Text>
        </View>

        {reminders.enabled && notificationsBlocked && (
          <TouchableOpacity onPress={() => Linking.openSettings()} style={[card, { backgroundColor: c.chip }]} accessibilityRole="button">
            <Text style={[type.label, { color: c.chipInk }]}>{t('release.notificationsBlocked')}</Text>
          </TouchableOpacity>
        )}

        {notificationFailures.length > 0 && <View style={[card, { backgroundColor: c.chip }]}><Text style={[type.label, { color: c.chipInk }]}>{t(notificationFailures.includes('notification_capacity') ? 'release.reminderCapacity' : 'release.reminderFailed')}</Text></View>}
        {/* hızlı ekleme butonları */}
        <Text style={[type.overline, { color: c.ink2, paddingHorizontal: 4, marginTop: 6 }]}>{upper(t('quickAdd.settingsTitle'))}</Text>
        <View style={[card, { paddingVertical: 4 }]}>
          {quickAdds.map((q, i) => (
            <TouchableOpacity
              key={q.id}
              onPress={() => setQuickEdit(i)}
              style={[styles.row, i < quickAdds.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.divider }]}
              accessibilityRole="button"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <DrinkIcon name={q.icon} size={22} color={c.accent} />
                <Text style={[type.body, { color: c.ink }]}>{quickLabel(q, t)}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[type.bodyStrong, { color: c.ink2 }]}>{`${fmtNumber(q.ml)} ml`}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.ink3} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[type.label, { color: c.ink3, paddingHorizontal: 4, marginTop: -6 }]}>{t('quickAdd.settingsHint')}</Text>

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
          <Row label={t('settings.appearance')}>
            <View style={[styles.langSeg, { backgroundColor: c.track }]}>
              {[
                ['system', 'themeSystem'],
                ['light', 'themeLight'],
                ['dark', 'themeDark'],
              ].map(([p, key]) => {
                const on = themePref === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setThemePref(p)}
                    style={[styles.langBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[on ? type.labelStrong : type.label, { fontSize: 14, color: on ? c.ink : c.ink2 }]}>{t(`settings.${key}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Row>
          <Row label={t('settings.siri')} value="" onPress={() => setSiriTip(true)} />
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

        <Text style={[type.section, { color: c.ink }]}>{t('release.privacySupport')}</Text>
        <View style={card}>
          <Row label={t('release.announcements')}><Switch value={announcements} disabled={pushBusy} onValueChange={onAnnouncements} trackColor={{ true: c.success, false: c.track }} /></Row>
          <Text style={[type.caption, { color: c.ink2, marginBottom: 12 }]}>{t('release.announcementsHint')}</Text>
          <Row label={t('premium.privacy')} onPress={() => openLink(legal.privacyUrl)} />
          <Row label={t('premium.terms')} onPress={() => openLink(legal.termsUrl)} />
          <Row label={t('release.support')} onPress={() => openLink('mailto:farukoz.dev@gmail.com')} />
          <Row label={t('release.manageSubscription')} onPress={() => openLink(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions')} />
          <Row label={t('premium.restore')} onPress={onRestore} />
          <Row label={t('release.adPrivacy')} last onPress={async () => {
            try { if (!(await openAdPrivacyOptions())) Alert.alert(t('release.adPrivacy'), t('release.adPrivacyNotRequired')); }
            catch { Alert.alert(t('alert.error'), t('profile.saveError')); }
          }} />
        </View>

        {/* geliştirici (yalnızca geliştirme sürümü) */}
        {IS_TEST_BUILD && (
          <View style={[card, { paddingVertical: 12, gap: 8 }]}>
            <Text style={[type.overline, { color: c.ink3 }]}>{upper(t('reminders.testPanel'))}</Text>
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
              <TouchableOpacity style={[styles.devBtn, { backgroundColor: c.chip }]} onPress={() => DeviceEventEmitter.emit('PREVIEW_INTRO')}>
                <Text style={[type.labelStrong, { color: c.chipInk }]}>{t('dev.intro')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.devBtn, { backgroundColor: c.chip }]} onPress={() => useHydrationStore.getState().resetToday()}>
                <Text style={[type.labelStrong, { color: c.chipInk }]}>{t('dev.reset')}</Text>
              </TouchableOpacity>
            </View>
            {PREMIUM_MODE === 'mock' && (
              <View style={[styles.row, { minHeight: 44 }]}>
                <Text style={[type.label, { color: c.ink2 }]}>{t('premium.mockToggle')}</Text>
                <Switch value={isPremium} onValueChange={setMockPremium} trackColor={{ true: c.success, false: c.track }} />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <DamlaTip visible={siriTip} onClose={() => setSiriTip(false)} />
      <QuickAddEditor index={quickEdit} item={quickEdit != null ? quickAdds[quickEdit] : null} onClose={() => setQuickEdit(null)} />

      {/* vardiya düzenini ayarla */}
      <Modal visible={shiftEditorOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShiftEditorOpen(false)}>
        <View style={[styles.shiftScreen, { backgroundColor: c.bg, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.shiftHeader}>
            <TouchableOpacity onPress={() => setShiftEditorOpen(false)} style={[styles.closeBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="chevron-back" size={22} color={c.ink} />
            </TouchableOpacity>
            <Text style={[type.heading, { color: c.ink, flex: 1, marginLeft: 14 }]}>{t('shift.title')}</Text>
            <Switch disabled={savingSchedule} value={shiftSchedule.enabled} onValueChange={toggleShiftMode} trackColor={{ true: c.success, false: c.track }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30, gap: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={[type.body, { color: c.ink2, lineHeight: 23 }]}>{t('shift.description')}</Text>
            <View style={[card, { paddingVertical: 12, gap: 10 }]}>
              <Text style={[type.labelStrong, { color: c.ink }]}>{t('shift.weekTitle')}</Text>
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                <View key={dayIndex} style={[styles.weekPlanRow, { borderBottomColor: c.divider, borderBottomWidth: dayIndex < 6 ? 1 : 0 }]}>
                  <Text style={[type.labelStrong, { color: c.ink, width: 42 }]}>{t(`days.short.${dayIndex}`)}</Text>
                  <View style={{ flexDirection: 'row', gap: 5 }}>
                    {['day', 'night', 'off'].map((mode) => {
                      const on = shiftSchedule.week[dayIndex] === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => setWeekdayMode(dayIndex, mode)}
                          style={[styles.weekModeBtn, { backgroundColor: on ? c.chip : c.cardAlt, borderColor: on ? c.accent : 'transparent' }]}
                          accessibilityRole="button"
                          accessibilityLabel={`${t(`days.long.${dayIndex}`)} · ${t(`shift.${mode}`)}`}
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[on ? type.labelStrong : type.label, { color: on ? c.chipInk : c.ink3, fontSize: 12 }]}>{t(`shift.short.${mode}`)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
            <View style={[card, { paddingVertical: 14, gap: 12 }]}>
              <Text style={[type.labelStrong, { color: c.ink }]}>{t('shift.editTemplate')}</Text>
              <View style={[styles.segment, { backgroundColor: c.track }]}>
                {['day', 'night', 'off'].map((mode) => {
                  const on = shiftSchedule.active === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => updateShiftSchedule({ ...shiftSchedule, active: mode })}
                      style={[styles.segBtn, on && { backgroundColor: c.card }, on && cardShadow(c)]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[on ? type.labelStrong : type.label, { fontSize: 13, color: on ? c.ink : c.ink2 }]}>{t(`shift.${mode}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[type.labelStrong, { color: c.ink }]}>{t('shift.activeHours', { mode: t(`shift.${shiftSchedule.active}`) })}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  ['wakeAt', t('shift.awakeFrom')],
                  ['sleepAt', t('shift.quietFrom')],
                ].map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => openShiftTimePicker(key)}
                    style={[styles.timeBtn, { backgroundColor: c.cardAlt, borderColor: shiftPicker === key ? c.accent : 'transparent' }]}
                    accessibilityRole="button"
                  >
                    <Text style={[type.labelStrong, { color: c.ink2 }]}>{label}</Text>
                    <Text style={[type.heading, { color: c.ink }]}>{shiftSchedule.shifts[shiftSchedule.active][key]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {shiftPicker && (
                <DateTimePicker
                  value={shiftTimeDraft || fromHHMM(shiftSchedule.shifts[shiftSchedule.active][shiftPicker], '08:00')}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={(e, date) => {
                    if (date) setShiftTimeDraft(date);
                    if (Platform.OS !== 'ios' && date) saveShiftTime(shiftPicker, date);
                  }}
                  onDismiss={() => { setShiftPicker(null); setShiftTimeDraft(null); }}
                  style={{ height: 150 }}
                />
              )}
              {shiftPicker && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => saveShiftTime()} style={[styles.cta, { backgroundColor: c.accent, paddingVertical: 12 }]} accessibilityRole="button">
                  <Text style={[type.bodyStrong, { color: c.onAccent }]}>{t('shift.saveTime')}</Text>
                </TouchableOpacity>
              )}
              <Text style={[type.label, { color: c.ink3, fontSize: 13, lineHeight: 20 }]}>{t('shift.hint')}</Text>
            </View>
            {!shiftSchedule.enabled && (
              <TouchableOpacity onPress={() => toggleShiftMode(true)} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
                <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 16 }]}>{t('shift.enable')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* profil düzenleme sayfası */}
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(false)} />
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
              <TouchableOpacity onPress={saveEdit} disabled={savingSchedule} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
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
  premium: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12 },
  shiftEntry: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  shiftIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shiftScreen: { flex: 1 },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  weekPlanRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekModeBtn: { width: 48, height: 34, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
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
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, gap: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  timeBtn: { flex: 1, borderRadius: 16, padding: 12, gap: 2, borderWidth: 2 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
});

import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView, Alert, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHydrationStore } from '../storage/useHydrationStore';
import { COLORS } from '../theme/colors';
import { S } from '../theme/spacing';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { LanguageContext } from '../../App';

// ------- SABİTLER -------
const REMINDER_IDS_KEY = 'SUMOLASI_REMINDER_IDS_V1';
const REMINDER_ENABLED_KEY = 'REMINDER_ENABLED';
const REMINDER_INTERVAL_HOURS_KEY = 'REMINDER_INTERVAL_HOURS';
const LAST_SCHEDULED_DATE_KEY = 'REMINDER_LAST_SCHEDULED_DATE';
const IS_EXPO_GO = Constants?.appOwnership === 'expo';

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

// Helper: Bugünün belirli saati
const todayAt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const setLastScheduledToday = async () => {
  try { await AsyncStorage.setItem(LAST_SCHEDULED_DATE_KEY, todayKey()); } catch {}
};

// --- BİLDİRİM FONKSİYONLARI ---

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('hydration-daily', {
      name: 'Su Molası',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch {}
}

async function cancelExistingReminders() {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify([]));
  } catch {}
}

async function scheduleOneDailyCalendar({ hour, minute }) {
  const trigger = { hour, minute, repeats: true, ...(Platform.OS === 'android' ? { channelId: 'hydration-daily' } : {}) };
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Su Molası', body: 'Bir bardak su içme zamanı!', sound: 'default', data: { type: 'WATER_REMINDER' } },
    trigger,
  });
  return id;
}

async function scheduleOneExactDate(dateObj) {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Su Molası', body: 'Bir bardak su içme zamanı!', sound: 'default', data: { type: 'WATER_REMINDER' } },
    trigger: { type: 'date', date: dateObj },
  });
  return id;
}

async function scheduleDailyRemindersCalendar(times) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Bildirim izni verilmedi.');

  await ensureAndroidChannel();
  await cancelExistingReminders();

  const normalized = [...times]
    .map(t => ({ hour: Math.max(0, Math.min(23, Number(t.hour))), minute: Math.max(0, Math.min(59, Number(t.minute))) }))
    .filter((t, i, arr) => arr.findIndex(x => x.hour === t.hour && x.minute === t.minute) === i)
    .sort((a, b) => (a.hour - b.hour) || (a.minute - b.minute));

  const ids = [];
  if (IS_EXPO_GO) {
    const now = Date.now();
    for (const t of normalized) {
      let d = todayAt(t.hour, t.minute);
      if (d.getTime() <= now + 15000) d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      const id = await scheduleOneExactDate(d);
      ids.push(id);
    }
  } else {
    for (const t of normalized) {
      const id = await scheduleOneDailyCalendar(t);
      ids.push(id);
    }
  }
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}

// ------- COMPONENT -------

export default function RemindersScreen() {
  const goalMl = useHydrationStore(s => s.goalMl);
  const todayTotal = useHydrationStore(s => s.totalMl);

  const { t } = useContext(LanguageContext);

  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(2);
  const [wakeTime, setWakeTime] = useState({ h: 9, m: 0 });
  const [sleepTime, setSleepTime] = useState({ h: 23, m: 0 });
  const [previewTimes, setPreviewTimes] = useState([]);

  // Profil ve Ayarları Yükle
  useEffect(() => {
    (async () => {
      try {
        const profileRaw = await AsyncStorage.getItem('ONBOARD_PROFILE');
        if (profileRaw) {
          const p = JSON.parse(profileRaw);
          if (p.wakeAt) { const [h, m] = p.wakeAt.split(':').map(Number); if (!isNaN(h)) setWakeTime({ h, m }); }
          if (p.sleepAt) { const [h, m] = p.sleepAt.split(':').map(Number); if (!isNaN(h)) setSleepTime({ h, m }); }
        }
        const kv = await AsyncStorage.multiGet([REMINDER_ENABLED_KEY, REMINDER_INTERVAL_HOURS_KEY]);
        const enabledStr = kv.find(k => k[0] === REMINDER_ENABLED_KEY)?.[1];
        const intervalStr = kv.find(k => k[0] === REMINDER_INTERVAL_HOURS_KEY)?.[1];
        
        if (enabledStr !== null) setEnabled(enabledStr === '1');
        if (intervalStr) setIntervalHours(Number(intervalStr));
      } catch {}
    })();
  }, []);

  // --- PREVIEW OLUŞTURUCU (GÖRSEL ÇİZELGE) ---
  // Bu fonksiyon "Şu an saat kaç" diye bakmaz. Sadece ideal bir günü simüle eder.
  useEffect(() => {
    const generatePreview = () => {
      const intervalMinutes = Math.round(intervalHours * 60);
      
      // Bugünün tarihi üzerinden sanal başlangıç ve bitiş oluştur
      let start = new Date();
      start.setHours(wakeTime.h, wakeTime.m, 0, 0);
      
      let end = new Date();
      end.setHours(sleepTime.h, sleepTime.m, 0, 0);

      // Eğer uyku saati uyanmadan küçükse (örn: 01:00), gece yarısını geçmiş demektir, yarına atalım
      if (end <= start) {
        end.setDate(end.getDate() + 1);
      }

      const list = [];
      // İlk bildirim uyanır uyanmaz değil, 1. aralıkta başlasın (Tercih meselesi, start direkt eklenirse uyanır uyanmaz olur)
      // Biz burada "start"tan itibaren ekleyelim.
      let current = new Date(start.getTime());
      
      // Uyanma anını da ekleyelim mi? Genelde uyanınca su içilir.
      // Ama biz interval kadar sonrasını ekleyelim ki "aralık" mantığı otursun.
      current = new Date(current.getTime() + intervalMinutes * 60000);

      while (current <= end) {
        list.push(new Date(current));
        current = new Date(current.getTime() + intervalMinutes * 60000);
      }
      
      setPreviewTimes(list);
    };

    generatePreview();
  }, [intervalHours, wakeTime, sleepTime]);


  // --- GERÇEK PLANLAMA (BU DEĞİŞMEDİ) ---
  const onSave = async () => {
    if (!enabled) {
      await cancelExistingReminders();
      await AsyncStorage.setItem(REMINDER_ENABLED_KEY, '0');
      Alert.alert(t('reminders.savedTitle'), t('reminders.disabledMsg'));
      return;
    }
    if (todayTotal >= goalMl) {
      await cancelExistingReminders();
      Alert.alert(t('reminders.greatTitle'), t('reminders.goalAlreadyDone'));
      return;
    }

    // Gerçek planlamada "ŞİMDİDEN SONRAKİ" zamanları bulmamız lazım
    const intervalMinutes = Math.round(intervalHours * 60);
    const start = todayAt(wakeTime.h, wakeTime.m);
    let end = todayAt(sleepTime.h, sleepTime.m);
    if (end < start) end = todayAt(23, 59);

    const now = new Date();
    // Başlangıç: En az 90sn sonra
    let t = new Date(Math.max(start.getTime(), now.getTime() + 90 * 1000));

    // Izgara hesabı
    const diffMs = t - start;
    if (diffMs > 0) {
      const minutesSinceStart = Math.floor(diffMs / 60000);
      const offsetToNext = minutesSinceStart % intervalMinutes === 0 
        ? 0 
        : (intervalMinutes - (minutesSinceStart % intervalMinutes));
      t = new Date(t.getTime() + offsetToNext * 60000);
    }

    const timesToSchedule = [];
    while (t <= end) {
      timesToSchedule.push({ hour: t.getHours(), minute: t.getMinutes() });
      t = new Date(t.getTime() + intervalMinutes * 60000);
    }

    // Eğer bugün için hiç vakit kalmadıysa uyarı ver ama ayarları kaydet
    if (timesToSchedule.length === 0) {
      await AsyncStorage.multiSet([
        [REMINDER_INTERVAL_HOURS_KEY, String(intervalHours)],
        [REMINDER_ENABLED_KEY, '1'],
      ]);
      Alert.alert(t('reminders.savedTitle'), t('reminders.noTimeLeftToday'));
      return;
    }

    try {
      const count = await scheduleDailyRemindersCalendar(timesToSchedule);
      await AsyncStorage.multiSet([
        [REMINDER_INTERVAL_HOURS_KEY, String(intervalHours)],
        [REMINDER_ENABLED_KEY, '1'],
        ...(IS_EXPO_GO ? [[LAST_SCHEDULED_DATE_KEY, todayKey()]] : []),
      ]);
      Alert.alert(t('reminders.savedTitle'), t('reminders.scheduledCount', { count }));
    } catch (e) {
      Alert.alert(t('reminders.errorTitle'), t('reminders.scheduleFailed'));
    }
  };

  // Test Fonksiyonları
  const onTestInOneMinute = async () => {
    await ensureAndroidChannel();
    await scheduleOneExactDate(new Date(Date.now() + 60 * 1000));
    Alert.alert(t('reminders.plannedTitle'), t('reminders.testInOneMinuteMsg'));
  };

  const wakeStr = `${pad(wakeTime.h)}:${pad(wakeTime.m)}`;
  const sleepStr = `${pad(sleepTime.h)}:${pad(sleepTime.m)}`;
  const frequencyDisabled = !enabled;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.container, { paddingTop: 12, paddingBottom: 32 }]}>
          <Text style={styles.title}>{t('reminders.title')}</Text>

          {/* Aralık Bilgisi */}
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.label}>{t('reminders.intervalTitle')}</Text>
                <Text style={styles.subLabel}>({wakeStr} – {sleepStr})</Text>
              </View>
              <Switch value={enabled} onValueChange={setEnabled} trackColor={{true:COLORS.primaryEnd}} />
            </View>
            
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color="#3B82F6" style={{marginRight:6}} />
              <Text style={styles.infoText}>
                {t('reminders.profileTimesInfo')}
              </Text>
            </View>
          </View>

          {/* Sıklık & Timeline */}
          <View style={styles.block}>
            <View style={frequencyDisabled ? styles.frequencyDisabled : null} pointerEvents={frequencyDisabled ? 'none' : 'auto'}>
              <Text style={[styles.label, { marginBottom: 12 }]}>{t('reminders.frequencyTitle')}</Text>
              
              {/* Butonlar */}
              <View style={[styles.row, { flexWrap: 'wrap', marginBottom: 20 }]}>
                {[1, 1.5, 2, 2.5, 3, 4].map(h => (
                  <TouchableOpacity
                    key={String(h)}
                    onPress={() => setIntervalHours(h)}
                    style={[
                      styles.badge,
                      intervalHours === h && styles.badgeActive
                    ]}
                  >
                    <Text style={[styles.badgeTxt, intervalHours === h && styles.badgeTxtActive]}>
                      {t('reminders.everyXHours', { hours: h })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* TIMELINE ÇİZELGESİ */}
              <View style={styles.timelineWrapper}>
                <Text style={styles.timelineTitle}>{t('reminders.previewTitle')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
                  {/* Başlangıç (Uyanma) */}
                  <View style={styles.timelineNode}>
                    <Text style={styles.nodeLabel}>{t('reminders.wake')}</Text>
                    <View style={[styles.nodeDot, { backgroundColor:'#F59E0B' }]} />
                    <Text style={styles.nodeTime}>{wakeStr}</Text>
                  </View>

                  {/* Aradaki Bildirimler */}
                  {previewTimes.map((d, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.line} />
                      <View style={styles.timelineNode}>
                        <View style={styles.nodeDot} />
                        <Text style={styles.nodeTime}>
                          {pad(d.getHours())}:{pad(d.getMinutes())}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {/* Bitiş (Uyku) - Opsiyonel, eğer liste sonu uykudan önceyse çizgi çek */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.line} />
                      <View style={styles.timelineNode}>
                        <Text style={styles.nodeLabel}>{t('reminders.sleep')}</Text>
                        <View style={[styles.nodeDot, { backgroundColor:'#6366F1' }]} />
                        <Text style={styles.nodeTime}>{sleepStr}</Text>
                      </View>
                  </View>

                </ScrollView>
              </View>

            </View>
            {frequencyDisabled && <Text style={styles.disabledText}>{t('reminders.disabledInline')}</Text>}
          </View>

          {/* Kaydet */}
          <TouchableOpacity style={styles.save} onPress={onSave}>
            <Text style={styles.saveTxt}>{t('reminders.save')}</Text>
          </TouchableOpacity>

          {/* Test */}
          <View style={styles.testArea}>
            <Text style={styles.testTitle}>{t('reminders.testPanel')}</Text>
            <View style={{flexDirection:'row', gap:10}}>
              <TouchableOpacity style={[styles.testBtn, {backgroundColor:'#0ea5e9', flex:1}]} onPress={onTestInOneMinute}>
                <Text style={styles.saveTxt}>{t('reminders.test1m')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.testBtn, {backgroundColor:'#374151', flex:1}]} onPress={() => DeviceEventEmitter.emit('OPEN_ONBOARD')}>
                <Text style={styles.saveTxt}>{t('reminders.onboard')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.testBtn, styles.cancel, {marginTop:10}]} onPress={async () => {
                await Notifications.cancelAllScheduledNotificationsAsync();
                Alert.alert(t('reminders.clearedTitle'));
            }}>
              <Text style={[styles.saveTxt, {color:'#B45309'}]}>{t('reminders.cancelAll')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: S.xl },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: S.lg },
  block: { backgroundColor: COLORS.card, borderRadius: 16, padding: S.lg, marginBottom: S.lg, elevation: 1 },
  label: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  subLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryEnd, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  
  infoBox: { flexDirection:'row', backgroundColor:'#EFF6FF', padding:10, borderRadius:10, marginTop:8 },
  infoText: { color: '#1E40AF', fontSize:12, flex:1, lineHeight:16 },

  badge: { backgroundColor:'#F3F4F6', borderRadius:10, paddingVertical:10, width:'30%', alignItems:'center', marginBottom:8, borderWidth:1, borderColor:'#E5E7EB' },
  badgeActive: { backgroundColor:'#EFF6FF', borderColor:COLORS.primaryEnd },
  badgeTxt: { fontWeight:'700', color: '#6B7280' },
  badgeTxtActive: { color: COLORS.primaryEnd },

  timelineWrapper: { marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  timelineTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 10, textTransform:'uppercase' },
  timelineScroll: { alignItems: 'center', paddingRight: 20 },
  timelineNode: { alignItems: 'center', width: 50 },
  nodeLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 4, fontWeight:'600' },
  nodeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryEnd, marginBottom: 4 },
  nodeTime: { fontSize: 12, fontWeight: '700', color: '#374151' },
  line: { width: 30, height: 2, backgroundColor: '#E5E7EB', marginTop: 4 }, // Çizgi biraz aşağıda kalsın

  save: { backgroundColor: COLORS.primaryEnd, borderRadius: 16, alignItems: 'center', paddingVertical: 16, marginTop: 10, elevation: 2 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  frequencyDisabled: { opacity: 0.4 },
  disabledText: { color:'#EF4444', marginTop:8, fontSize:12, fontWeight:'600' },

  testArea: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  testTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  testBtn: { borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  cancel: { backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#FDBA74' },
});
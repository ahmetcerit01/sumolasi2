import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHydrationStore } from '../storage/useHydrationStore';
import { COLORS } from '../theme/colors';
import { S } from '../theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// ------- helpers -------

// RemindersScreen.js (üst kısma ekle)
const REMINDER_IDS_KEY = 'SUMOLASI_REMINDER_IDS_V1';

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
  // second:5 -> “Kaydet” anında aynı dakikaya denk gelse bile hemen çalmaz
  const trigger = { hour, minute, second: 5, repeats: true, ...(Platform.OS === 'android' ? { channelId: 'hydration-daily' } : {}) };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Su Molası',
      body: 'Bir bardak su içme zamanı!',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'WATER_REMINDER' },
    },
    trigger,
  });
  return id;
}

async function scheduleDailyRemindersCalendar(times /* [{hour, minute}] */) {
  // izin
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Bildirim izni verilmedi.');

  await ensureAndroidChannel();
  await cancelExistingReminders();

  // normalize + tekilleştir + sırala
  const normalized = [...times]
    .map(t => ({
      hour: Math.max(0, Math.min(23, Number(t.hour))),
      minute: Math.max(0, Math.min(59, Number(t.minute))),
    }))
    .filter((t, i, arr) => arr.findIndex(x => x.hour === t.hour && x.minute === t.minute) === i)
    .sort((a, b) => (a.hour - b.hour) || (a.minute - b.minute));

  const ids = [];
  for (const t of normalized) {
    const id = await scheduleOneDailyCalendar(t);
    ids.push(id);
  }
  await AsyncStorage.setItem(REMINDER_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

const AWAKE_START_H = 9;
const AWAKE_START_M = 0;
const AWAKE_END_H   = 23;
const AWAKE_END_M   = 30;

// BUGÜN h:m
const todayAt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

// Bugünün tarih damgası YYYY-MM-DD (isteğe bağlı)
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

// Store + Storage birleştirerek bugünkü tüketimi olabilecek en doğru şekilde bul
const getConsumedTodaySafe = async (storeValue) => {
  let best = Number(storeValue || 0);
  const candidateKeys = [
    'TODAY_CONSUMED_ML',
    'consumedToday',
    'hydration_today_ml',
    'WATER_TODAY_ML',
    `TODAY_CONSUMED_ML_${todayKey()}`,
  ];
  try {
    const results = await AsyncStorage.multiGet(candidateKeys);
    for (const [, v] of results) {
      const num = Number(v);
      if (Number.isFinite(num)) best = Math.max(best, num);
    }
  } catch {}
  // Opsiyonel günlük log toparlama
  try {
    const log = await AsyncStorage.getItem('INTAKE_LOG'); // [{ts, ml}, ...] ise topla
    if (log) {
      const arr = JSON.parse(log);
      if (Array.isArray(arr)) {
        const start = todayAt(0, 0).getTime();
        const end = todayAt(23, 59).getTime();
        const sum = arr.reduce((acc, it) => {
          const ts = new Date(it?.ts || 0).getTime();
          const ml = Number(it?.ml || 0);
          if (ts >= start && ts <= end && Number.isFinite(ml)) acc += ml;
          return acc;
        }, 0);
        best = Math.max(best, sum);
      }
    }
  } catch {}
  return best;
};

export default function RemindersScreen() {
  // -------- store --------
  const goalMl    = useHydrationStore(s => s.goalMl);
  const setGoalMl = useHydrationStore(s => s.setGoalMl);

  const storeConsumedToday = useHydrationStore(s =>
    s.todayConsumedMl ?? s.todayTotalMl ?? s.totalTodayMl ?? s.todayMl ?? 0
  ) || 0;

  // -------- local ui state --------
  const [goal, setGoal] = useState(Number(goalMl || 2000));
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(2); // 1 | 1.5 | 2 | 3 | 4

  // Hedef picker (opsiyonel – mevcut UI korunuyor)
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [tempGoal, setTempGoal] = useState(goal);
  const openGoalPicker   = () => { setTempGoal(goal); setShowGoalPicker(true); };
  const confirmGoal      = () => { setShowGoalPicker(false); setGoal(tempGoal); };
  const cancelGoal       = () => { setShowGoalPicker(false); };

  useEffect(() => { setGoal(Number(goalMl || 2000)); }, [goalMl]);

  // Android heads-up kanalı
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
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
    })();
  }, []);

  const ensurePermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false }
      });
      return req.status === 'granted';
    }
    return true;
  };

  // Bildirim içeriği — sade metin
  const buildContent = () => ({
    title: 'Su Molası',
    body: 'Bir bardak su içme zamanı!',
    sound: 'default',
    data: { type: 'WATER_REMINDER' },
  });

  // 09:00–23:30 arasında sabit aralık (saat) listele
  const generateTimesFixedInterval = (hours) => {
    const intervalMinutes = Math.round(hours * 60); // 1.5 saat = 90 dk
    const start = todayAt(AWAKE_START_H, AWAKE_START_M);
    const end   = todayAt(AWAKE_END_H,   AWAKE_END_M);

    // Şimdiden sonraki en yakın slot (en az +60sn)
    const now = new Date();
    let t = new Date(Math.max(start.getTime(), now.getTime() + 60 * 1000));

    // t'yi ızgaraya oturt
    const minutesSinceStart = Math.max(0, Math.floor((t - start) / 60000));
    const offsetToNext = minutesSinceStart % intervalMinutes === 0
      ? 0
      : (intervalMinutes - (minutesSinceStart % intervalMinutes));
    t = new Date(t.getTime() + offsetToNext * 60000);

    const out = [];
    while (t <= end) {
      out.push(new Date(t));
      t = new Date(t.getTime() + intervalMinutes * 60000);
    }
    return out;
  };

  const onSave = async () => {
  // 1) hedefi doğrula + store'a yaz
  const newGoal = Number(goal);
  if (!Number.isFinite(newGoal) || newGoal <= 0) {
    Alert.alert('Hedef geçersiz', 'Günlük hedef (ml) pozitif bir sayı olmalı.');
    return;
  }
  try { if (typeof setGoalMl === 'function') setGoalMl(newGoal); } catch {}

  // 2) bugünkü tüketimi topla (hedef tamam ise kurma)
  const effectiveConsumed = await getConsumedTodaySafe(storeConsumedToday);

  // 3) Hatırlatıcılar kapalıysa yalnızca mevcut planları iptal et
  if (!enabled) {
    await cancelExistingReminders();
    Alert.alert('Kaydedildi', 'Hatırlatıcılar kapatıldı ve tüm planlar iptal edildi.');
    return;
  }

  // 4) Hedef zaten tamamlandıysa planlama yapma
  if (effectiveConsumed >= newGoal) {
    await cancelExistingReminders();
    Alert.alert('Harika!', 'Günlük hedef tamamlanmış. Yeni hatırlatma planlanmadı.');
    return;
  }

  // 5) Aralıklardan saat:dakika listesi üret
  const dates = generateTimesFixedInterval(intervalHours); // mevcut fonksiyonun
  const times = dates.map(d => ({ hour: d.getHours(), minute: d.getMinutes() }));

  try {
    // 6) Günlük tekrarlı takvim tetikleyicileri kur
    const count = await scheduleDailyRemindersCalendar(times);

    // 7) Bazı ayarları kaydet (opsiyonel)
    try {
      await AsyncStorage.multiSet([
        ['REMINDER_MODE', 'interval_hours'],
        ['REMINDER_INTERVAL_HOURS', String(intervalHours)],
        ['REMINDER_AWAKE_START', `${pad(AWAKE_START_H)}:${pad(AWAKE_START_M)}`],
        ['REMINDER_AWAKE_END', `${pad(AWAKE_END_H)}:${pad(AWAKE_END_M)}`],
        ['REMINDER_GOAL_ML', String(newGoal)],
      ]);
    } catch {}

    Alert.alert('Kaydedildi', `Günlük ${count} hatırlatıcı planlandı.`);
  } catch (e) {
    Alert.alert('Hata', e?.message || 'Hatırlatıcılar planlanamadı.');
  }
};


  // Sıklık alanı: off iken küçült & kilitle
  const frequencyDisabled = !enabled;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f7f7' }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: 12, paddingBottom: 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Hatırlatıcılar</Text>

          {/* Günlük Hedef */}
          <View style={styles.block}>
            <Text style={styles.label}>Günlük Hedef (ml)</Text>
            <TouchableOpacity style={styles.goalRow} onPress={openGoalPicker} activeOpacity={0.8}>
              <View style={{ flexDirection:'row', alignItems:'center' }}>
                <View style={styles.badge}><Text style={styles.badgeTxt}>{goal} ml</Text></View>
                <Text style={styles.small}>Değiştir</Text>
              </View>
              <Ionicons name={showGoalPicker ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.subtext} />
            </TouchableOpacity>

            {/* iOS goal wheel */}
            {Platform.OS === 'ios' && showGoalPicker && (
              <View style={styles.sheet}>
                <View style={{ height: 180, justifyContent: 'center' }}>
                  <Picker
                    selectedValue={tempGoal}
                    onValueChange={(v) => setTempGoal(v)}
                    itemStyle={{ fontWeight: '700', color: COLORS.text }}
                  >
                    {Array.from({ length: 39 }, (_, i) => 1200 + i * 100).map((ml) => (
                      <Picker.Item key={ml} label={`${ml} ml`} value={ml} />
                    ))}
                  </Picker>
                </View>
                <View style={styles.rowBetween}>
                  <TouchableOpacity onPress={cancelGoal} style={styles.actionBtn}>
                    <Text style={[styles.small,{fontWeight:'800'}]}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmGoal} style={styles.actionBtn}>
                    <Text style={[styles.small,{fontWeight:'800', color: COLORS.primaryEnd}]}>Tamam</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Android goal modal */}
            {Platform.OS === 'android' && (
              <Modal visible={showGoalPicker} transparent animationType="fade" onRequestClose={cancelGoal}>
                <View style={styles.modalContainer}>
                  <View style={styles.modalCard}>
                    <Picker
                      mode="dropdown"
                      selectedValue={tempGoal}
                      onValueChange={(v) => setTempGoal(v)}
                      dropdownIconColor={COLORS.subtext}
                      style={{ width: '100%' }}
                    >
                      {Array.from({ length: 39 }, (_, i) => 1200 + i * 100).map((ml) => (
                        <Picker.Item key={ml} label={`${ml} ml`} value={ml} />
                      ))}
                    </Picker>
                    <View style={[styles.rowBetween,{marginTop:12}] }>
                      <TouchableOpacity onPress={cancelGoal} style={styles.actionBtn}>
                        <Text style={[styles.small,{fontWeight:'800'}]}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={confirmGoal} style={styles.actionBtn}>
                        <Text style={[styles.small,{fontWeight:'800', color: COLORS.primaryEnd}]}>Tamam</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            )}

            <Text style={[styles.small, { marginTop: 8 }]}>
              Bugün içilen (tespit edilen): {storeConsumedToday} ml
            </Text>
          </View>

          {/* Sıklık + On/Off */}
          <View style={styles.block}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Sabit Aralıklar (09:00 – 23:30)</Text>
              <View style={styles.row}>
                <Text style={styles.small}>Aktif</Text>
                <Switch value={enabled} onValueChange={setEnabled} />
              </View>
            </View>

            <View
              style={[
                frequencyDisabled ? styles.frequencyDisabled : null,
              ]}
              pointerEvents={frequencyDisabled ? 'none' : 'auto'}
            >
              <Text style={[styles.small, { marginBottom: 8 }]}>Bildirim sıklığı</Text>
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                {[1, 1.5, 2, 2.5, 3, 4].map(h => (
                  <TouchableOpacity
                    key={String(h)}
                    onPress={() => setIntervalHours(h)}
                    style={[
                      styles.badge,
                      {
                        borderColor: intervalHours === h ? COLORS.primaryEnd : '#DBEAFE',
                        backgroundColor: intervalHours === h ? '#E0F2FE' : '#EFF6FF',
                        marginBottom: 8
                      }
                    ]}
                  >
                    <Text style={styles.badgeTxt}>
                      {h} saat
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!frequencyDisabled && (
                <Text style={[styles.hint, { marginTop: 8 }]}>
                  “Kaydet” ile bugün için tüm bildirimler planlanır.
                </Text>
              )}
            </View>

            {frequencyDisabled && (
              <Text style={[styles.hint, { marginTop: 8 }]}>
                Hatırlatıcı kapalı. Açtığında sıklık seçeneği aktif olur.
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.save} onPress={onSave}>
            <Text style={styles.saveTxt}>Kaydet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.save, styles.cancel]}
            onPress={async () => {
              await Notifications.cancelAllScheduledNotificationsAsync();
              Alert.alert('İptal edildi', 'Tüm planlı hatırlatıcılar kaldırıldı.');
            }}
          >
            <Text style={[styles.saveTxt, { color: '#B45309' }]}>Tüm Hatırlatıcıları İptal Et</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: S.xl },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: S.lg },
  block: { backgroundColor: COLORS.card, borderRadius: 16, padding: S.lg, marginBottom: S.lg },
  label: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  small: { color: COLORS.subtext, fontWeight: '700' },
  hint: { color: COLORS.subtext, marginTop: 8 },
  save: { backgroundColor: COLORS.primaryEnd, borderRadius: 16, alignItems: 'center', paddingVertical: 14, marginTop: S.md },
  saveTxt: { color: '#fff', fontWeight: '800' },
  cancel: { backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#FDBA74' },
  goalRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:2, borderColor:'#BFD8FF', borderRadius:12, paddingVertical:12, paddingHorizontal:12, backgroundColor:'#fff' },
  badge: { backgroundColor:'#EFF6FF', borderRadius:10, paddingHorizontal:10, paddingVertical:6, marginRight:8, borderWidth:1, borderColor:'#DBEAFE' },
  badgeTxt: { fontWeight:'800', color: COLORS.text },
  sheet: { marginTop:8, backgroundColor:'#fff', borderRadius:12, borderWidth:2, borderColor:'#BFD8FF', padding:8 },
  modalContainer: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', alignItems:'center', padding:24 },
  modalCard: { width:'100%', maxWidth:360, backgroundColor:'#fff', borderRadius:16, borderWidth:2, borderColor:'#BFD8FF', padding:12 },
  actionBtn: { paddingVertical:10, paddingHorizontal:16 },

  // off iken sıklık alanını küçült/soluklaştır
  frequencyDisabled: {
    opacity: 0.5,
    transform: [{ scale: 0.98 }],
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView, Alert, Modal } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHydrationStore } from '../storage/useHydrationStore';
import { COLORS } from '../theme/colors';
import { S } from '../theme/spacing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const parseHHMM = (val) => {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(val || '').trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
};

export default function RemindersScreen() {
    
const goalMl = useHydrationStore(s => s.goalMl);
const setGoalMl = useHydrationStore(s => s.setGoalMl);

  const [goal, setGoal] = useState(Number(goalMl || 2000));
  const [enabled, setEnabled] = useState(true);
  // Tek bir günlük hatırlatma saati (native picker ile)
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0); // varsayılan 09:00
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [tempGoal, setTempGoal] = useState(goal);
  const openGoalPicker = () => { setTempGoal(goal); setShowGoalPicker(true); };
  const confirmGoal = () => { setShowGoalPicker(false); setGoal(tempGoal); };
  const cancelGoal = () => { setShowGoalPicker(false); };
  const fmtHHMM = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  useEffect(() => { setGoal(Number(goalMl || 2000)); }, [goalMl]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Genel',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: true,
          });
        } catch (e) {}
      }
    })();
  }, []);

  const ensurePermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
      return req.status === 'granted';
    }
    return true;
  };

  const buildContent = () => ({
    title: '💧 Su Molası',
    body: '1 bardak su içme zamanı.',
    sound: 'default',
    data: { type: 'WATER_REMINDER' },
  });

  const onSave = async () => {
    // Hedef
    const newGoal = Number(goal);
    if (!Number.isFinite(newGoal) || newGoal <= 0) {
      Alert.alert('Hedef geçersiz', 'Günlük hedef (ml) pozitif bir sayı olmalı.');
      return;
    }
    try {
      if (typeof setGoalMl === 'function') setGoalMl(newGoal);
    } catch {}

    const ok = await ensurePermission();
    if (!ok) {
      Alert.alert('İzin gerekli', 'Bildirim izni olmadan hatırlatıcı kurulamaz.');
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
    if (enabled) {
      const content = buildContent();

      // Bir sonraki tetikleme zamanı (seçilen saat bugün geçtiyse yarın)
      const now = new Date();
      const next = new Date(now);
      next.setSeconds(0, 0);
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);

      const initialDelaySec = Math.max(60, Math.round((next.getTime() - now.getTime()) / 1000));
      console.log('[Reminders] single-shot in seconds:', initialDelaySec, 'for', next.toString());

      // Tek seferlik planla; teslim alındığında App.js yeniden +24saat kuracak
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: { seconds: initialDelaySec },
      });

      try {
        await AsyncStorage.setItem('REMINDER_TIME_HHMM', fmtHHMM(time));
      } catch {}
    }
    setShowPicker(false);
    Alert.alert('Kaydedildi', `Hatırlatma ${fmtHHMM(time)} için günlük olarak planlandı. Zamanı dilediğinde değiştirebilirsin.`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Hatırlatıcılar</Text>

        <View style={styles.block}>
          <Text style={styles.label}>Günlük Hedef (ml)</Text>
          {/* Collapsible header row */}
          <TouchableOpacity style={styles.goalRow} onPress={openGoalPicker} activeOpacity={0.8}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={styles.badge}><Text style={styles.badgeTxt}>{goal} ml</Text></View>
              <Text style={styles.small}>Değiştir</Text>
            </View>
            <Ionicons name={showGoalPicker ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.subtext} />
          </TouchableOpacity>

          {/* iOS inline wheel */}
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

          {/* Android modal picker */}
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
          <Text style={[styles.small, { marginTop: 8 }]}>Seçili hedef: {goal} ml</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Günlük Hatırlatmalar</Text>
            <View style={styles.row}> 
              <Text style={styles.small}>Aktif</Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </View>
          <View style={{ marginTop: S.md }}>
            <Text style={styles.small}>Hatırlatma Saati</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
              <Text style={{ fontWeight:'700', color: COLORS.text }}>{fmtHHMM(time)}</Text>
            </TouchableOpacity>
            {showPicker && (
              Platform.select({
                ios: (
                  <View style={{ marginTop: 8, backgroundColor:'#fff', borderRadius:12, borderWidth:2, borderColor:'#BFD8FF' }}>
                    <DateTimePicker
                      value={time}
                      mode="time"
                      display="spinner"
                      onChange={(_, d) => d && setTime(d)}
                      minuteInterval={1}
                    />
                    <TouchableOpacity onPress={() => setShowPicker(false)} style={{ padding:12, alignItems:'center' }}>
                      <Text style={{ fontWeight:'800', color: COLORS.primaryEnd }}>Tamam</Text>
                    </TouchableOpacity>
                  </View>
                ),
                android: (
                  <DateTimePicker
                    value={time}
                    mode="time"
                    display="default"
                    onChange={(e, d) => { setShowPicker(false); if (d) setTime(d); }}
                    is24Hour={true}
                  />
                ),
              })
            )}
            <Text style={styles.hint}>Varsayılan: 09:00. Her gün seçtiğin saatte 1 bildirim planlanır; zamanı dilediğinde değiştirebilirsin.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.save} onPress={onSave}>
          <Text style={styles.saveTxt}>Kaydet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.save, styles.cancel]} onPress={() => Notifications.cancelAllScheduledNotificationsAsync()}>
          <Text style={[styles.saveTxt, { color: '#B45309' }]}>Tüm Hatırlatıcıları İptal Et</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: S.xl },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: S.lg },
  block: { backgroundColor: COLORS.card, borderRadius: 16, padding: S.lg, marginBottom: S.lg },
  label: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: '#BFD8FF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, fontWeight: '700', color: COLORS.text, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rowInputs: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
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
});
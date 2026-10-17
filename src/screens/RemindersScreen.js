import React, { useEffect, useMemo, useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, ScrollView, Alert, DeviceEventEmitter, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useHydrationStore } from '../storage/useHydrationStore';
import { COLORS } from '../theme/colors';
import { S } from '../theme/spacing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  computeReminderTimes,
  scheduleReminders,
  disableReminders,
  getReminderSettings,
  parseHHMM,
} from '../utils/reminders';

import { LanguageContext } from '../i18n';

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);

// ------- COMPONENT -------

export default function RemindersScreen() {
  const profile = useHydrationStore(s => s.profile);
  const { t, locale } = useContext(LanguageContext);
  // Türkçede ondalık ayırıcı virgül (1,5 saatte bir)
  const fmtHours = (h) => (locale === 'tr' ? String(h).replace('.', ',') : String(h));

  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(2);

  // Uyanış/uyku saatleri profil (store) üzerinden gelir; Profil'de düzenlenince burası da güncellenir
  const wakeTime = parseHHMM(profile?.wakeAt, { h: 8, m: 0 });
  const sleepTime = parseHHMM(profile?.sleepAt, { h: 23, m: 0 });

  // Kayıtlı ayarları yükle
  useEffect(() => {
    getReminderSettings()
      .then(({ enabled: e, intervalHours: h }) => { setEnabled(e); setIntervalHours(h); })
      .catch(() => {});
  }, []);

  // Önizleme, gerçekte planlanan saatlerle birebir aynı listeden gelir
  const previewTimes = useMemo(
    () => computeReminderTimes(profile?.wakeAt, profile?.sleepAt, intervalHours),
    [profile?.wakeAt, profile?.sleepAt, intervalHours]
  );

  const onSave = async () => {
    try {
      if (!enabled) {
        await disableReminders();
        Alert.alert(t('reminders.savedTitle'), t('reminders.disabledMsg'));
        return;
      }
      const count = await scheduleReminders({ wakeAt: profile?.wakeAt, sleepAt: profile?.sleepAt, intervalHours });
      if (count < 0) {
        // İzin reddedilmiş: kullanıcıyı ayarlara yönlendir
        Alert.alert(t('reminders.permissionTitle'), t('reminders.permissionMsg'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('reminders.openSettings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      Alert.alert(t('reminders.savedTitle'), t('reminders.scheduledCount', { count }));
    } catch (e) {
      Alert.alert(t('reminders.errorTitle'), t('reminders.scheduleFailed'));
    }
  };

  // Test Fonksiyonları (sadece geliştirme sürümünde görünür)
  const onTestInOneMinute = async () => {
    await Notifications.scheduleNotificationAsync({
      content: { title: t('notifications.title'), body: t('notifications.body'), sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 60 },
    });
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
                      {t('reminders.everyXHours', { hours: fmtHours(h) })}
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
                          {pad(d.hour)}:{pad(d.minute)}
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

          {/* Test (yalnızca geliştirme sürümü; mağaza sürümünde kullanıcıya görünmez) */}
          {__DEV__ && (
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
          )}

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
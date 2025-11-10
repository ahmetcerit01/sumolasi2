// src/screens/ProfileScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { useHydrationStore } from '../storage/useHydrationStore';
import { COLORS as THEME_COLORS } from '../theme/colors';
import { BADGES } from '../constants/badges';
import BadgeIcon from '../components/BadgeIcon';

// Fallback renkler (theme yoksa)
const COLORS = THEME_COLORS || {
  bg: '#F8FAFF',
  card: '#FFFFFF',
  text: '#111827',
  subtext: '#6B7280',
  border: '#BFD8FF',
  primaryStart: '#7AD7F0',
  primaryEnd: '#5081E5',
};

const STORAGE_KEYS = {
  reminderTime: 'SUMOLASI_REMINDER_TIME',
  notifications: 'SUMOLASI_NOTIF_ENABLED',
  sound: 'SUMOLASI_SOUND_ENABLED',
};

const waterFacts = [
  'Limon dilimli su, C vitamini desteği sağlar ve ferahlatır.',
  'Güne bir bardak suyla başlamak metabolizmayı harekete geçirir.',
  'Yeterli su tüketimi cildin bariyer fonksiyonunu destekler.',
  'Öğünlerden önce su içmek tokluk hissini artırabilir.',
  'Alkali içecekler, bazı kişilerde mide yanmasını hafifletebilir.',
  'Sıcak havalarda terle birlikte su kaybı artar; günlük alımı artır.',
  'Kafeinli içecekler suyun yerini tutmaz; su alımını ayrıca takip et.',
  'Su; kas fonksiyonları, dolaşım ve ısı dengesi için kritiktir.',
  'Azar azar ama düzenli içmek, tek seferde çok içmekten daha konforludur.',
  'Soğuk su bazı kişilerde egzersiz sonrası toparlanmayı kolay hissettirebilir.',
];

// Foreground davranışı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    // SDK 54+: banner & list tercihleri
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ProfileScreen() {
  // Store
  const goalMl = useHydrationStore(s => s.goalMl);
  const setGoalMl = useHydrationStore(s => s.setGoalMl);

  // UI state
  const [reminderTime, setReminderTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [onboardProfile, setOnboardProfile] = useState(null);
  const [onboardGoal, setOnboardGoal] = useState(null);
  const [goalEditMl, setGoalEditMl] = useState(() => (typeof goalMl === 'number' && !Number.isNaN(goalMl) ? goalMl : 2000));
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  // Rozetler: store içinde farklı anahtar adlarını destekle
  const unlockedBadgesArr = useHydrationStore(s => s.unlockedBadges || s.unlockedBadgeIds || []);
  const badgesMap = useHydrationStore(s => s.badges || {});
  const mergedUnlockedSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(unlockedBadgesArr)) unlockedBadgesArr.forEach(id => set.add(String(id)));
    // badgesMap: { [id]: true/false }
    Object.keys(badgesMap).forEach(id => {
      if (badgesMap[id]) set.add(String(id));
    });
    return set;
  }, [unlockedBadgesArr, badgesMap]);
  const earnedBadges = useMemo(
    () => BADGES.filter(b => mergedUnlockedSet.has(String(b.id))),
    [mergedUnlockedSet]
  );

  const fact = useMemo(() => waterFacts[Math.floor(Math.random() * waterFacts.length)], []);

  // Storage'dan yükle
  useEffect(() => {
    (async () => {
      try {
        const [tRaw, notifRaw, soundRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.reminderTime),
          AsyncStorage.getItem(STORAGE_KEYS.notifications),
          AsyncStorage.getItem(STORAGE_KEYS.sound),
        ]);
        if (tRaw) {
          const parsed = JSON.parse(tRaw);
          const d = new Date();
          d.setHours(parsed.h ?? 9, parsed.m ?? 0, 0, 0);
          setReminderTime(d);
        }
        if (notifRaw !== null) setNotificationsEnabled(notifRaw === '1');
        if (soundRaw !== null) setSoundEnabled(soundRaw === '1');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [[, p], [, g]] = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
        const profile = p ? JSON.parse(p) : null;
        const goal = g ? Number(g) : null;
        setOnboardProfile(profile);
        if (typeof goal === 'number' && !Number.isNaN(goal)) {
          setOnboardGoal(goal);
          // Eğer store'da bir hedef yoksa veya 0'sa, düzenlenebilir hedefi onboard değeriyle başlat
          if (!(typeof goalMl === 'number' && !Number.isNaN(goalMl) && goalMl > 0)) {
            setGoalEditMl(goal);
          }
        }
      } catch {}
    })();
  }, []);

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.reminderTime,
        JSON.stringify({ h: reminderTime.getHours(), m: reminderTime.getMinutes() })
      );
      await AsyncStorage.setItem(STORAGE_KEYS.notifications, notificationsEnabled ? '1' : '0');
      await AsyncStorage.setItem(STORAGE_KEYS.sound, soundEnabled ? '1' : '0');

      // Günlük hedefi kaydet
      await AsyncStorage.setItem('DAILY_GOAL_ML', String(goalEditMl));
      setGoalMl(goalEditMl);

      // Günlük tek bildirim (Expo Go kısıtlı; dev build'te tam)
      if (notificationsEnabled) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('İzin Gerekli', 'Bildirim gönderebilmek için izin vermelisin.');
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync();
          const trigger = {
            hour: reminderTime.getHours(),
            minute: reminderTime.getMinutes(),
            repeats: true,
          };
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Su Molası',
              body: 'Bugünün su hedefi için bir bardak ekle.',
              sound: soundEnabled ? 'default' : null,
            },
            trigger,
          });
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }

      Alert.alert('Kaydedildi', 'Profil ayarların güncellendi.');
    } catch (e) {
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir sorun oluştu.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Ionicons name="water-outline" size={22} color={COLORS.card} />
            <Text style={styles.headerTitle}>Profil</Text>
          </View>
          <Text style={styles.headerSub}>Hedefini ve hatırlatıcılarını yönet.</Text>
        </View>

        {/* Settings Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Günlük Ayarlar</Text>

          {/* Önerilen hedef (readonly) */}
          <View style={[styles.itemRow, { opacity: 0.9 }]}> 
            <View style={styles.itemLeft}>
              <Ionicons name="sparkles-outline" size={20} color={COLORS.subtext} />
              <Text style={styles.itemLabel}>Önerilen hedef</Text>
            </View>
            <View style={styles.valuePill}>
              <Text style={styles.valuePillTxt}>{onboardGoal != null ? `${onboardGoal} ml` : '—'}</Text>
            </View>
          </View>

          {/* Günlük hedef (kullanıcı ayarlanabilir) */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="trophy-outline" size={20} color={COLORS.subtext} />
              <Text style={styles.itemLabel}>Günlük hedef</Text>
            </View>
            <TouchableOpacity
  style={[styles.valuePill, { flexDirection: 'row', alignItems: 'center' }]}
  activeOpacity={0.8}
  onPress={() => setShowGoalPicker(true)}
>
  <Text style={styles.valuePillTxt}>{goalEditMl} ml</Text>
  <Ionicons name="chevron-down-outline" size={18} color={COLORS.subtext} style={{ marginLeft: 4 }} />
</TouchableOpacity>
          </View>

          <Text style={styles.readonlyHint}>Önerilen hedef, kiloya göre otomatik hesaplanır. Günlük hedefi kendine göre ayarlayabilirsin.</Text>

          {/* Switches */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.subtext} />
              <Text style={styles.itemLabel}>Bildirimler</Text>
            </View>
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
          </View>

          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ionicons name="volume-high-outline" size={20} color={COLORS.subtext} />
              <Text style={styles.itemLabel}>Su sesi efekti</Text>
            </View>
            <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} activeOpacity={0.9}>
            <Text style={styles.saveTxt}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        {/* Facts Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Su Gerçekleri</Text>
          <View style={styles.factBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.subtext} style={{ marginRight: 6 }} />
            <Text style={styles.factTxt}>{fact}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
          {onboardProfile ? (
            <>
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="person-outline" size={20} color={COLORS.subtext} />
                  <Text style={styles.itemLabel}>Cinsiyet</Text>
                </View>
                <View style={styles.valuePill}><Text style={styles.valuePillTxt}>{onboardProfile.gender === 'male' ? 'Erkek' : 'Kadın'}</Text></View>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="fitness-outline" size={20} color={COLORS.subtext} />
                  <Text style={styles.itemLabel}>Ağırlık</Text>
                </View>
                <View style={styles.valuePill}><Text style={styles.valuePillTxt}>{onboardProfile.weightKg} kg</Text></View>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="sunny-outline" size={20} color={COLORS.subtext} />
                  <Text style={styles.itemLabel}>Uyanma</Text>
                </View>
                <View style={styles.valuePill}><Text style={styles.valuePillTxt}>{onboardProfile.wakeAt}</Text></View>
              </View>
              <View style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="moon-outline" size={20} color={COLORS.subtext} />
                  <Text style={styles.itemLabel}>Uyku</Text>
                </View>
                <View style={styles.valuePill}><Text style={styles.valuePillTxt}>{onboardProfile.sleepAt}</Text></View>
              </View>
              {onboardGoal != null && (
                <View style={styles.itemRow}>
                  <View style={styles.itemLeft}>
                    <Ionicons name="trophy-outline" size={20} color={COLORS.subtext} />
                    <Text style={styles.itemLabel}>Hedef</Text>
                  </View>
                  <View style={styles.valuePill}><Text style={styles.valuePillTxt}>{onboardGoal} ml</Text></View>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.emptyTxt}>Onboard verisi bulunamadı. Onboard’u tamamladığında burada görünecek.</Text>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 4, backgroundColor: '#2563EB' }]}
            onPress={async () => {
              try {
                const [[, p], [, g]] = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
                setOnboardProfile(p ? JSON.parse(p) : null);
                setOnboardGoal(g ? Number(g) : null);
                Alert.alert('Güncellendi', 'Onboard verileri yenilendi.');
              } catch {}
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.saveTxt}>Onboard Verisini Yenile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kazanılan Rozetler</Text>
          {earnedBadges.length === 0 ? (
            <Text style={styles.emptyTxt}>Henüz kazanılmış rozetin yok. Su ekledikçe rozetler açılır.</Text>
          ) : (
            <View style={styles.badgesWrap}>
              {earnedBadges.map(b => (
                <View key={b.id} style={styles.badgeItem}>
                  <BadgeIcon name={b.icon} unlocked />
                  <Text style={styles.badgeLabel}>{b.title}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    {/* Günlük hedef seçici modal */}
    {showGoalPicker && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Günlük Hedefini Seç</Text>
          <ScrollView>
            {[1000, 1500, 2000, 2500, 3000, 3500, 4000].map(v => (
              <TouchableOpacity
                key={v}
                onPress={() => { setGoalEditMl(v); setShowGoalPicker(false); }}
                style={styles.modalOption}
                activeOpacity={0.9}
              >
                <Text style={[styles.modalOptionTxt, goalEditMl === v && { color: '#2563EB', fontWeight: '800' }]}>
                  {v} ml
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setShowGoalPicker(false)} style={styles.modalCloseBtn} activeOpacity={0.9}>
            <Text style={styles.modalCloseTxt}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 16 },
  header: {
    backgroundColor: COLORS.primaryEnd,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: COLORS.card, fontSize: 18, fontWeight: '800', marginLeft: 8 },
  headerSub: { color: '#E6F0FF', marginTop: 6 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 8 },

  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemLabel: { marginLeft: 8, color: COLORS.text, fontWeight: '600' },
  valuePill: { backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  valuePillTxt: { fontWeight: '800', color: COLORS.text },

  saveBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primaryEnd,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveTxt: { color: '#fff', fontWeight: '800' },

  factBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5FE', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  factTxt: { flex: 1, color: COLORS.text },

  // New styles
  readonlyHint: { marginTop: 4, color: COLORS.subtext, fontSize: 12 },
  badgesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeItem: { width: 76, alignItems: 'center' },
  badgeLabel: { marginTop: 6, fontSize: 11, color: COLORS.subtext, textAlign: 'center' },
  emptyTxt: { color: COLORS.subtext },

  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepperBtn: { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  stepperBtnTxt: { color: '#fff', fontWeight: '800' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionTxt: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
  },
  modalCloseBtn: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseTxt: {
    color: '#fff',
    fontWeight: '800',
  },
});
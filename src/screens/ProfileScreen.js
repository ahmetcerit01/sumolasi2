import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  Switch, 
  Alert, 
  Animated, 
  Easing, 
  Dimensions, 
  Image,
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useHydrationStore } from '../storage/useHydrationStore';
import { BADGES } from '../constants/badges';
import BadgeIcon from '../components/BadgeIcon';

const { width, height } = Dimensions.get('window');

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
  'Sıcak havalarda terle birlikte su kaybı artar; günlük alımı artır.',
  'Su; kas fonksiyonları, dolaşım ve ısı dengesi için kritiktir.',
  'Azar azar ama düzenli içmek, tek seferde çok içmekten daha konforludur.',
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  
  // Store
  const goalMl = useHydrationStore(s => s.goalMl);
  const setGoalMl = useHydrationStore(s => s.setGoalMl);
  const badgesMap = useHydrationStore(s => s.badges || {});

  // Animasyonlar
  const bgAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // UI state
  const [reminderTime, setReminderTime] = useState(new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [onboardProfile, setOnboardProfile] = useState(null);
  const [onboardGoal, setOnboardGoal] = useState(null);
  const [goalEditMl, setGoalEditMl] = useState(goalMl || 2000);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const fact = useMemo(() => waterFacts[Math.floor(Math.random() * waterFacts.length)], []);
  const earnedCount = Object.keys(badgesMap).length;

  // Arkaplan Animasyonu
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();
  }, []);

  // Storage Yükleme
  useEffect(() => {
    (async () => {
      try {
        const [tRaw, notifRaw, soundRaw, [, p], [, g]] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.reminderTime),
          AsyncStorage.getItem(STORAGE_KEYS.notifications),
          AsyncStorage.getItem(STORAGE_KEYS.sound),
          AsyncStorage.getItem('ONBOARD_PROFILE').then(res => ['ONBOARD_PROFILE', res]),
          AsyncStorage.getItem('DAILY_GOAL_ML').then(res => ['DAILY_GOAL_ML', res])
        ]);

        if (tRaw) {
          const parsed = JSON.parse(tRaw);
          const d = new Date();
          d.setHours(parsed.h ?? 9, parsed.m ?? 0, 0, 0);
          setReminderTime(d);
        }
        if (notifRaw !== null) setNotificationsEnabled(notifRaw === '1');
        if (soundRaw !== null) setSoundEnabled(soundRaw === '1');

        // Onboard verileri
        if (p) setOnboardProfile(JSON.parse(p));
        if (g) {
           const gVal = Number(g);
           setOnboardGoal(gVal);
           // Eğer store'da hedef yoksa bunu kullan
           if (!goalMl) setGoalEditMl(gVal);
        }
      } catch {}
    })();
  }, []);

  // Hedef Store ile senkronize olsun (açılışta)
  useEffect(() => {
    if (goalMl) setGoalEditMl(goalMl);
  }, [goalMl]);

  const saveSettings = async () => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.reminderTime, JSON.stringify({ h: reminderTime.getHours(), m: reminderTime.getMinutes() })],
        [STORAGE_KEYS.notifications, notificationsEnabled ? '1' : '0'],
        [STORAGE_KEYS.sound, soundEnabled ? '1' : '0'],
        ['DAILY_GOAL_ML', String(goalEditMl)]
      ]);

      setGoalMl(goalEditMl); // Store güncelle

      // Bildirim Ayarla
      if (notificationsEnabled) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Su Molası', body: 'Hedefini tutturmak için bir bardak su iç!', sound: soundEnabled ? 'default' : null },
            trigger: { hour: reminderTime.getHours(), minute: reminderTime.getMinutes(), repeats: true },
          });
        } else {
          Alert.alert('İzin Gerekli', 'Bildirim izni verilmedi.');
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }

      Alert.alert('Başarılı', 'Profil ayarların güncellendi! 🎉');
    } catch (e) {
      Alert.alert('Hata', 'Kaydedilirken sorun oluştu.');
    }
  };

  // Animasyonlu Arkaplan Renkleri
  const bgTopColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['#E3F2FD', '#F3E5F5'] });

  // Header Animasyonu
  const headerScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolate: 'clamp'
  });

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      {/* CANLI ARKAPLAN */}
      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.9)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Dekoratif */}
        <View style={[styles.bubble, { top: -50, right: -50, width: 300, height: 300, backgroundColor: '#BBDEFB', opacity: 0.2 }]} />
        <View style={[styles.bubble, { top: height * 0.5, left: -50, width: 200, height: 200, backgroundColor: '#E1BEE7', opacity: 0.15 }]} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        
        {/* --- PROFİL HEADER --- */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 20 }]}>
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: headerScale }] }]}>
            <Image 
              source={{uri: 'https://cdn-icons-png.flaticon.com/128/11478/11478480.png'}} 
              style={styles.avatar} 
            />
          </Animated.View>
          
          <Text style={styles.userName}>Su Savaşçısı</Text>
          <View style={styles.badgeRow}>
             <View style={styles.miniBadge}>
                <Ionicons name="ribbon" size={14} color="#FFA000" />
                <Text style={styles.miniBadgeText}>{earnedCount} Rozet</Text>
             </View>
             <View style={[styles.miniBadge, {backgroundColor: '#E1F5FE'}]}>
                <Ionicons name="water" size={14} color="#039BE5" />
                <Text style={[styles.miniBadgeText, {color: '#0277BD'}]}>Seviye {Math.floor(earnedCount/3) + 1}</Text>
             </View>
          </View>
        </View>

        {/* --- BİLGİ KARTLARI (GRID) --- */}
        <View style={styles.statsGrid}>
           {/* Kilo */}
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E8F5E9'}]}>
                 <Ionicons name="fitness" size={20} color="#2E7D32" />
              </View>
              <View>
                 <Text style={styles.statLabel}>Ağırlık</Text>
                 <Text style={styles.statValue}>{onboardProfile?.weightKg || '--'} kg</Text>
              </View>
           </View>

           {/* Uyanma */}
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF3E0'}]}>
                 <Ionicons name="sunny" size={20} color="#EF6C00" />
              </View>
              <View>
                 <Text style={styles.statLabel}>Uyanış</Text>
                 <Text style={styles.statValue}>{onboardProfile?.wakeAt || '--:--'}</Text>
              </View>
           </View>

           {/* Uyku */}
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#F3E5F5'}]}>
                 <Ionicons name="moon" size={20} color="#8E24AA" />
              </View>
              <View>
                 <Text style={styles.statLabel}>Uyku</Text>
                 <Text style={styles.statValue}>{onboardProfile?.sleepAt || '--:--'}</Text>
              </View>
           </View>

           {/* Boy */}
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E3F2FD'}]}>
                 <Ionicons name="resize" size={20} color="#1565C0" />
              </View>
              <View>
                 <Text style={styles.statLabel}>Boy</Text>
                 <Text style={styles.statValue}>{onboardProfile?.heightCm || '--'} cm</Text>
              </View>
           </View>
        </View>

        <TouchableOpacity 
            style={styles.refreshLink} 
            onPress={() => Alert.alert("Bilgi", "Bilgilerini güncellemek için 'Onboard Verisini Yenile' butonunu kullanabilirsin.")}
        >
            <Text style={styles.refreshLinkText}>Bilgileri Düzenle</Text>
            <Ionicons name="chevron-forward" size={14} color="#90A4AE" />
        </TouchableOpacity>

        {/* --- HEDEF AYARI (BÜYÜK KART) --- */}
        <View style={styles.sectionCard}>
           <Text style={styles.sectionTitle}>Günlük Hedef</Text>
           
           <View style={styles.goalContainer}>
              <View>
                 <Text style={styles.goalSub}>Önerilen: {onboardGoal || 2500} ml</Text>
                 <TouchableOpacity style={styles.goalSelector} onPress={() => setShowGoalPicker(true)}>
                    <Text style={styles.goalValueMain}>{goalEditMl}</Text>
                    <Text style={styles.goalUnit}>ml</Text>
                    <Ionicons name="chevron-down" size={20} color="#374151" style={{marginLeft: 5}} />
                 </TouchableOpacity>
              </View>
              <View style={styles.goalIconCircle}>
                 <Ionicons name="trophy" size={32} color="#FFB300" />
              </View>
           </View>

           <View style={styles.divider} />

           {/* AYARLAR */}
           <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                 <View style={[styles.settingIcon, {backgroundColor: '#E0F2F1'}]}>
                    <Ionicons name="notifications" size={18} color="#00695C" />
                 </View>
                 <Text style={styles.settingText}>Bildirimler</Text>
              </View>
              <Switch 
                value={notificationsEnabled} 
                onValueChange={setNotificationsEnabled} 
                trackColor={{ true: '#4DB6AC', false: '#E0E0E0' }} 
                thumbColor={'#fff'}
              />
           </View>

           <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                 <View style={[styles.settingIcon, {backgroundColor: '#EDE7F6'}]}>
                    <Ionicons name="musical-notes" size={18} color="#5E35B1" />
                 </View>
                 <Text style={styles.settingText}>Ses Efektleri</Text>
              </View>
              <Switch 
                value={soundEnabled} 
                onValueChange={setSoundEnabled} 
                trackColor={{ true: '#7E57C2', false: '#E0E0E0' }} 
                thumbColor={'#fff'}
              />
           </View>
        </View>

        {/* --- KAYDET BUTONU --- */}
        <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} activeOpacity={0.9}>
           <LinearGradient
             colors={['#29B6F6', '#0288D1']}
             style={styles.saveBtnGradient}
             start={{x:0, y:0}} end={{x:1, y:0}}
           >
              <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginLeft: 8}} />
           </LinearGradient>
        </TouchableOpacity>

        {/* --- SU GERÇEĞİ (BİLGİ) --- */}
        <View style={styles.factCard}>
           <View style={styles.factHeader}>
              <Ionicons name="bulb" size={20} color="#FBC02D" />
              <Text style={styles.factTitle}>Biliyor muydun?</Text>
           </View>
           <Text style={styles.factText}>{fact}</Text>
        </View>

        {/* --- ONBOARD YENİLEME (ALT BUTON) --- */}
        <TouchableOpacity 
           style={styles.resetOnboardBtn} 
           onPress={async () => {
             try {
                // Sadece veri çekip logluyoruz, gerçek reset için navigation lazım olabilir
                const [[, p], [, g]] = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
                setOnboardProfile(p ? JSON.parse(p) : null);
                setOnboardGoal(g ? Number(g) : null);
                Alert.alert('Yenilendi', 'Veriler AsyncStorage\'dan tekrar çekildi.');
             } catch {}
           }}
        >
           <Text style={styles.resetOnboardText}>Onboard Verisini Yenile</Text>
        </TouchableOpacity>

      </Animated.ScrollView>

      {/* --- HEDEF SEÇİCİ MODAL --- */}
      {showGoalPicker && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowGoalPicker(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Hedefini Seç</Text>
            <ScrollView style={{maxHeight: 300}}>
              {[1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.modalOption, goalEditMl === v && styles.modalOptionSelected]}
                  onPress={() => { setGoalEditMl(v); setShowGoalPicker(false); }}
                >
                  <Text style={[styles.modalOptionText, goalEditMl === v && styles.modalOptionTextSelected]}>
                    {v} ml
                  </Text>
                  {goalEditMl === v && <Ionicons name="checkmark" size={20} color="#0288D1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowGoalPicker(false)}>
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  animatedBg: { ...StyleSheet.absoluteFillObject },
  bubble: { position: 'absolute', borderRadius: 999 },

  /* Header */
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, marginBottom: 12, position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff' },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#29B6F6', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  userName: { fontSize: 24, fontWeight: '800', color: '#1A237E' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  miniBadgeText: { fontSize: 12, fontWeight: '700', color: '#FF8F00', marginLeft: 4 },

  /* Grid Stats */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#374151' },

  refreshLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  refreshLinkText: { color: '#90A4AE', fontSize: 13, fontWeight: '600', marginRight: 4 },

  /* Main Settings Card */
  sectionCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#90A4AE', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  goalContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalSub: { fontSize: 13, color: '#90A4AE', fontWeight: '500', marginBottom: 4 },
  goalSelector: { flexDirection: 'row', alignItems: 'baseline' },
  goalValueMain: { fontSize: 32, fontWeight: '800', color: '#1A237E' },
  goalUnit: { fontSize: 16, fontWeight: '600', color: '#90A4AE', marginLeft: 4 },
  goalIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF8E1', alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 20 },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  settingText: { fontSize: 16, fontWeight: '600', color: '#374151' },

  /* Save Button */
  saveBtn: { marginHorizontal: 16, marginBottom: 24, borderRadius: 20, shadowColor: '#0288D1', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  saveBtnGradient: { paddingVertical: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  /* Fact Card */
  factCard: { marginHorizontal: 16, backgroundColor: '#FFFDE7', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FFF59D', marginBottom: 24 },
  factHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  factTitle: { fontSize: 14, fontWeight: '700', color: '#F9A825', marginLeft: 6 },
  factText: { fontSize: 14, color: '#F57F17', lineHeight: 20 },

  /* Reset Text */
  resetOnboardBtn: { alignItems: 'center', padding: 10 },
  resetOnboardText: { color: '#B0BEC5', fontWeight: '600', fontSize: 13 },

  /* Modal */
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16, color: '#1A237E' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOptionSelected: { backgroundColor: '#E1F5FE', marginHorizontal: -24, paddingHorizontal: 24 },
  modalOptionText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  modalOptionTextSelected: { color: '#0288D1', fontWeight: '800' },
  modalClose: { marginTop: 16, alignItems: 'center', padding: 12 },
  modalCloseText: { color: '#F44336', fontWeight: '700' }
});
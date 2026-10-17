import React, { useEffect, useMemo, useState, useRef, useContext } from 'react';
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
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker'; 

import { useHydrationStore } from '../storage/useHydrationStore';
import { BADGES } from '../constants/badges';
import BadgeIcon from '../components/BadgeIcon';
import { LanguageContext } from '../i18n';
import { scheduleReminders, disableReminders, getReminderSettings, rescheduleIfEnabled } from '../utils/reminders';



const { width, height } = Dimensions.get('window');
// Profil avatarları (lokal dosyalar)
// Not: assets klasörünün proje kökünde olduğunu varsayıyoruz.
const MALE_AVATAR = require('../../assets/illustrations/male.png');
const FEMALE_AVATAR = require('../../assets/illustrations/female.png');

const STORAGE_KEYS = {
  sound: 'SUMOLASI_SOUND_ENABLED',
};

// Not: Bildirim handler'ı App.js'te tek yerden tanımlı. Burada ikinci kez tanımlanınca
// shouldPlaySound:false ile App.js'tekini eziyor ve hatırlatıcılar sessiz geliyordu.

export default function ProfileScreen() {
    const { locale, setLanguage, t } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();
  
  // --- STORE ENTEGRASYONU ---
  const { 
    goalMl, 
    setGoalMl, 
    badges, 
    profile, 
    recommendedGoal, 
    updateProfile,
    // Eğer store'da bu fonksiyonlar yoksa (önceki adımlarda eklemediysek) 
    // aşağıda manuel yöneteceğiz, varsa kullanacağız.
    setNotifications, 
    setSound,
    notificationsEnabled: storeNotifEnabled,
    soundEnabled: storeSoundEnabled
  } = useHydrationStore();

  const badgesMap = badges || {};

  // Animasyonlar
  const bgAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // UI state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Hedef & Modal State'leri
  const [goalEditMl, setGoalEditMl] = useState(goalMl || 2500);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Profil Düzenleme State'leri
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWake, setEditWake] = useState(new Date());
  const [editSleep, setEditSleep] = useState(new Date());
  const [showWakePicker, setShowWakePicker] = useState(false);
  const [showSleepPicker, setShowSleepPicker] = useState(false);

  const factIndex = useMemo(() => Math.floor(Math.random() * 7), []);
  const facts = t('profile.facts');
  const fact = Array.isArray(facts) ? facts[factIndex % facts.length] : '';
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

  // Ayarları yükle: bildirim anahtarı gerçek hatırlatıcı durumunu gösterir
  useEffect(() => {
    getReminderSettings().then(({ enabled }) => setNotificationsEnabled(enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    if (storeSoundEnabled !== undefined) setSoundEnabled(storeSoundEnabled);
  }, [storeSoundEnabled]);

  // Hedef Store ile senkronize olsun
  useEffect(() => {
    if (goalMl) setGoalEditMl(goalMl);
  }, [goalMl]);

  // --- DİNAMİK FONKSİYONLAR ---

  // Hatırlatıcılar ekranıyla aynı ayarı kullanır (eskiden iki ayrı anahtar vardı)
  const toggleNotifications = async (value) => {
    setNotificationsEnabled(value);
    if (setNotifications) setNotifications(value);

    if (!value) {
      await disableReminders();
      return;
    }
    const { intervalHours } = await getReminderSettings();
    const count = await scheduleReminders({ wakeAt: profile?.wakeAt, sleepAt: profile?.sleepAt, intervalHours });
    if (count < 0) {
      // İzin yoksa anahtar açık görünmesin
      setNotificationsEnabled(false);
      if (setNotifications) setNotifications(false);
      Alert.alert(t('reminders.permissionTitle'), t('reminders.permissionMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reminders.openSettings'), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const toggleSound = async (value) => {
    setSoundEnabled(value);
    
    // 1. Store varsa güncelle
    if (setSound) setSound(value);

    // 2. Storage'a yaz
    await AsyncStorage.setItem(STORAGE_KEYS.sound, value ? '1' : '0');
  };

  // --- PROFİL DÜZENLEME ---

  const openEditModal = () => {
    setEditWeight(String(profile?.weight || 70));
    setEditHeight(String(profile?.height || 170));
    
    const wakeDate = new Date();
    const [wh, wm] = (profile?.wakeAt || "08:00").split(':');
    wakeDate.setHours(parseInt(wh), parseInt(wm));
    setEditWake(wakeDate);

    const sleepDate = new Date();
    const [sh, sm] = (profile?.sleepAt || "23:00").split(':');
    sleepDate.setHours(parseInt(sh), parseInt(sm));
    setEditSleep(sleepDate);

    setShowEditProfile(true);
  };

  const handleSaveProfile = () => {
    const w = parseInt(editWeight);
    const h = parseInt(editHeight);

    if (!w || !h || w < 30 || w > 250 || h < 100 || h > 250) {
      Alert.alert(t('alert.error'), t('profile.invalidInput'));
      return;
    }

    const wakeStr = `${String(editWake.getHours()).padStart(2, '0')}:${String(editWake.getMinutes()).padStart(2, '0')}`;
    const sleepStr = `${String(editSleep.getHours()).padStart(2, '0')}:${String(editSleep.getMinutes()).padStart(2, '0')}`;

    updateProfile({
      weight: w,
      height: h,
      wakeAt: wakeStr,
      sleepAt: sleepStr
    });
    // Uyanış/uyku değiştiyse hatırlatıcılar yeni saatlere göre kurulsun
    rescheduleIfEnabled({ wakeAt: wakeStr, sleepAt: sleepStr }).catch(() => {});

    setShowEditProfile(false);
    Alert.alert(t('profile.updatedTitle'), t('profile.updatedMsg'));
  };

  // --- SADECE HEDEFİ KAYDET ---
  const saveGoalSettings = async () => {
    try {
      await AsyncStorage.setItem('DAILY_GOAL_ML', String(goalEditMl));
      setGoalMl(goalEditMl);
      Alert.alert(t('profile.goalSavedTitle'), t('profile.goalSavedMsg'));
    } catch (e) {
      Alert.alert(t('alert.error'), t('profile.saveError'));
    }
  };

  const bgTopColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['#E3F2FD', '#F3E5F5'] });
  const headerScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.5, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      {/* ARKAPLAN */}
      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.9)']} style={StyleSheet.absoluteFill} />
        <View style={[styles.bubble, { top: -50, right: -50, width: 300, height: 300, backgroundColor: '#BBDEFB', opacity: 0.2 }]} />
        <View style={[styles.bubble, { top: height * 0.5, left: -50, width: 200, height: 200, backgroundColor: '#E1BEE7', opacity: 0.15 }]} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        
        {/* HEADER */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + 20 }]}>
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: headerScale }] }]}>
            <Image
              source={
                (profile?.gender === 'female' || profile?.gender === 'woman' || profile?.gender === 'kadın')
                  ? FEMALE_AVATAR
                  : MALE_AVATAR
              }
              style={styles.avatar}
            />
            <TouchableOpacity style={styles.editIconBadge} onPress={openEditModal}>
               <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
          
        <Text style={styles.userName}>{t('profile.userTitle')}</Text>
          <View style={styles.badgeRow}>
             <View style={styles.miniBadge}>
                <Ionicons name="ribbon" size={14} color="#FFA000" />
                <Text style={styles.miniBadgeText}>{t('profile.badgeCount', { count: earnedCount })}</Text>
             </View>
             <View style={[styles.miniBadge, {backgroundColor: '#E1F5FE'}]}>
                <Ionicons name="water" size={14} color="#039BE5" />
                <Text style={[styles.miniBadgeText, {color: '#0277BD'}]}>{t('profile.level', { level: Math.floor(earnedCount/3) + 1 })}</Text>
             </View>
          </View>
        </View>

        {/* BİLGİ KARTLARI */}
        <View style={styles.statsGrid}>
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E8F5E9'}]}><Ionicons name="fitness" size={20} color="#2E7D32" /></View>
              <View><Text style={styles.statLabel}>{t('profile.weight')}</Text><Text style={styles.statValue}>{profile?.weight || '--'} {t('units.kg')}</Text></View>
           </View>
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E3F2FD'}]}><Ionicons name="resize" size={20} color="#1565C0" /></View>
              <View><Text style={styles.statLabel}>{t('profile.height')}</Text><Text style={styles.statValue}>{profile?.height || '--'} {t('units.cm')}</Text></View>
           </View>
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF3E0'}]}><Ionicons name="sunny" size={20} color="#EF6C00" /></View>
              <View><Text style={styles.statLabel}>{t('profile.wake')}</Text><Text style={styles.statValue}>{profile?.wakeAt || '--:--'}</Text></View>
           </View>
           <View style={styles.statCard}>
              <View style={[styles.iconBox, {backgroundColor: '#F3E5F5'}]}><Ionicons name="moon" size={20} color="#8E24AA" /></View>
              <View><Text style={styles.statLabel}>{t('profile.sleep')}</Text><Text style={styles.statValue}>{profile?.sleepAt || '--:--'}</Text></View>
           </View>
        </View>

        <TouchableOpacity style={styles.refreshLink} onPress={openEditModal}>
        <Text style={styles.refreshLinkText}>{t('profile.editInfo')}</Text>
            <Ionicons name="create-outline" size={16} color="#90A4AE" />
        </TouchableOpacity>

        {/* HEDEF & AYARLAR */}
        <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('profile.dailyGoal')}</Text>
           
           <View style={styles.goalContainer}>
              <View>
              <Text style={styles.goalSub}>{t('profile.recommended')}: {recommendedGoal || 2500} {t('units.ml')}</Text>
                 <TouchableOpacity style={styles.goalSelector} onPress={() => setShowGoalPicker(true)}>
                    <Text style={styles.goalValueMain}>{goalEditMl}</Text>
                    <Text style={styles.goalUnit}>{t('units.ml')}</Text>
                    <Ionicons name="chevron-down" size={20} color="#374151" style={{marginLeft: 5}} />
                 </TouchableOpacity>
              </View>
              <View style={styles.goalIconCircle}><Ionicons name="trophy" size={32} color="#FFB300" /></View>
           </View>

           <View style={styles.divider} />

           {/* Dil */}
           <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                 <View style={[styles.settingIcon, { backgroundColor: '#E3F2FD' }]}>
                   <Ionicons name="language" size={18} color="#1565C0" />
                 </View>
                 <Text style={styles.settingText}>{t('settings.language')}</Text>
              </View>

              <View style={styles.langPillWrap}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setLanguage('en')}
                  style={[styles.langPill, locale === 'en' && styles.langPillActive]}
                >
                  <Text style={[styles.langPillText, locale === 'en' && styles.langPillTextActive]}>
                    {t('settings.english')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setLanguage('tr')}
                  style={[styles.langPill, locale === 'tr' && styles.langPillActive]}
                >
                  <Text style={[styles.langPillText, locale === 'tr' && styles.langPillTextActive]}>
                    {t('settings.turkish')}
                  </Text>
                </TouchableOpacity>
              </View>
           </View>

           {/* Bildirimler */}
           <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                 <View style={[styles.settingIcon, { backgroundColor: '#E0F2F1' }]}>
                   <Ionicons name="notifications" size={18} color="#00695C" />
                 </View>
            <Text style={styles.settingText}>{t('settings.notifications')}</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ true: '#4DB6AC', false: '#E0E0E0' }}
                thumbColor={'#fff'}
              />
           </View>

           {/* Sesler */}
           <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                 <View style={[styles.settingIcon, {backgroundColor: '#EDE7F6'}]}><Ionicons name="musical-notes" size={18} color="#5E35B1" /></View>
              <Text style={styles.settingText}>{t('settings.soundFx')}</Text>
              </View>
              <Switch 
                value={soundEnabled} 
                onValueChange={toggleSound} 
                trackColor={{ true: '#7E57C2', false: '#E0E0E0' }} 
                thumbColor={'#fff'}
              />
           </View>
        </View>

        {/* KAYDET (Sadece Hedef) */}
        <TouchableOpacity style={styles.saveBtn} onPress={saveGoalSettings} activeOpacity={0.9}>
           <LinearGradient colors={['#29B6F6', '#0288D1']} style={styles.saveBtnGradient} start={{x:0, y:0}} end={{x:1, y:0}}>
            <Text style={styles.saveBtnText}>{t('profile.updateGoal')}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginLeft: 8}} />
           </LinearGradient>
        </TouchableOpacity>

        <View style={styles.factCard}>
           <View style={styles.factHeader}><Ionicons name="bulb" size={20} color="#FBC02D" /><Text style={styles.factTitle}>{t('profile.tip')}</Text></View>
           <Text style={styles.factText}>{fact}</Text>
        </View>

      </Animated.ScrollView>

      {/* --- PROFİL DÜZENLEME MODALI --- */}
      <Modal animationType="slide" transparent={true} visible={showEditProfile} onRequestClose={() => setShowEditProfile(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.modalHeaderRow}>
               <Text style={styles.modalTitle}>{t('profile.editTitle')}</Text>
               <TouchableOpacity onPress={() => setShowEditProfile(false)}><Ionicons name="close" size={24} color="#333"/></TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
               <Text style={styles.inputLabel}>{t('profile.weightInput')}</Text>
               <TextInput style={styles.inputBox} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" placeholder="70" />
            </View>
            <View style={styles.inputGroup}>
               <Text style={styles.inputLabel}>{t('profile.heightInput')}</Text>
               <TextInput style={styles.inputBox} value={editHeight} onChangeText={setEditHeight} keyboardType="numeric" placeholder="170" />
            </View>
            <View style={styles.rowInputs}>
               <TouchableOpacity style={styles.timeInput} onPress={() => setShowWakePicker(true)}>
                  <Text style={styles.inputLabel}>{t('profile.wake')}</Text>
                  <Text style={styles.timeValue}>{String(editWake.getHours()).padStart(2,'0')}:{String(editWake.getMinutes()).padStart(2,'0')}</Text>
               </TouchableOpacity>
               <TouchableOpacity style={styles.timeInput} onPress={() => setShowSleepPicker(true)}>
                  <Text style={styles.inputLabel}>{t('profile.sleep')}</Text>
                  <Text style={styles.timeValue}>{String(editSleep.getHours()).padStart(2,'0')}:{String(editSleep.getMinutes()).padStart(2,'0')}</Text>
               </TouchableOpacity>
            </View>
            {(showWakePicker || showSleepPicker) && (
               Platform.OS === 'ios' ? (
                  <DateTimePicker
                     value={showWakePicker ? editWake : editSleep}
                     mode="time"
                     display="spinner"
                     onValueChange={(e, d) => { if (d) showWakePicker ? setEditWake(d) : setEditSleep(d); }}
                     style={{height: 120}}
                  />
               ) : (
                  <DateTimePicker
                     value={showWakePicker ? editWake : editSleep}
                     mode="time"
                     is24Hour
                     onValueChange={(e, d) => { setShowWakePicker(false); setShowSleepPicker(false); if (d) showWakePicker ? setEditWake(d) : setEditSleep(d); }}
                     onDismiss={() => { setShowWakePicker(false); setShowSleepPicker(false); }}
                  />
               )
            )}
            {Platform.OS === 'ios' && (showWakePicker || showSleepPicker) && (
               <TouchableOpacity onPress={() => {setShowWakePicker(false); setShowSleepPicker(false)}} style={{alignItems:'flex-end', padding:10}}>
                  <Text style={{color:'#0288D1', fontWeight:'700'}}>{t('common.ok')}</Text>
               </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveProfile}>
               <Text style={styles.saveModalBtnText}>{t('profile.saveAndCalc')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- HEDEF SEÇİCİ MODAL --- */}
      {showGoalPicker && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowGoalPicker(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.chooseGoal')}</Text>
            <ScrollView style={{maxHeight: 300}}>
              {[1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.modalOption, goalEditMl === v && styles.modalOptionSelected]}
                  onPress={() => { setGoalEditMl(v); setShowGoalPicker(false); }}
                >
                  <Text style={[styles.modalOptionText, goalEditMl === v && styles.modalOptionTextSelected]}>
                    {v} {t('units.ml')}
                  </Text>
                  {goalEditMl === v && <Ionicons name="checkmark" size={20} color="#0288D1" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowGoalPicker(false)}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
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
  headerContainer: { alignItems: 'center', marginBottom: 24 },
  avatarContainer: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, marginBottom: 12, position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff' },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#29B6F6', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  userName: { fontSize: 24, fontWeight: '800', color: '#1A237E' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  miniBadgeText: { fontSize: 12, fontWeight: '700', color: '#FF8F00', marginLeft: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statLabel: { fontSize: 12, color: '#90A4AE', fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#374151' },
  refreshLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  refreshLinkText: { color: '#90A4AE', fontSize: 13, fontWeight: '600', marginRight: 4 },
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
    langPillWrap: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    padding: 4,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  langPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },
  langPillTextActive: {
    color: '#111827',
  },
  saveBtn: { marginHorizontal: 16, marginBottom: 24, borderRadius: 20, shadowColor: '#0288D1', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  saveBtnGradient: { paddingVertical: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  factCard: { marginHorizontal: 16, backgroundColor: '#FFFDE7', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FFF59D', marginBottom: 24 },
  factHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  factTitle: { fontSize: 14, fontWeight: '700', color: '#F9A825', marginLeft: 6 },
  factText: { fontSize: 14, color: '#F57F17', lineHeight: 20 },
  resetOnboardBtn: { alignItems: 'center', padding: 10 },
  resetOnboardText: { color: '#B0BEC5', fontWeight: '600', fontSize: 13 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  editModalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#546E7A', marginBottom: 6 },
  inputBox: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 16, color: '#333', fontWeight: '600' },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  timeInput: { width: '48%', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, alignItems: 'center' },
  timeValue: { fontSize: 18, fontWeight: '800', color: '#0288D1', marginTop: 4 },
  saveModalBtn: { backgroundColor: '#29B6F6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  saveModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16, color: '#1A237E' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOptionSelected: { backgroundColor: '#E1F5FE', marginHorizontal: -24, paddingHorizontal: 24 },
  modalOptionText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  modalOptionTextSelected: { color: '#0288D1', fontWeight: '800' },
  modalClose: { marginTop: 16, alignItems: 'center', padding: 12 },
  modalCloseText: { color: '#F44336', fontWeight: '700' }
});
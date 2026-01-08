import React, { useState, useRef, useEffect, useMemo, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  ScrollView,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  Dimensions,
  Easing,
  NativeModules
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

import WaterGlass from "../components/WaterGlass";
import { useHydrationStore } from "../storage/useHydrationStore";
import { COLORS } from "../theme/colors";
import { S } from "../theme/spacing";

import subardagi from "../../assets/subardagi.png";
import susisesi from "../../assets/susisesi.png";
import fincan from "../../assets/fincan.png";

// Profil avatarları (lokal dosyalar)
const MALE_AVATAR = require('../../assets/illustrations/male.png');
const FEMALE_AVATAR = require('../../assets/illustrations/female.png');

import { LanguageContext } from "../../App";

const { width, height } = Dimensions.get("window");

// --- İPUÇLARI HAVUZU ---
const WATER_TIPS_TR = [
  "Sabah uyanınca bir bardak su içmek metabolizmanı %24 hızlandırır.",
  "Beyninin %75'i sudan oluşur. Odaklanmak için su iç!",
  "Yemeklerden 30 dakika önce su içmek sindirimi kolaylaştırır.",
  "Baş ağrısının en yaygın nedenlerinden biri susuzluktur.",
  "Cildinin parlaması için pahalı kremlere değil, suya ihtiyacın var.",
  "Su içmek kas yorgunluğunu azaltır ve performansı artırır.",
  "Soğuk su içmek vücudun ısısını dengelemeye yardımcı olur."
];

const WATER_TIPS_EN = [
  "Drinking a glass of water after waking up can boost metabolism.",
  "Your brain is mostly water—drink to stay focused.",
  "Drinking water 30 minutes before meals can help digestion.",
  "One of the most common causes of headaches is dehydration.",
  "For glowing skin, water matters more than expensive creams.",
  "Hydration can reduce muscle fatigue and improve performance.",
  "Cold water may help regulate body temperature."
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const { locale, t } = useContext(LanguageContext);

  const totalMl = useHydrationStore((s) => s.totalMl);
  const goalMl = useHydrationStore((s) => s.goalMl);
  const add = useHydrationStore((s) => s.add);
  const resetToday = useHydrationStore((s) => s.resetToday);
  const resetAll = useHydrationStore((s) => s.resetAll);
  const streakDays = useHydrationStore((s) => s.streakDays);
  // Profil bilgisi (store'da varsa). Yoksa default male gösterir.
  const profile = useHydrationStore((s) => s.profile);

  // Ses Ayarını Kontrol Et
  const soundEnabled = useHydrationStore((s) => s.soundEnabled);

  const safeGoal = goalMl || 2500;
  const pctText = Math.round(Math.min((totalMl / Math.max(safeGoal, 1)) * 100, 100));

  const [modalVisible, setModalVisible] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  // Rastgele İpucu Seç (Her açılışta değişmemesi için useMemo)
  const tipsPool = useMemo(() => (locale === 'tr' ? WATER_TIPS_TR : WATER_TIPS_EN), [locale]);
  const dailyTip = useMemo(() => tipsPool[Math.floor(Math.random() * tipsPool.length)], [tipsPool]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();
  }, []);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const titleScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp'
  });

  const soundRef = useRef(null);

  // iOS Widget/App Group senkronu (Native Module)
  // Not: SharedWaterStore native modülü iOS tarafında ekli olmalı.
  const { SharedWaterStore } = NativeModules;

  // DEBUG: Native module bağlantısı geliyor mu?
  useEffect(() => {
    if (Platform.OS === "ios") {
      // Bu log Xcode console'a düşer
      console.log("SharedWaterStore module:", SharedWaterStore);

      // Fonksiyonlar varsa bugünkü değeri de çekelim
      if (SharedWaterStore && typeof SharedWaterStore.getTodayWater === "function") {
        SharedWaterStore.getTodayWater((value) => {
          console.log("SharedWaterStore getTodayWater:", value);
        });
      }
    }
  }, []);

  const syncTodayWaterToWidget = (nextTotalMl) => {
    if (Platform.OS !== "ios") return;
    try {
      if (SharedWaterStore && typeof SharedWaterStore.setTodayWater === "function") {
        SharedWaterStore.setTodayWater(nextTotalMl);
      }
    } catch (e) {
      // Sessiz geç: widget senkronu opsiyonel
    }
  };

  const playWaterSound = async () => {
    // Ses kapalıysa çalma
    if (soundEnabled === false) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      const { sound } = await Audio.Sound.createAsync(require("../../assets/sounds/water.mp3"));
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {}
  };

  const quickAdd = async (ml) => {
    // Store güncellemesi
    add(ml);

    // Widget için App Group'a bugünkü toplamı yaz (store async olabileceği için tahmini next değeri gönderiyoruz)
    const nextTotal = (Number(totalMl) || 0) + (Number(ml) || 0);
    syncTodayWaterToWidget(nextTotal);

    playWaterSound();
  };

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount);
    if (!isNaN(amount) && amount > 0) {
      quickAdd(amount);
      setCustomAmount("");
      setModalVisible(false);
    } else {
      Alert.alert(t('alert.error'), t('alert.validAmount'));
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? t('home.goodMorning')
      : hour >= 11 && hour < 19
      ? t('home.goodDay')
      : t('home.goodEvening');

  const bgTopColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E0F7FA', '#E3F2FD']
  });

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.bubble, { top: 100, left: -20, width: 150, height: 150, backgroundColor: '#B3E5FC', opacity: 0.2 }]} />
        <View style={[styles.bubble, { top: height * 0.4, right: -50, width: 200, height: 200, backgroundColor: '#E1BEE7', opacity: 0.15 }]} />
      </Animated.View>

      <Animated.View style={[styles.stickyHeader, { height: insets.top + 60, opacity: headerOpacity, paddingTop: insets.top }]}>
        <Text style={styles.stickyTitle}>{t('home.today')}</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 20 }}
      >
        
        <View style={styles.headerContainer}>
          <Animated.View style={{ transform: [{ scale: titleScale }] }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.subGreeting}>{t('home.ready')}</Text>
          </Animated.View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate("Profil")}>
            <Image
              source={
                (profile?.gender === 'female' || profile?.gender === 'woman' || profile?.gender === 'kadın')
                  ? FEMALE_AVATAR
                  : MALE_AVATAR
              }
              style={styles.avatar}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.glassBackground} />
          
          <View style={styles.counterRow}>
             <View>
                <Text style={styles.goalLabel}>{t('home.dailyGoal')}</Text>
                <Text style={styles.goalValue}>{safeGoal} ml</Text>
             </View>
             <View style={styles.percentBadge}>
                <Text style={styles.percentText}>%{pctText}</Text>
             </View>
          </View>

          <View style={styles.glassWrapper}>
             <WaterGlass totalMl={totalMl} goalMl={safeGoal} />
             
             <View style={styles.absoluteCenter}>
                <Text style={styles.bigTotal}>{totalMl}</Text>
                <Text style={styles.mlLabel}>ml</Text>
             </View>
          </View>

          <View style={styles.streakContainer}>
             <View style={[styles.streakBadge, streakDays > 0 ? styles.streakActive : styles.streakInactive]}>
                <Ionicons 
                  name="flame" 
                  size={18} 
                  color={streakDays > 0 ? "#FF5722" : "#BDBDBD"} 
                />
                <Text style={[styles.streakText, { color: streakDays > 0 ? "#E64A19" : "#9E9E9E" }]}>
                  {streakDays > 0
                    ? t('home.streakDone', { days: streakDays })
                    : t('home.streakHint')}
                </Text>
             </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.quickAdd')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickAddScroll}>
            <QuickAddButton ml={200} icon={subardagi} label={t('quickAdd.cup')} onPress={() => quickAdd(200)} color="#4FC3F7" />
            <QuickAddButton ml={300} icon={fincan} label={t('quickAdd.espresso')} onPress={() => quickAdd(300)} color="#FFB74D" />
            <QuickAddButton ml={500} icon={susisesi} label={t('quickAdd.bottle')} onPress={() => quickAdd(500)} color="#9575CD" />
            
            <TouchableOpacity style={styles.customAddBtn} onPress={() => setModalVisible(true)}>
              <View style={styles.plusCircle}>
                <Ionicons name="add" size={28} color="#fff" />
              </View>
              <Text style={styles.customAddText}>{t('home.custom')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
         
         {/* --- İPUCU KARTI --- */}
        <View style={styles.tipCard}>
           <View style={styles.tipHeader}>
              <Ionicons name="bulb" size={20} color="#FBC02D" />
              <Text style={styles.tipTitle}>{t('home.tipOfDay')}</Text>
           </View>
           <Text style={styles.tipText}>{dailyTip}</Text>
        </View>

        <View style={styles.gridContainer}>
            <MenuCard title={t('menu.history')} icon="calendar-outline" color="#4DB6AC" onPress={() => navigation.navigate("Geçmiş")} />
            <MenuCard title={t('menu.reminders')} icon="alarm-outline" color="#E57373" onPress={() => navigation.navigate("Hatırlatıcılar")} />
            <MenuCard title={t('menu.badges')} icon="ribbon-outline" color="#F06292" onPress={() => navigation.navigate("Rozetler")} />
            <MenuCard title={t('menu.profile')} icon="person-outline" color="#7986CB" onPress={() => navigation.navigate("Profil")} />
        </View>

        {/* --- Geliştirici Paneli (En Altta Gizli Gibi) --- */}
        <View style={styles.devPanel}>
           <Text style={styles.devTitle}>{t('dev.title')}</Text>
           <View style={styles.devRow}>
           <TouchableOpacity onPress={() => { resetToday(); syncTodayWaterToWidget(0); }}><Text style={styles.devLink}>{t('dev.reset')}</Text></TouchableOpacity>
             <Text style={{color:'#ccc', marginHorizontal: 8}}>|</Text>
           <TouchableOpacity onPress={() => { resetAll(); syncTodayWaterToWidget(0); }}><Text style={[styles.devLink, {color:'#E57373'}]}>{t('dev.delete')}</Text></TouchableOpacity>
           </View>
        </View>

      </Animated.ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <TouchableOpacity style={{flex:1}} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>{t('modal.enterAmount')}</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder={t('modal.placeholderAmount')}
                keyboardType="numeric"
                autoFocus
                value={customAmount}
                onChangeText={setCustomAmount}
                maxLength={4}
              />
              <Text style={styles.unitText}>ml</Text>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCustomAdd}>
              <Text style={styles.saveBtnText}>{t('modal.add')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ... Yardımcı Bileşenler
const QuickAddButton = ({ ml, icon, label, onPress, color }) => (
  <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.quickItem}>
    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}> 
       <Image source={icon} style={{ width: 24, height: 24, resizeMode:'contain' }} />
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
    <Text style={styles.quickMl}>{ml} ml</Text>
  </TouchableOpacity>
);

const MenuCard = ({ title, icon, color, onPress }) => (
  <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.menuCard}>
    <View style={[styles.menuIconBox, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.menuTitle}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  animatedBg: { ...StyleSheet.absoluteFillObject },
  bubble: { position: 'absolute', borderRadius: 999 },
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  stickyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: S.xl, marginBottom: 20 },
  greeting: { fontSize: 32, fontWeight: '800', color: '#1A237E', letterSpacing: -1 },
  subGreeting: { fontSize: 15, color: '#5C6BC0', marginTop: 4, fontWeight: '500' },
  profileBtn: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: '#fff' },
  mainCard: { marginHorizontal: S.xl, borderRadius: 32, padding: 24, alignItems: 'center', backgroundColor: '#fff', shadowColor: "#5C6BC0", shadowOpacity: 0.15, shadowRadius: 30, elevation: 15, position: 'relative', overflow: 'hidden' },
  glassBackground: { position: 'absolute', top:0, left:0, right:0, bottom:0, backgroundColor: 'rgba(255,255,255,0.6)' },
  counterRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  goalLabel: { fontSize: 12, color: '#9FA8DA', fontWeight: '700', textTransform: 'uppercase' },
  goalValue: { fontSize: 20, color: '#3949AB', fontWeight: '800' },
  percentBadge: { backgroundColor: '#E8EAF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  percentText: { fontWeight: '800', color: '#3949AB' },
  glassWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  absoluteCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center', top: 0, left: 0, right: 0, bottom: 0 },
  bigTotal: { fontSize: 48, fontWeight: '900', color: '#1A237E', textShadowColor:'rgba(0,0,0,0.05)', textShadowOffset:{width:0, height:4}, textShadowRadius:4 },
  mlLabel: { fontSize: 16, fontWeight: '600', color: '#7986CB', marginTop: -5 },
  streakContainer: { marginTop: 15, width: '100%', alignItems: 'center' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  streakActive: { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' },
  streakInactive: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  streakText: { fontWeight: '700', marginLeft: 6, fontSize: 13 },
  section: { marginTop: 30 },
  sectionTitle: { paddingHorizontal: S.xl, fontSize: 18, fontWeight: '800', color: '#263238', marginBottom: 15 },
  quickAddScroll: { paddingHorizontal: S.xl, paddingBottom: 20 },
  quickItem: { backgroundColor: '#fff', width: 100, height: 120, borderRadius: 24, marginRight: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 14, fontWeight: '700', color: '#455A64' },
  quickMl: { fontSize: 11, fontWeight: '600', color: '#90A4AE', marginTop: 2 },
  customAddBtn: { width: 80, height: 120, alignItems: 'center', justifyContent: 'center', marginRight: S.xl },
  plusCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECEFF1', alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#CFD8DC', borderStyle: 'dashed' },
  customAddText: { fontSize: 12, fontWeight: '700', color: '#78909C' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: S.xl, marginTop: 10, justifyContent: 'space-between' },
  menuCard: { width: '48%', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  menuIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  
  /* YENİ İPUCU KARTI STİLLERİ */
  tipCard: { marginHorizontal: S.xl, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipTitle: { fontSize: 16, fontWeight: '800', color: '#FBC02D', marginLeft: 8 },
  tipText: { fontSize: 14, color: '#546E7A', lineHeight: 22, fontWeight: '500' },

  devPanel: { marginTop: 10, alignItems: 'center', opacity: 0.6 },
  devTitle: { fontSize: 10, textTransform: 'uppercase', color: '#B0BEC5', fontWeight: '700' },
  devRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  devLink: { fontSize: 12, color: '#78909C', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  modalIndicator: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#263238', marginBottom: 20 },
  inputWrapper: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 2, borderBottomColor: '#29B6F6', marginBottom: 30 },
  input: { fontSize: 40, fontWeight: '700', color: '#29B6F6', padding: 10, minWidth: 100, textAlign: 'center' },
  unitText: { fontSize: 18, color: '#90A4AE', fontWeight: '600' },
  saveBtn: { backgroundColor: '#29B6F6', width: '100%', padding: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#29B6F6', shadowOpacity: 0.3, shadowRadius: 10 },
  saveBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Platform, 
  Animated, 
  Easing,
  Dimensions,
  LayoutAnimation,
  UIManager,
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useHydrationStore } from '../storage/useHydrationStore';

// Android Animasyon Desteği
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// Görseller (Yolları kontrol et)
const IMG_MALE = require('../../assets/illustrations/male.png');
const IMG_FEMALE = require('../../assets/illustrations/female.png');
const WAVE_JSON = require('../../assets/lottie/wave.json');
const IMG_WAKE = require('../../assets/illustrations/wakeup.png');
const IMG_NAP_MALE = require('../../assets/illustrations/nap-male.png');
const IMG_NAP_FEMALE = require('../../assets/illustrations/nap-female.png');
const IMG_MALE_LENGTH = require('../../assets/illustrations/male-length.png');
const IMG_FEMALE_LENGTH = require('../../assets/illustrations/female-length.png');

const STEPS = ['gender', 'weight','height', 'wake', 'sleep', 'loading'];

export default function OnboardWizard({ onDone }) {
  const insets = useSafeAreaInsets();
  
  // --- STATE ---
  const [stepIndex, setStepIndex] = useState(0);
  const [gender, setGender] = useState('male');
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [wakeAt, setWakeAt] = useState(new Date(2000, 0, 1, 8, 0, 0));
  const [sleepAt, setSleepAt] = useState(new Date(2000, 0, 1, 23, 0, 0));
  const [unit, setUnit] = useState('kg'); 

  const [showWake, setShowWake] = useState(Platform.OS === 'ios');
  const [showSleep, setShowSleep] = useState(Platform.OS === 'ios');

  // Animasyonlar
  const [loadingIdx, setLoadingIdx] = useState(0);
  const bgAnim = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const spinVal = useRef(new Animated.Value(0)).current;

  const loadingPhrases = useMemo(() => ['Vücut kitle indeksin analiz ediliyor...', 'Günlük su ihtiyacın hesaplanıyor...', 'Sana özel plan hazırlanıyor...'], []);

  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  // Arkaplan Nefes Alma
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();
  }, []);

  // Progress Bar Animasyonu
  useEffect(() => {
    const target = Math.min(stepIndex / (STEPS.length - 2), 1); // Loading hariç
    Animated.timing(progress, { toValue: target, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [stepIndex]);

  // Loading Loop
  useEffect(() => {
    if (step !== 'loading') return;
    
    const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
    );
    
    const spinLoop = Animated.loop(
        Animated.timing(spinVal, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    );

    pulseLoop.start();
    spinLoop.start();

    const timer = setInterval(() => setLoadingIdx(i => (i+1)%3), 1500);
    
    return () => { 
        clearInterval(timer);
        pulseLoop.stop();
        spinLoop.stop();
    };
  }, [step]);

  const animateTransition = (callback) => {
    // Sayfa geçiş efekti
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    callback();
  };

  const next = () => {
    if (isLast) return;
    const nextStep = stepIndex + 1;

    animateTransition(() => {
      setStepIndex(nextStep);
    });

    // HESAPLAMA VE KAYIT
    if (STEPS[nextStep] === 'loading') {
      setTimeout(async () => {
        try {
          const weightKg = unit === 'kg' ? weight : Math.round(weight / 2.20462);
          
          // Basit bir hesaplama formülü (Daha detaylısı Store içinde calculateGoal ile yapılıyor)
          let dailyGoalMl = weightKg * 35; 
          if (height > 170) dailyGoalMl += (height - 170) * 10;
          if (height < 160) dailyGoalMl -= (160 - height) * 10;
          dailyGoalMl = Math.max(1200, Math.min(5000, Math.round(dailyGoalMl)));

          const profileData = {
            gender, 
            unit, 
            weight: weightKg, // Store ile uyumlu isim (weight)
            weightKg: weightKg, // Geriye dönük uyumluluk
            height: height,   // Store ile uyumlu isim (height)
            heightCm: height, // Geriye dönük uyumluluk
            wakeAt: `${String(wakeAt.getHours()).padStart(2,'0')}:${String(wakeAt.getMinutes()).padStart(2,'0')}`,
            sleepAt: `${String(sleepAt.getHours()).padStart(2,'0')}:${String(sleepAt.getMinutes()).padStart(2,'0')}`,
          };

          // 1. AsyncStorage'a yedekle
          await AsyncStorage.multiSet([
            ['ONBOARD_PROFILE', JSON.stringify(profileData)],
            ['DAILY_GOAL_ML', String(dailyGoalMl)],
            ['HAS_ONBOARDED', '1'],
          ]);

          // 2. STORE'U GÜNCELLE (Store'un hazır fonksiyonlarını kullanıyoruz)
          const store = useHydrationStore.getState();
          
          // Profili güncelle
          await store.updateProfile({
             weight: weightKg, 
             height: height, 
             wakeAt: profileData.wakeAt, 
             sleepAt: profileData.sleepAt,
             gender: gender
          });

          // Hedefi güncelle (Hesaplanan hedefi zorla)
          await store.setGoalMl(dailyGoalMl);

          console.log('Onboard completed. Goal:', dailyGoalMl);
        } catch (e) {
          console.warn('Save failed', e);
        } finally {
          onDone?.();
        }
      }, 3000);
    }
  };

  const prev = () => { 
    if (!isFirst) animateTransition(() => setStepIndex(stepIndex - 1)); 
  };

  // Başlıklar
  const getTitle = () => {
    switch (step) {
      case 'gender': return 'Cinsiyetini Seç';
      case 'weight': return 'Kilon Kaç?';
      case 'height': return 'Boyun Kaç?';
      case 'wake':   return 'Kaçta Uyanırsın?';
      case 'sleep':  return 'Kaçta Uyursun?';
      default: return '';
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'gender': return 'Sana en uygun su ihtiyacını hesaplayabilmemiz için gerekli.';
      case 'weight': return 'Kilo, su ihtiyacını belirleyen en önemli faktördür.';
      case 'height': return 'Boy uzunluğu metabolizma hızını etkiler.';
      case 'wake':   return 'Güne ne zaman başladığını bilmeliyiz.';
      case 'sleep':  return 'Seni uykunda rahatsız etmemek için önemli.';
      default: return '';
    }
  };

  // Dinamik Arkaplan Rengi
  const bgTopColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['#E3F2FD', '#F3E5F5'] });

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      {/* CANLI ARKAPLAN */}
      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.9)']} style={StyleSheet.absoluteFill} />
        {/* Dekoratif Baloncuklar */}
        <View style={[styles.bubble, { top: 100, left: -30, width: 200, height: 200, backgroundColor: '#B3E5FC', opacity: 0.2 }]} />
        <View style={[styles.bubble, { bottom: 100, right: -50, width: 250, height: 250, backgroundColor: '#E1BEE7', opacity: 0.15 }]} />
      </Animated.View>

      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]} edges={['top']}>
        
        {/* --- HEADER & PROGRESS --- */}
        {step !== 'loading' && (
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <Animated.View style={[styles.progressBar, { 
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ['5%', '100%'] }) 
              }]} />
            </View>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>
        )}

        {/* --- İÇERİK ALANI (GLASSMORPHISM KART) --- */}
        <View style={styles.contentContainer}>
          {step !== 'loading' && (
            <View style={styles.glassCard}>
              
              {/* CİNSİYET */}
              {step === 'gender' && (
                <View style={styles.genderRow}>
                  <Avatar label="Erkek" active={gender==='male'} img={IMG_MALE} onPress={()=>setGender('male')} color="#42A5F5" />
                  <Avatar label="Kadın" active={gender==='female'} img={IMG_FEMALE} onPress={()=>setGender('female')} color="#EC407A" />
                </View>
              )}

              {/* KİLO */}
              {step === 'weight' && (
                <View style={styles.centerContent}>
                  <Image source={gender==='male'?IMG_MALE:IMG_FEMALE} style={styles.illustration} />
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerGlass}>
                      <Picker selectedValue={weight} onValueChange={setWeight} style={styles.picker} itemStyle={styles.pickerItem}>
                        {Array.from({length:150}, (_,i) => 30+i).map(v=><Picker.Item key={v} label={`${v}`} value={v} />)}
                      </Picker>
                    </View>
                    <Text style={styles.unitText}>kg</Text>
                  </View>
                </View>
              )}

              {/* BOY */}
              {step === 'height' && (
                <View style={styles.centerContent}>
                  <Image source={gender==='male'?IMG_MALE_LENGTH:IMG_FEMALE_LENGTH} style={styles.illustration} />
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerGlass}>
                      <Picker selectedValue={height} onValueChange={setHeight} style={styles.picker} itemStyle={styles.pickerItem}>
                        {Array.from({length:100}, (_,i) => 120+i).map(v=><Picker.Item key={v} label={`${v}`} value={v}/>)}
                      </Picker>
                    </View>
                    <Text style={styles.unitText}>cm</Text>
                  </View>
                </View>
              )}

              {/* UYANMA & UYKU (Time) */}
              {(step === 'wake' || step === 'sleep') && (
                <View style={styles.centerContent}>
                  <Image source={step==='wake'?IMG_WAKE:(gender==='male'?IMG_NAP_MALE:IMG_NAP_FEMALE)} style={styles.illustration} />
                  
                  <View style={styles.timeCard}>
                    {Platform.OS === 'ios' ? (
                      <DateTimePicker 
                        value={step==='wake'?wakeAt:sleepAt} 
                        mode="time" 
                        display="spinner" 
                        onChange={(e,d)=>d && (step==='wake'?setWakeAt(d):setSleepAt(d))} 
                        style={styles.iosPicker}
                        textColor="#1A237E"
                      />
                    ) : (
                      <TouchableOpacity onPress={()=>(step==='wake'?setShowWake(true):setShowSleep(true))} style={styles.androidTimeBtn}>
                         <Text style={styles.androidTimeTxt}>
                           {step==='wake' 
                             ? `${String(wakeAt.getHours()).padStart(2,'0')}:${String(wakeAt.getMinutes()).padStart(2,'0')}` 
                             : `${String(sleepAt.getHours()).padStart(2,'0')}:${String(sleepAt.getMinutes()).padStart(2,'0')}`}
                         </Text>
                         <Ionicons name="time-outline" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {(step==='wake'?showWake:showSleep) && Platform.OS==='android' && (
                     <DateTimePicker 
                        value={step==='wake'?wakeAt:sleepAt} 
                        mode="time" 
                        is24Hour 
                        onChange={(e,d)=>{ (step==='wake'?setShowWake(false):setShowSleep(false)); if(d) (step==='wake'?setWakeAt(d):setSleepAt(d)); }} 
                     />
                  )}
                </View>
              )}

            </View>
          )}

          {/* LOADING SCREEN */}
          {step === 'loading' && (
            <View style={styles.loadingContainer}>
              <LottieView source={WAVE_JSON} autoPlay loop style={styles.lottieBg} resizeMode="cover" />
              <View style={styles.loadingGlassCard}>
                <Animated.View style={[styles.loadingIconCircle, {transform:[{scale: pulse}]}]}>
                   <Animated.View style={{transform:[{rotate: spinVal.interpolate({inputRange:[0,1], outputRange:['0deg','360deg']})}]}}>
                        <Ionicons name="water" size={40} color="#29B6F6" />
                   </Animated.View>
                </Animated.View>
                <Text style={styles.loadingText}>{loadingPhrases[loadingIdx]}</Text>
                <View style={styles.loadingDots}>
                   <View style={[styles.dot, {backgroundColor: '#29B6F6'}]} />
                   <View style={[styles.dot, {backgroundColor: '#81D4FA'}]} />
                   <View style={[styles.dot, {backgroundColor: '#B3E5FC'}]} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* --- ALT BUTONLAR --- */}
        {step !== 'loading' && (
          <View style={[styles.bottomNav, {paddingBottom: insets.bottom + 20}]}>
            <TouchableOpacity onPress={prev} disabled={isFirst} style={[styles.backBtn, isFirst && {opacity:0}]}>
              <Ionicons name="arrow-back" size={24} color="#546E7A" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={next} style={styles.nextBtn}>
              <LinearGradient
                colors={['#29B6F6', '#0288D1']}
                style={styles.nextBtnGradient}
                start={{x:0, y:0}} end={{x:1, y:0}}
              >
                <Text style={styles.nextBtnText}>{isLast ? 'TAMAMLA' : 'DEVAM ET'}</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

// Avatar Bileşeni
const Avatar = ({label, active, img, onPress, color}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.avatarCard, active && {borderColor: color, transform:[{scale:1.05}]}]}>
    <View style={[styles.avatarCircle, active && {backgroundColor: color+'20'}]}>
       <Image source={img} style={styles.avatarImg} />
    </View>
    <Text style={[styles.avatarLabel, active && {color: color, fontWeight:'800'}]}>{label}</Text>
    {active && <View style={[styles.checkBadge, {backgroundColor: color}]}><Ionicons name="checkmark" size={16} color="#fff"/></View>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  animatedBg: { ...StyleSheet.absoluteFillObject },
  bubble: { position: 'absolute', borderRadius: 999 },
  safe: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 24, marginTop: 20, marginBottom: 10 },
  progressContainer: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  progressBar: { height: '100%', backgroundColor: '#29B6F6', borderRadius: 3 },
  title: { fontSize: 32, fontWeight: '800', color: '#1A237E', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#546E7A', lineHeight: 22 },

  /* Content Area */
  contentContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: '#fff',
    shadowColor: '#29B6F6',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    minHeight: 400,
    justifyContent: 'center'
  },

  /* Gender */
  genderRow: { flexDirection: 'row', justifyContent: 'space-around' },
  avatarCard: { alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.5)' },
  avatarCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  avatarImg: { width: 100, height: 100, resizeMode: 'contain' },
  avatarLabel: { fontSize: 18, fontWeight: '600', color: '#78909C' },
  checkBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  /* Weight / Height */
  centerContent: { alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 200, height: 200, resizeMode: 'contain', marginBottom: 20 },
  pickerWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pickerGlass: { height: 180, width: 120, overflow: 'hidden', borderRadius: 20, backgroundColor: '#F0F4F8', borderWidth: 1, borderColor: '#E1F5FE' },
  picker: { width: 120, height: 180 },
  pickerItem: { fontSize: 32, fontWeight: 'bold', color: '#1A237E' },
  unitText: { fontSize: 24, fontWeight: '700', color: '#90A4AE', marginLeft: 15 },

  /* Time */
  timeCard: { backgroundColor: '#E3F2FD', padding: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', minWidth: 200 },
  iosPicker: { width: 200 },
  androidTimeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#29B6F6', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, elevation: 5 },
  androidTimeTxt: { fontSize: 36, fontWeight: '800', color: '#fff', marginRight: 10 },

  /* Loading */
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lottieBg: { position: 'absolute', width: width, height: height, top:0 },
  loadingGlassCard: { width: width*0.8, padding: 30, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  loadingIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E1F5FE', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  loadingText: { fontSize: 20, fontWeight: '800', color: '#0277BD', textAlign: 'center', marginBottom: 15 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  /* Bottom Nav */
  bottomNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24 },
  backBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#ECEFF1', alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, marginLeft: 20, shadowColor: '#0288D1', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  nextBtnGradient: { height: 60, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', marginRight: 10, letterSpacing: 1 },
});
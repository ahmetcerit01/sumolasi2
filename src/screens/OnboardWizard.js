// src/screens/OnboardWizard.js
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// TODO: Kendi görsellerini bu isimlerle assets içine koy
// assets/illustrations/male.png
// assets/illustrations/female.png
// assets/lottie/wave.json
const IMG_MALE = require('../../assets/illustrations/male.png');
const IMG_FEMALE = require('../../assets/illustrations/female.png');
const WAVE_JSON = require('../../assets/lottie/wave.json');
const IMG_NAP_MALE = require('../../assets/illustrations/nap-male.png');
const IMG_NAP_FEMALE = require('../../assets/illustrations/nap-female.png');
const IMG_WAKE = require('../../assets/illustrations/wakeup.png');
const IMG_MALE_LENGTH = require('../../assets/illustrations/male-length.png');
const IMG_FEMALE_LENGTH = require('../../assets/illustrations/female-length.png');

const STEPS = ['gender', 'weight','height', 'wake', 'sleep', 'loading'];

export default function OnboardWizard({ onDone }) {
  const [stepIndex, setStepIndex] = useState(0);

  const [gender, setGender] = useState('male'); // male | female
  const [weight, setWeight] = useState(70);     // kg
  const [height, setHeight] = useState(170); // cm
  const [wakeAt, setWakeAt] = useState(new Date(2000, 0, 1, 6, 0, 0));
  const [sleepAt, setSleepAt] = useState(new Date(2000, 0, 1, 22, 0, 0));
  const [unit, setUnit] = useState('kg'); // 'kg' | 'lbs'

  // iOS'ta DateTimePicker inline görünür; Android'de modal açılır
  const [showWake, setShowWake] = useState(Platform.OS === 'ios');
  const [showSleep, setShowSleep] = useState(Platform.OS === 'ios');

  // Loading animation state/refs
  const [loadingIdx, setLoadingIdx] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const spinVal = useRef(new Animated.Value(0)).current;
  const loadingPhrases = useMemo(
    () => [
      'Size özel program hazırlanıyor',
      'Günlük hedef hesaplanıyor',
      'Hatırlatmalar optimize ediliyor'
    ],
    []
  );

  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === STEPS.length - 1;

  // Top water progress (0..1)
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const denom = STEPS.length - 1; // last is loading
    const target = Math.min(stepIndex / denom, 1);
    Animated.timing(progress, { toValue: target, duration: 400, useNativeDriver: false }).start();
  }, [stepIndex]);

  // Loading step animation effect
  useEffect(() => {
    if (step !== 'loading') return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 650, useNativeDriver: true }),
      ])
    );

    const spinLoop = Animated.loop(
      Animated.timing(spinVal, { toValue: 1, duration: 1600, useNativeDriver: true })
    );

    pulseLoop.start();
    spinLoop.start();

    const ticker = setInterval(() => {
      setLoadingIdx((i) => (i + 1) % loadingPhrases.length);
    }, 900);

    return () => {
      pulseLoop.stop();
      spinVal.stopAnimation();
      clearInterval(ticker);
      spinVal.setValue(0);
      pulse.setValue(1);
    };
  }, [step]);

  const next = () => {
    if (isLast) return;
    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);

    // Yükleme adımına geçince hesapla+kaydet
    if (STEPS[nextStep] === 'loading') {
      setTimeout(async () => {
        try {
              const weightKgInternal = unit === 'kg' ? weight : Math.round(weight / 2.20462);

      // Boy ve kiloya göre günlük su hedefi hesaplama
      const baseGoal = weightKgInternal * 35; // temel kilo bazlı formül

      let heightAdj = 0;
      if (height > 170) {
        // 170 cm üzeri her cm için +10 ml
        heightAdj = (height - 170) * 10;
      } else if (height < 160) {
        // 160 cm altı her cm için -10 ml
        heightAdj = (height - 160) * 10;
      }

      let dailyGoalMl = Math.round(baseGoal + heightAdj);

      // Aşırı uçları sınırlayalım (çok uç değerleri engelle)
      if (dailyGoalMl < 1200) dailyGoalMl = 1200;
      if (dailyGoalMl > 5000) dailyGoalMl = 5000;

      const profile = {
        gender,
        unit,
        weightKg: weightKgInternal,
        heightCm: height,
        wakeAt: toHM(wakeAt),
        sleepAt: toHM(sleepAt),
      };

      await AsyncStorage.multiSet([
        ['ONBOARD_PROFILE', JSON.stringify(profile)],
        ['DAILY_GOAL_ML', String(dailyGoalMl)],
        ['HAS_ONBOARDED', '1'],
      ]);
          console.log('[Onboard] profile saved', profile, dailyGoalMl);
        } catch (e) {
          console.warn('[Onboard] save failed', e);
        } finally {
          onDone?.();
        }
      }, 2400);
    }
  };

  const prev = () => {
    if (isFirst) return;
    setStepIndex(stepIndex - 1);
  };

  const step = STEPS[stepIndex];
  const title = useMemo(() => {
    switch (step) {
      case 'gender': return 'Cinsiyetiniz';
      case 'weight': return 'Ağırlığınız';
      case 'height': return 'Boyunuz';
      case 'wake':   return 'Uyanma zamanı';
      case 'sleep':  return 'Uyku zamanı';
      case 'loading':return 'Su tüketim planınız oluşturuluyor...';
      default: return '';
    }
  }, [step]);

  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#FFFFFF', '#F8FAFF']} style={{ flex: 1 }}>
      <SafeAreaView style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {step !== 'loading' && (
        <>
          {/* Üst su dolan progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress }] }]} />
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
        </>
      )}

      <View style={styles.content}>

        {step === 'gender' && (
          <View style={styles.genderRow}>
            <SelectAvatar
              label="Erkek"
              active={gender === 'male'}
              image={IMG_MALE}
              onPress={() => setGender('male')}
            />
            <SelectAvatar
              label="Kadın"
              active={gender === 'female'}
              image={IMG_FEMALE}
              onPress={() => setGender('female')}
            />
          </View>
        )}

        {step === 'weight' && (
          <View style={styles.weightWrap}>
            <Image source={gender === 'male' ? IMG_MALE : IMG_FEMALE} style={styles.scaleImg} />
            <View style={styles.wheelBox}>
              <Picker
                selectedValue={weight}
                onValueChange={(v) => setWeight(v)}
                style={styles.wheel}
                itemStyle={{ fontSize: 34, fontWeight: '800' }}
              >
                {(unit === 'kg'
                  ? Array.from({ length: 141 }, (_, i) => 30 + i) // 30..170 kg
                  : Array.from({ length: 310 }, (_, i) => 66 + i) // 66..375 lbs (~30..170kg)
                ).map((v) => (
                  <Picker.Item label={`${v}`} value={v} key={`${unit}-${v}`} />
                ))}
              </Picker>
            </View>

            {/* Unit toggle pills */}
            <View style={styles.unitToggle}>
              <TouchableOpacity
                onPress={() => {
                  if (unit !== 'kg') {
                    // convert lbs -> kg then to nearest kg value
                    const kg = Math.round(weight / 2.20462);
                    setWeight(kg);
                    setUnit('kg');
                  }
                }}
                style={[styles.pill, unit === 'kg' && styles.pillActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.pillText, unit === 'kg' && styles.pillTextActive]}>kg</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (unit !== 'lbs') {
                    const lbs = Math.round(weight * 2.20462);
                    setWeight(lbs);
                    setUnit('lbs');
                  }
                }}
                style={[styles.pill, unit === 'lbs' && styles.pillActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.pillText, unit === 'lbs' && styles.pillTextActive]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

                {step === 'height' && (
          <View style={styles.weightWrap}>
            <Image
              source={gender === 'male' ? IMG_MALE_LENGTH : IMG_FEMALE_LENGTH}
              style={styles.scaleImg}
            />
            <View style={styles.wheelBox}>
              <Picker
                selectedValue={height}
                onValueChange={(v) => setHeight(v)}
                style={styles.wheel}
                itemStyle={{ fontSize: 34, fontWeight: '800' }}
              >
                {Array.from({ length: 81 }, (_, i) => 140 + i) // 140..220 cm
                  .map((v) => (
                    <Picker.Item label={`${v}`} value={v} key={`cm-${v}`} />
                  ))}
              </Picker>
            </View>
            <Text style={styles.unitBelow}>cm</Text>
          </View>
        )}

        {step === 'wake' && (
          <View style={styles.timeWrap}>
            {/* <Image source={gender === 'male' ? IMG_MALE : IMG_FEMALE} style={styles.sleepImg} /> */}
                        <Image source={IMG_WAKE} style={styles.sleepImg} />
            {Platform.OS === 'android' ? (
              <>
                <TouchableOpacity style={styles.timeCircle} onPress={() => setShowWake(true)}>
                  <Text style={styles.timeCircleTxt}>{toHM(wakeAt)}</Text>
                </TouchableOpacity>
                {showWake && (
                  <DateTimePicker
                    value={wakeAt}
                    mode="time"
                    is24Hour
                    display="spinner"
                    onChange={(e, date) => {
                      setShowWake(false);
                      if (date) setWakeAt(date);
                    }}
                  />
                )}
              </>
            ) : (
              <DateTimePicker
                value={wakeAt}
                mode="time"
                is24Hour
                display="spinner"
                style={styles.timeSpinner}
                onChange={(e, d) => d && setWakeAt(d)}
              />
            )}
          </View>
        )}

        {step === 'sleep' && (
          <View style={styles.timeWrap}>
            <Image source={gender === 'male' ? IMG_NAP_MALE : IMG_NAP_FEMALE} style={styles.sleepImg} />
            {Platform.OS === 'android' ? (
              <>
                <TouchableOpacity style={styles.timeCircle} onPress={() => setShowSleep(true)}>
                  <Text style={styles.timeCircleTxt}>{toHM(sleepAt)}</Text>
                </TouchableOpacity>
                {showSleep && (
                  <DateTimePicker
                    value={sleepAt}
                    mode="time"
                    is24Hour
                    display="spinner"
                    onChange={(e, date) => {
                      setShowSleep(false);
                      if (date) setSleepAt(date);
                    }}
                  />
                )}
              </>
            ) : (
              <DateTimePicker
                value={sleepAt}
                mode="time"
                is24Hour
                display="spinner"
                style={styles.timeSpinner}
                onChange={(e, d) => d && setSleepAt(d)}
              />
            )}
          </View>
        )}

        {step === 'loading' && (
          <View style={styles.loadingWrap}>
            <LottieView
              source={WAVE_JSON}
              autoPlay
              loop
              style={styles.loadingWave}
              resizeMode="cover"
            />
            <View style={styles.loadingOverlay} />

            <Animated.View style={[styles.loadingCard, { transform: [{ scale: pulse }] }]}> 
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                    },
                  ],
                }}
              >
                <Ionicons name="water" size={28} color="#3B82F6" />
              </Animated.View>
              <Text style={styles.loadingTitle}>{loadingPhrases[loadingIdx]}</Text>
              <Text style={styles.loadingSub}>Birazdan hazırsın.</Text>
            </Animated.View>
          </View>
        )}
      </View>

      {/* Alt navigasyon */}
      {step !== 'loading' && (
        <View style={styles.bottomNav}>
          <RoundButton icon="chevron-back" onPress={prev} disabled={isFirst} />
          <CTA label="SONRAKİ" onPress={next} />
        </View>
      )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ------- Helpers & Small Components ------- */

function toHM(date) {
  const h = `${date.getHours()}`.padStart(2, '0');
  const m = `${date.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
}

function SelectAvatar({ label, active, image, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      style={[styles.avatarBox]}
    >
      <View style={[styles.avatarCircle, active && styles.avatarCircleActive]}>
        <Image source={image} style={styles.avatarImg} />
      </View>
      <Text style={[styles.avatarLabel, active && styles.avatarLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RoundButton({ icon, onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.roundBtn, disabled && { opacity: 0.4 }]}>
      <Ionicons name={icon} size={22} color="#fff" />
    </TouchableOpacity>
  );
}

function CTA({ label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.ctaBtn}>
      <Text style={styles.ctaTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ----------------- Styles ----------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 16, marginBottom: 10, textAlign: 'center', alignSelf: 'center', width: '100%' },

  /* Water progress bar */
  progressWrap: { paddingHorizontal: 16, paddingTop: 10 },
  progressTrack: { height: 16, width: '100%', backgroundColor: '#E5EEF9', borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: '100%', width: '100%', backgroundColor: '#6AA9FF', transform: [{ scaleX: 0 }], transformOrigin: 'left', borderRadius: 10 },

  /* Gender */
  genderRow: { marginTop: 28, flexDirection: 'row', justifyContent: 'space-around', width: '90%' },
  avatarBox: { alignItems: 'center' },
  avatarCircle: { width: 184, height: 184, borderRadius: 92, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarCircleActive: { backgroundColor: '#DDEBFF', borderColor: '#F7B500' },
  avatarImg: { width: 180, height: 180, borderRadius: 80, resizeMode: 'contain' },
  avatarLabel: { marginTop: 12, fontWeight: '700', color: '#94A3B8', fontSize: 17 },
  avatarLabelActive: { color: '#3B82F6' },

  /* Weight */
  weightWrap: { alignItems: 'center', marginTop: 24 },
  scaleImg: { width: 340, height: 380, resizeMode: 'contain', marginBottom: 16 },
  wheelBox: { width: 280, height: 220, backgroundColor: '#F2F4F7', borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  wheel: { width: 280, height: 220 },
  unitBelow: { marginTop: 8, fontSize: 16, color: '#6B7280', fontWeight: '700' },

  /* Unit toggle pills */
  unitToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  pill: { paddingVertical: 8, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' },
  pillActive: { backgroundColor: '#3B82F6', borderColor: '#F7B500' },
  pillText: { fontWeight: '700', color: '#6B7280' },
  pillTextActive: { color: '#ffffff' },

  /* Time */
  timeWrap: { alignItems: 'center', marginTop: 24 },
  sleepImg: { width: 380, height: 380, resizeMode: 'contain', marginBottom: 28 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 22, borderRadius: 20, backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#93C5FD', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 5 },
  timeBtnTxt: { fontWeight: '800', fontSize: 28, marginLeft: 12, color: '#1E3A8A' },
  timeCircle: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1D5DB', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6 },
  timeCircleTxt: { fontWeight: '800', fontSize: 52, color: '#111827' },
  timeSpinner: { width: 340, height: 240 },

  /* Loading */
  bubble: { position: 'absolute', zIndex: 1, alignSelf: 'center', top: '28%', width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8 },
  loadingWave: { position: 'absolute', zIndex: 0, top: 0, left: 0, right: 0, bottom: 0 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.35)' },
  loadingCard: { position: 'absolute', alignSelf: 'center', bottom: '22%', width: '82%', paddingVertical: 22, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  loadingTitle: { marginTop: 6, fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  loadingSub: { marginTop: 2, fontSize: 14, fontWeight: '600', color: '#64748B' },

  /* Bottom nav */
  bottomNav: { position: 'absolute', left: 16, right: 16, bottom: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6AA9FF', alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { minWidth: 136, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 22, backgroundColor: '#6AA9FF', alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '800', letterSpacing: 0.3, fontSize: 16 },
});
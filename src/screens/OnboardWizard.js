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
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useHydrationStore } from '../storage/useHydrationStore';
import { scheduleReminders, DEFAULT_INTERVAL_HOURS } from '../utils/reminders';
import { useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';
import Mascot from '../components/Mascot';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

// Görseller
const IMG_MALE = require('../../assets/illustrations/male.png');
const IMG_FEMALE = require('../../assets/illustrations/female.png');
const IMG_WAKE = require('../../assets/illustrations/wakeup.png');
const IMG_NAP_MALE = require('../../assets/illustrations/nap-male.png');
const IMG_NAP_FEMALE = require('../../assets/illustrations/nap-female.png');
const IMG_MALE_LENGTH = require('../../assets/illustrations/male-length.png');
const IMG_FEMALE_LENGTH = require('../../assets/illustrations/female-length.png');

const STEPS = ['gender', 'weight','height', 'wake', 'sleep', 'loading', 'result'];
// Alttaki geri/devam butonları (60pt) + boşluk; içerik bunların altına girmesin
const BOTTOM_NAV_SPACE = 100;

const toHHMM = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

export default function OnboardWizard({ onDone, onShowPaywall, t: tProp, locale: localeProp, setLanguage: setLanguageProp }) {
  const insets = useSafeAreaInsets();
  const { c, type, dark } = useTheme();
  const styles = useMemo(() => makeStyles(c, type), [c]);
  // NOTE: App.js ile döngü (require cycle) olmaması için artık LanguageContext'i buradan import etmiyoruz.
  // App.js bu ekrana t / locale / setLanguage prop'larını geçmeli.
  const t = tProp || ((key) => key);
  const locale = localeProp || 'en';
  const setLanguage = setLanguageProp || (() => {});
  
  const getInitialDate = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const [stepIndex, setStepIndex] = useState(0);
  const [gender, setGender] = useState('male');
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [wakeAt, setWakeAt] = useState(getInitialDate(8, 0));
  const [sleepAt, setSleepAt] = useState(getInitialDate(23, 0));
  const [unit, setUnit] = useState('kg'); 
  const [calculatedGoalMl, setCalculatedGoalMl] = useState(null);

  const [showWake, setShowWake] = useState(Platform.OS === 'ios');
  const [showSleep, setShowSleep] = useState(Platform.OS === 'ios');

  const [loadingIdx, setLoadingIdx] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  const loadingPhrases = useMemo(() => [
    t('onboard.loading.bmi'),
    t('onboard.loading.water'),
    t('onboard.loading.plan'),
  ], [t]);

  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];

  useEffect(() => {
    const target = Math.min(stepIndex / (STEPS.length - 2), 1); 
    Animated.timing(progress, { toValue: target, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [stepIndex]);

  useEffect(() => {
    if (step !== 'loading') return;
    
    const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
    );

    pulseLoop.start();

    const timer = setInterval(() => setLoadingIdx(i => (i+1)%3), 1500);
    
    return () => { 
        clearInterval(timer);
        pulseLoop.stop();
    };
  }, [step]);

  const animateTransition = (callback) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    callback();
  };

  const next = async () => {
    // Sonuç ekranındayken (result) buton artık onboarding'i bitirmeli.
    // NOT: result son adım olduğu için `isLast` kontrolü önce gelirse buton çalışmaz.
    if (step === 'result') {
      // Bildirim iznini kullanıcı hedefini gördükten sonra iste ve varsayılan hatırlatıcıları kur.
      // Eskiden izin uygulama açılır açılmaz isteniyor, hatırlatıcılar ise hiç kurulmuyordu.
      try {
        await scheduleReminders({ wakeAt: toHHMM(wakeAt), sleepAt: toHHMM(sleepAt), intervalHours: DEFAULT_INTERVAL_HOURS });
      } catch (e) {
        console.warn('Reminder scheduling failed', e);
      }
      onDone?.();
      return;
    }

    if (isLast) return;

    const nextStep = stepIndex + 1;

    animateTransition(() => {
      setStepIndex(nextStep);
    });

    if (STEPS[nextStep] === 'loading') {
      setTimeout(async () => {
        try {
          const weightKg = unit === 'kg' ? weight : Math.round(weight / 2.20462);
          let dailyGoalMl = weightKg * 35;
          if (height > 170) dailyGoalMl += (height - 170) * 10;
          if (height < 160) dailyGoalMl -= (160 - height) * 10;
          dailyGoalMl = Math.max(1200, Math.min(5000, Math.round(dailyGoalMl)));
          setCalculatedGoalMl(dailyGoalMl);

          const profileData = {
            gender,
            unit,
            weight: weightKg,
            weightKg: weightKg,
            height: height,
            heightCm: height,
            wakeAt: toHHMM(wakeAt),
            sleepAt: toHHMM(sleepAt),
          };

          await AsyncStorage.multiSet([
            ['ONBOARD_PROFILE', JSON.stringify(profileData)],
            ['DAILY_GOAL_ML', String(dailyGoalMl)],
            ['HAS_ONBOARDED', '1'],
          ]);

          const store = useHydrationStore.getState();
          await store.updateProfile({
            weight: weightKg,
            height: height,
            wakeAt: profileData.wakeAt,
            sleepAt: profileData.sleepAt,
            gender: gender
          });
          await store.setGoalMl(dailyGoalMl);

        } catch (e) {
          console.warn('Save failed', e);
        } finally {
          // Sonuç ekranına geç (kullanıcı hedefi görsün)
          animateTransition(() => {
            setStepIndex(prevIdx => {
              const resultIdx = STEPS.indexOf('result');
              return resultIdx > -1 ? resultIdx : prevIdx;
            });
          });
        }
      }, 3000);
    }
  };
  useEffect(() => {
    if (step !== 'result') return;

    const run = async () => {
      try {
        const shown = await AsyncStorage.getItem('PAYWALL_SHOWN_AFTER_ONBOARD');
        if (shown === '1') return;

        // Kullanıcı günlük hedefi görsün diye kısa bir gecikme
        setTimeout(() => {
          onShowPaywall?.();
        }, 600);

        await AsyncStorage.setItem('PAYWALL_SHOWN_AFTER_ONBOARD', '1');
      } catch (e) {
        // Sessiz geç
      }
    };

    run();
  }, [step, onShowPaywall]);

  const prev = () => { 
    if (!isFirst) animateTransition(() => setStepIndex(stepIndex - 1)); 
  };

  const getTitle = () => {
    switch (step) {
      case 'gender': return t('onboard.gender.title');
      case 'weight': return t('onboard.weight.title');
      case 'height': return t('onboard.height.title');
      case 'wake':   return t('onboard.wake.title');
      case 'sleep':  return t('onboard.sleep.title');
      default: return '';
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'gender': return t('onboard.gender.subtitle');
      case 'weight': return t('onboard.weight.subtitle');
      case 'height': return t('onboard.height.subtitle');
      case 'wake':   return t('onboard.wake.subtitle');
      case 'sleep':  return t('onboard.sleep.subtitle');
      default: return '';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle={c.statusBar} backgroundColor="transparent" />

      <SafeAreaView style={[styles.safe, { paddingTop: insets.top }]} edges={['top']}>
        
        {/* --- LANGUAGE TOGGLE (Step 1 Only) --- */}
        {isFirst && (
          <View style={[styles.langToggle, { top: insets.top + 15 }]}>
            <TouchableOpacity 
              onPress={() => setLanguage('en')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.langText, locale === 'en' && styles.langActive]}>English</Text>
            </TouchableOpacity>
            
            <Text style={styles.langSep}>|</Text>
            
            <TouchableOpacity 
              onPress={() => setLanguage('tr')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.langText, locale === 'tr' && styles.langActive]}>Türkçe</Text>
            </TouchableOpacity>
          </View>
        )}

        {step !== 'loading' && step !== 'result' && (
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

        <View style={[styles.contentContainer, { paddingBottom: insets.bottom + BOTTOM_NAV_SPACE }]}>
          {step !== 'loading' && step !== 'result' && (
            <View style={styles.glassCard}>
              
              {step === 'gender' && (
                <View style={styles.genderRow}>
                  <Avatar styles={styles} label={t('onboard.gender.male')} active={gender==='male'} img={IMG_MALE} onPress={()=>setGender('male')} color={c.accent} />
                  <Avatar styles={styles} label={t('onboard.gender.female')} active={gender==='female'} img={IMG_FEMALE} onPress={()=>setGender('female')} color={dark ? '#F28CA6' : '#D9506F'} />
                </View>
              )}

              {step === 'weight' && (
                <View style={styles.centerContent}>
                  <Image source={gender==='male'?IMG_MALE:IMG_FEMALE} style={styles.illustration} />
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerGlass}>
                      <Picker selectedValue={weight} onValueChange={setWeight} style={styles.picker} itemStyle={styles.pickerItem} themeVariant={dark ? 'dark' : 'light'}>
                        {Array.from({length:150}, (_,i) => 30+i).map(v=><Picker.Item key={v} label={`${v}`} value={v} />)}
                      </Picker>
                    </View>
                    <Text style={styles.unitText}>{t('units.kg')}</Text>
                  </View>
                </View>
              )}

              {step === 'height' && (
                <View style={styles.centerContent}>
                  <Image source={gender==='male'?IMG_MALE_LENGTH:IMG_FEMALE_LENGTH} style={styles.illustration} />
                  <View style={styles.pickerWrapper}>
                    <View style={styles.pickerGlass}>
                      <Picker selectedValue={height} onValueChange={setHeight} style={styles.picker} itemStyle={styles.pickerItem} themeVariant={dark ? 'dark' : 'light'}>
                        {Array.from({length:100}, (_,i) => 120+i).map(v=><Picker.Item key={v} label={`${v}`} value={v}/>)}
                      </Picker>
                    </View>
                    <Text style={styles.unitText}>{t('units.cm')}</Text>
                  </View>
                </View>
              )}

              {(step === 'wake' || step === 'sleep') && (
                <View style={styles.centerContent}>
                  <Image source={step==='wake'?IMG_WAKE:(gender==='male'?IMG_NAP_MALE:IMG_NAP_FEMALE)} style={[styles.illustration, styles.illustrationSmall]} />
                  
                  <View style={styles.timeCard}>
                    {Platform.OS === 'ios' ? (
                      <DateTimePicker 
                        value={step==='wake'?wakeAt:sleepAt} 
                        mode="time" 
                        display="spinner" 
                        onValueChange={(e,d)=>d && (step==='wake'?setWakeAt(d):setSleepAt(d))} 
                        style={styles.iosPicker}
                        textColor={c.ink}
                        themeVariant={dark ? 'dark' : 'light'}
                      />
                    ) : (
                      <TouchableOpacity onPress={()=>(step==='wake'?setShowWake(true):setShowSleep(true))} style={styles.androidTimeBtn}>
                         <Text style={styles.androidTimeTxt}>
                           {step==='wake' 
                             ? `${String(wakeAt.getHours()).padStart(2,'0')}:${String(wakeAt.getMinutes()).padStart(2,'0')}` 
                             : `${String(sleepAt.getHours()).padStart(2,'0')}:${String(sleepAt.getMinutes()).padStart(2,'0')}`}
                         </Text>
                         <Ionicons name="time-outline" size={24} color={c.onAccent} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {(step==='wake'?showWake:showSleep) && Platform.OS==='android' && (
                     <DateTimePicker 
                        value={step==='wake'?wakeAt:sleepAt} 
                        mode="time" 
                        is24Hour 
                        onValueChange={(e,d)=>{ (step==='wake'?setShowWake(false):setShowSleep(false)); if(d) (step==='wake'?setWakeAt(d):setSleepAt(d)); }}
                        onDismiss={()=>(step==='wake'?setShowWake(false):setShowSleep(false))} 
                     />
                  )}
                </View>
              )}

            </View>
          )}

          {step === 'loading' && (
            <View style={styles.loadingContainer}>
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <Mascot mood="happy" size={150} />
              </Animated.View>
              <Text style={styles.loadingText}>{loadingPhrases[loadingIdx]}</Text>
              <View style={styles.loadingDots}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: c.accent, opacity: i === loadingIdx ? 1 : 0.3 }]} />
                ))}
              </View>
            </View>
          )}
          {step === 'result' && (
            <View style={styles.resultContainer}>
              <Mascot mood="celebrate" size={140} />
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>{t('onboard.result.title')}</Text>
                <Text style={styles.resultValue}>
                  {calculatedGoalMl ? `${fmtNumber(calculatedGoalMl)} ${t('units.ml')}` : `-- ${t('units.ml')}`}
                </Text>
                <Text style={styles.resultSub}>
                  {t('onboard.result.subtitle')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* --- ALT BUTONLAR (ABSOLUTE POSITION) --- */}
        {step !== 'loading' && (
          <View style={[styles.bottomNav, { 
             bottom: insets.bottom + 20, 
             justifyContent: (isFirst || step === 'result') ? 'center' : 'space-between'
          }]}>
            
            {!isFirst && step !== 'result' && (
              <TouchableOpacity onPress={prev} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={c.ink2} />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={next} 
              style={[styles.nextBtn, !isFirst && step !== 'result' && { marginLeft: 20 }]}
              activeOpacity={0.8}
            >
              <View style={styles.nextBtnInner}>
                <Text style={styles.nextBtnText}>
                  {step === 'result' ? t('common.done') : t('common.next')}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={c.onAccent} />
              </View>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

const Avatar = ({styles, label, active, img, onPress, color}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.avatarCard, active && {borderColor: color, transform:[{scale:1.05}]}]}>
    <View style={[styles.avatarCircle, active && {backgroundColor: color+'20'}]}>
       <Image source={img} style={styles.avatarImg} />
    </View>
    <Text style={[styles.avatarLabel, active && styles.avatarLabelActive, active && {color}]}>{label}</Text>
    {active && <View style={[styles.checkBadge, {backgroundColor: color}]}><Ionicons name="checkmark" size={16} color="#fff"/></View>}
  </TouchableOpacity>
);

// Tema token'larıyla stiller (açık/koyu)
const makeStyles = (c, type) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  safe: { flex: 1 },

  langToggle: {
    position: 'absolute',
    right: 22,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  langText: { ...type.label, fontSize: 14, color: c.ink3 },
  langActive: { ...type.labelStrong, fontSize: 14, color: c.accentInk },
  langSep: { marginHorizontal: 8, color: c.ink3, fontSize: 12 },

  header: { paddingHorizontal: 22, marginTop: 56, marginBottom: 10 },
  progressContainer: { height: 6, backgroundColor: c.track, borderRadius: 3, overflow: 'hidden', marginBottom: 22 },
  progressBar: { height: '100%', backgroundColor: c.accent, borderRadius: 3 },
  title: { ...type.title, color: c.ink, marginBottom: 6 },
  subtitle: { ...type.body, color: c.ink2, lineHeight: 22 },

  contentContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  glassCard: {
    backgroundColor: c.card,
    borderRadius: 28,
    padding: 20,
    shadowColor: c.shadowColor,
    shadowOpacity: c.shadowOpacity,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    minHeight: 380,
    justifyContent: 'center',
  },

  genderRow: { flexDirection: 'row', justifyContent: 'space-around' },
  avatarCard: { alignItems: 'center', padding: 15, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', backgroundColor: c.cardAlt },
  avatarCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarImg: { width: 100, height: 100, resizeMode: 'contain' },
  avatarLabel: { ...type.bodyStrong, fontSize: 18, color: c.ink2 },
  avatarLabelActive: { fontFamily: type.title.fontFamily },
  checkBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  centerContent: { alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 200, height: 200, resizeMode: 'contain', marginBottom: 20 },
  // Saat seçici yüksek olduğu için uyanış/uyku adımlarında görsel küçülür
  illustrationSmall: { width: 140, height: 140, marginBottom: 12 },
  pickerWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pickerGlass: { height: 180, width: 120, overflow: 'hidden', borderRadius: 20, backgroundColor: c.cardAlt },
  picker: { width: 120, height: 180 },
  pickerItem: { fontSize: 32, fontFamily: type.title.fontFamily, color: c.ink },
  unitText: { ...type.heading, color: c.ink3, marginLeft: 15 },

  timeCard: { backgroundColor: c.cardAlt, padding: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center', minWidth: 200 },
  iosPicker: { width: 200 },
  androidTimeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.accent, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 18 },
  androidTimeTxt: { ...type.display, fontSize: 36, color: c.onAccent, marginRight: 10 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  loadingText: { ...type.heading, fontSize: 20, color: c.ink, textAlign: 'center', paddingHorizontal: 24 },
  loadingDots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },

  bottomNav: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
  },
  backBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 1, borderRadius: 999, backgroundColor: c.accent, shadowColor: c.accent, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  nextBtnInner: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnText: { ...type.heading, fontSize: 18, color: c.onAccent },
  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 8 },
  resultCard: {
    width: '100%',
    backgroundColor: c.card,
    borderRadius: 28,
    padding: 26,
    shadowColor: c.shadowColor,
    shadowOpacity: c.shadowOpacity,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    alignItems: 'center',
  },
  resultTitle: { ...type.heading, color: c.ink, textAlign: 'center', marginBottom: 6 },
  resultValue: { ...type.display, fontSize: 46, color: c.accentInk, textAlign: 'center', marginBottom: 10 },
  resultSub: { ...type.body, fontSize: 15, color: c.ink2, textAlign: 'center', lineHeight: 22 },
});

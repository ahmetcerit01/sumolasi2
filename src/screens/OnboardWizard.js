import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  withDelay,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  ZoomIn,
  SensorType,
  useAnimatedSensor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { scheduleOnRN } from 'react-native-worklets';
import { useHydrationStore } from '../storage/useHydrationStore';
import { DEFAULT_GOAL, computeGoalMl } from '../utils/goal';
import { computeReminderTimes, disableReminders, scheduleReminders } from '../utils/reminders';
import { fonts, useTheme } from '../theme/theme';
import { fmtNumber, upper } from '../utils/format';
import ParticleMorph from '../animation/ParticleMorph';
import { SCENE } from '../animation/particleScenes';
import ValueScale from '../components/onboarding/ValueScale';
import IntervalDial from '../components/onboarding/IntervalDial';
import SkiaGlass from '../components/SkiaGlass';
import { DrinkIcon } from '../components/QuickAdd';
import WaterOrb from '../components/onboarding/WaterOrb';
import WaterColumn from '../components/onboarding/WaterColumn';
import SkyBackdrop from '../components/onboarding/SkyBackdrop';

// Onboarding: 6 sahne.
//  1 karşılama: yukarıdan bir damla düşer; dokununca dağılır.
//  2 demo: +200/+300/+500 ile gerçek bardak dolar (kaydedilmez).
//  3 kilo + boy: değer değiştikçe arkadaki su sütunu yükselir/alçalır.
//  4 gün ritmi: seçilen saate göre arkadaki gökyüzü değişir (güneş, gün batımı, ay).
//  5 hedef: parçacıklar bir araya gelir (hesaplama), ardından su küresi dolar ve hedef belirir;
//    hedef buradan ayarlanabilir.
//  6 hatırlatma halkası: bildirim iznini ister ve bitirir.
// Tek bir parçacık sürüsü bütün akış boyunca yaşar. Hedef 5. sahneye girilince hesaplanıp kaydedilir;
// HAS_ONBOARDED en sonda yazılır.
// preview: geliştirici önizlemesi — hiçbir şey kaydedilmez, izin istenmez.

const STEPS = ['welcome', 'demo', 'body', 'rhythm', 'goal', 'remind'];
const HERO_STEPS = ['welcome', 'goal'];
const DEMO_CAP = 1000; // demo bardağı bu kadar ml'de dolar
const DEMO_AMOUNTS = [
  { ml: 200, icon: 'cup' },
  { ml: 300, icon: 'mug' },
  { ml: 500, icon: 'bottle' },
];
const CALC_LINES = ['calc1', 'calc2', 'calc3'];
const LB = 2.20462;
const INTERVAL_CHIPS = [
  { min: 30, key: 'm30' },
  { min: 60, key: 'h1' },
  { min: 90, key: 'h15' },
  { min: 120, key: 'h2' },
];

const toHHMM = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const atTime = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const fmtFtIn = (inches) => `${Math.floor(inches / 12)}′${inches % 12}″`;


export default function OnboardWizard({ onDone, onLeaveStart, introActive = true, preview = false, t: tProp, locale = 'en', setLanguage = () => {} }) {
  const t = tProp || ((k) => k);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { c, type, dark } = useTheme();
  const reduceMotion = useReducedMotion();
  const styles = useMemo(() => makeStyles(c, type), [c]);

  const [step, setStep] = useState('welcome');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(170);
  const [wakeAt, setWakeAt] = useState(atTime(8, 0));
  const [sleepAt, setSleepAt] = useState(atTime(23, 0));
  const [editing, setEditing] = useState(null); // 'wake' | 'sleep'
  const [goalMl, setGoalMl] = useState(DEFAULT_GOAL);
  const [intervalMin, setIntervalMin] = useState(120);
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(1); // 1 ileri, -1 geri: geçiş yönü
  const [burst, setBurst] = useState(false); // karşılamada damla dağılıyor
  const [demoMl, setDemoMl] = useState(0);
  const [demoSignal, setDemoSignal] = useState(0);
  const [phase, setPhase] = useState('calc'); // hedef sahnesi: 'calc' → 'final'
  const [calcLine, setCalcLine] = useState(0);

  const index = STEPS.indexOf(step);
  const hero = HERO_STEPS.includes(step);
  const go = (s) => {
    setEditing(null);
    setDir(STEPS.indexOf(s) >= index ? 1 : -1);
    setStep(s);
  };

  // ---- Kayıt ---------------------------------------------------------------------------
  const persistProfile = async (goal) => {
    if (preview) return;
    const weight = Math.round(weightKg);
    const profileData = {
      unit: weightUnit,
      weightUnit,
      heightUnit,
      weight,
      weightKg: weight,
      height: heightCm,
      heightCm,
      wakeAt: toHHMM(wakeAt),
      sleepAt: toHHMM(sleepAt),
    };
    try {
      await AsyncStorage.multiSet([
        ['ONBOARD_PROFILE', JSON.stringify(profileData)],
        ['DAILY_GOAL_ML', String(goal)],
      ]);
      const store = useHydrationStore.getState();
      await store.updateProfile({ weight, height: heightCm, wakeAt: profileData.wakeAt, sleepAt: profileData.sleepAt });
      await store.setGoalMl(goal);
    } catch (e) {
      console.warn('Save failed', e);
    }
  };

  // Hedef sahnesi: girilince hedefi hesapla + kaydet. İlk girişte kısa bir "hesaplama" bölümü oynar,
  // sonra su küresi dolar. Kilo/boy değişmediyse (ör. hatırlatmadan geri dönüş) elle ayarlanan hedef korunur.
  const lastInputs = useRef(null);
  useEffect(() => {
    if (step !== 'goal') return;
    const key = `${Math.round(weightKg)}-${heightCm}`;
    const changed = lastInputs.current !== key;
    lastInputs.current = key;
    if (changed) {
      const goal = computeGoalMl(weightKg, heightCm);
      setGoalMl(goal);
      persistProfile(goal);
    }
    if (!changed || reduceMotion) {
      setPhase('final');
      return;
    }
    setPhase('calc');
    setCalcLine(0);
    const lines = setInterval(() => setCalcLine((n) => Math.min(n + 1, CALC_LINES.length - 1)), 1000);
    const done = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setPhase('final');
    }, 3100);
    return () => {
      clearInterval(lines);
      clearTimeout(done);
    };
  }, [step]);
  const finalShown = step === 'goal' && phase === 'final';
  const shownGoal = useCountUp(goalMl, finalShown, reduceMotion);

  const adjustGoal = (delta) => {
    const next = Math.max(1000, Math.min(5000, goalMl + delta));
    if (next === goalMl) return;
    Haptics.selectionAsync().catch(() => {});
    setGoalMl(next);
    if (!preview) {
      AsyncStorage.setItem('DAILY_GOAL_ML', String(next)).catch(() => {});
      useHydrationStore.getState().setGoalMl(next).catch(() => {});
    }
  };

  // Karşılama: damla yukarıdan düşer; dokununca dağılır ve demo açılır
  const dropFall = useSharedValue(reduceMotion ? 0 : -height * 0.32);
  useEffect(() => {
    if (reduceMotion) return;
    dropFall.value = withDelay(250, withTiming(0, { duration: 1100, easing: Easing.out(Easing.back(1.25)) }));
  }, []);
  const breakDrop = () => {
    if (burst) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBurst(true);
    setTimeout(() => {
      go('demo');
      setBurst(false);
    }, reduceMotion ? 0 : 600);
  };

  // Demo: bardak gerçekten dolar; dolunca bir sonraki dokunuş baştan başlatır
  const addDemo = (ml) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDemoMl((v) => (v >= DEMO_CAP ? ml : Math.min(DEMO_CAP, v + ml)));
    setDemoSignal((n) => n + 1);
  };

  // Parçacık sahnesi: karşılamada damla (dokununca dağılır), hesaplamada bir araya gelen çekirdek,
  // finalde küre öne çıktığı için soluk toz
  const particleScene =
    step === 'welcome' ? (burst ? SCENE.SCATTER : SCENE.DROP) : step === 'goal' && phase === 'calc' ? SCENE.RHYTHM : SCENE.SCATTER;
  const particleDim = step === 'welcome' || (step === 'goal' && phase === 'calc') ? 0 : step === 'goal' ? 0.7 : 0.6;
  // Su sütunu seviyesi: hedef 1,5 L → ekranın %8'i, 4 L → %55'i
  const columnLevel = 0.08 + (0.47 * (computeGoalMl(weightKg, heightCm) - 1500)) / 2500;
  const toMin = (d) => d.getHours() * 60 + d.getMinutes();
  const skyMinutes = toMin(editing === 'sleep' ? sleepAt : wakeAt);

  // ---- Gezinme -------------------------------------------------------------------------
  const back = () => {
    if (index > 0) go(STEPS[index - 1]);
  };

  const skip = () => {
    if (step === 'welcome' || step === 'demo') return go('body');
    if (step === 'body' || step === 'rhythm') return go('goal');
    if (step === 'goal') return go('remind');
    if (step === 'remind') return noReminders();
  };

  const noReminders = () => {
    if (!preview) disableReminders().catch(() => {});
    finish();
  };

  const allowNotifications = async () => {
    if (busy) return;
    setBusy(true);
    if (!preview) {
      try {
        await scheduleReminders({ wakeAt: toHHMM(wakeAt), sleepAt: toHHMM(sleepAt), intervalHours: intervalMin / 60 });
      } catch (e) {
        console.warn('Reminder scheduling failed', e);
      }
    }
    setBusy(false);
    finish();
  };

  // Çıkış geçişi: yazılar söner, damla küçülüp ana ekrandaki bardağın içine iner,
  // ardından bütün ekran yumuşakça ana sayfaya karışır (ana sayfa bu sırada arkada hazırdır).
  const [leaving, setLeaving] = useState(false);
  const uiFade = useSharedValue(1);
  const exitP = useSharedValue(0);
  const sceneFade = useSharedValue(1);
  const finish = async () => {
    if (leaving) return;
    setLeaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!preview) await AsyncStorage.setItem('HAS_ONBOARDED', '1').catch(() => {});
    onLeaveStart?.();
    const done = () => onDone?.();
    if (reduceMotion) {
      sceneFade.value = withTiming(0, { duration: 400 }, (f) => f && scheduleOnRN(done));
      return;
    }
    uiFade.value = withTiming(0, { duration: 260 });
    exitP.value = withDelay(120, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    sceneFade.value = withDelay(760, withTiming(0, { duration: 640, easing: Easing.out(Easing.quad) }, (f) => f && scheduleOnRN(done)));
  };

  const CTA = {
    welcome: { label: t('onboard.flow.welcome.cta'), onPress: breakDrop },
    demo: { label: t('common.continue'), onPress: () => go('body') },
    body: { label: t('common.continue'), onPress: () => go('rhythm') },
    rhythm: { label: t('onboard.flow.rhythm.cta'), onPress: () => go('goal') },
    goal: phase === 'final' ? { label: t('onboard.flow.goal.cta'), onPress: () => go('remind'), icon: 'notifications' } : null,
    remind: { label: t('onboard.flow.remind.cta'), onPress: allowNotifications, icon: 'water' },
  }[step];

  // ---- Parçacık sahnesi yerleşimi: üstteki boş alanın ortası ---------------------------
  const stageTop = insets.top + 52;
  const stageBottom = height - 430;
  const stageCy = (stageTop + stageBottom) / 2;
  const stageR = Math.min(width * 0.27, ((stageBottom - stageTop) / 2) * 0.82);
  // ana ekrandaki bardağın yaklaşık merkezi (damla oraya iner)
  const glassY = insets.top + height * 0.3;
  const uiStyle = useAnimatedStyle(() => ({ opacity: uiFade.value }));
  // Hareket efekti: telefon eğildikçe parçacıklar bir yöne, yazılar hafifçe öbür yöne kayar (derinlik hissi)
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 32 });
  // -1…1 arası, yumuşatılmış eğim. Elde tutulan telefonda yerçekimi y ≈ -7 civarı: sapmayı al
  const tiltX = useDerivedValue(() => {
    const v = reduceMotion ? 0 : Math.max(-1, Math.min(1, gravity.sensor.value.x / 4));
    return withTiming(v, { duration: 160 });
  });
  const tiltY = useDerivedValue(() => {
    const v = reduceMotion ? 0 : Math.max(-1, Math.min(1, (gravity.sensor.value.y + 7) / 4));
    return withTiming(v, { duration: 160 });
  });
  const sceneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tiltX.value * 18 },
      { translateY: dropFall.value + exitP.value * (glassY - stageCy) - tiltY.value * 14 },
      { scale: 1 - exitP.value * 0.5 },
    ],
  }));
  const textParallax = useAnimatedStyle(() => ({
    transform: [{ translateX: -tiltX.value * 5 }, { translateY: tiltY.value * 4 }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: sceneFade.value }));

  const reminderCount = computeReminderTimes(toHHMM(wakeAt), toHHMM(sleepAt), intervalMin / 60).length;

  return (
    <Animated.View style={[styles.container, rootStyle]} pointerEvents={leaving ? 'none' : 'auto'}>
      <StatusBar barStyle={c.statusBar} backgroundColor="transparent" translucent />

      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [width / 2, stageCy, 0] }, sceneStyle]} pointerEvents="none">
        <ParticleMorph
          key={`${width}x${height}`}
          width={width}
          height={height}
          centerX={width / 2}
          centerY={stageCy}
          radius={stageR}
          scene={particleScene}
          dim={particleDim}
          colors={c}
          dark={dark}
          reduceMotion={reduceMotion}
          active={introActive}
          transitionMs={1000}
          entryMs={1600}
        />
        {finalShown && (
          <Animated.View
            entering={reduceMotion ? FadeIn.duration(300) : ZoomIn.duration(800).easing(Easing.out(Easing.back(1.3)))}
            exiting={FadeOut.duration(200)}
            style={[styles.orb, { top: stageCy - stageR * 1.1, left: width / 2 - stageR * 1.1, width: stageR * 2.2, height: stageR * 2.2 }]}
          >
            <WaterOrb size={stageR * 2.2} progress={0.78} colors={c} duration={reduceMotion ? 0 : 1700} />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.orbLabel}>
                <Text style={[type.display, styles.orbNum]}>{fmtNumber(shownGoal)}</Text>
                <Text style={[type.bodyStrong, styles.orbUnit]}>{t('onboard.flow.goal.perDay')}</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* sahneye özel arka planlar */}
      {step === 'body' && (
        <Animated.View entering={FadeIn.duration(700)} exiting={FadeOut.duration(300)} style={StyleSheet.absoluteFill} pointerEvents="none">
          <WaterColumn width={width} height={height} level={columnLevel} colors={c} />
        </Animated.View>
      )}
      {step === 'rhythm' && (
        <Animated.View entering={FadeIn.duration(700)} exiting={FadeOut.duration(300)} style={[StyleSheet.absoluteFill, { top: height * 0.4 }]} pointerEvents="none">
          <SkyBackdrop width={width} height={height * 0.6} minutes={skyMinutes} bg={c.bg} opacity={dark ? 0.9 : 0.75} />
        </Animated.View>
      )}

      <Animated.View style={[{ flex: 1 }, uiStyle]}>
      {/* üst çubuk */}
      <View style={[styles.topBar, { marginTop: insets.top + 6 }]}>
        <View style={styles.topLeft}>
          {index > 0 && !(step === 'goal' && phase === 'calc') && (
            <TouchableOpacity onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('onboard.flow.back')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={c.ink2} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.topRight}>
          {step === 'welcome' && (
            <View style={styles.lang}>
              {['tr', 'en'].map((l, i) => (
                <React.Fragment key={l}>
                  {i > 0 && <Text style={styles.langSep}>·</Text>}
                  <TouchableOpacity onPress={() => setLanguage(l)} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.langText, locale === l && { color: c.accentInk }]}>{l.toUpperCase()}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
          {!(step === 'goal' && phase === 'calc') && (
            <TouchableOpacity onPress={skip} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>{t('onboard.flow.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* adım içeriği (eğim paralaksı dış sarmalayıcıda: geçiş animasyonuyla çakışmasın) */}
      <Animated.View style={[{ flex: 1 }, hero && textParallax]}>
      <Animated.View
        key={step}
        entering={reduceMotion ? FadeIn.duration(250) : (dir > 0 ? FadeInRight : FadeInLeft).duration(480).delay(90).easing(Easing.out(Easing.cubic))}
        exiting={reduceMotion ? FadeOut.duration(120) : (dir > 0 ? FadeOutLeft : FadeOutRight).duration(220).easing(Easing.in(Easing.quad))}
        style={[styles.body, hero && styles.heroBody]}
      >
        {step === 'welcome' && (
          <>
            {/* damlaya dokununca dağılır */}
            <Pressable style={{ flex: 1 }} onPress={breakDrop} accessibilityRole="button" accessibilityLabel={t('onboard.flow.welcome.cta')} />
            <HeroText styles={styles} tag={t('onboard.flow.welcome.tag')} title={t('onboard.flow.welcome.title')} body={t('onboard.flow.welcome.body')} />
          </>
        )}

        {step === 'demo' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.demo.tag')} title={t('onboard.flow.demo.title')} body={t('onboard.flow.demo.body')} />
            <View style={styles.demoArea}>
              <Rise i={3} style={{ alignItems: 'center' }}>
                <SkiaGlass width={168} height={210} progress={demoMl / DEMO_CAP} addSignal={demoSignal} colors={c} />
                <Text style={[type.heading, styles.demoMl]}>{fmtNumber(demoMl)} ml</Text>
              </Rise>
              <Rise i={4} style={styles.demoRow}>
                {DEMO_AMOUNTS.map((a) => (
                  <TouchableOpacity
                    key={a.ml}
                    onPress={() => addDemo(a.ml)}
                    activeOpacity={0.8}
                    style={[styles.demoBtn, { backgroundColor: c.card, borderColor: c.divider }]}
                    accessibilityRole="button"
                    accessibilityLabel={`+${a.ml} ml`}
                  >
                    <DrinkIcon name={a.icon} size={24} color={c.accent} />
                    <Text style={[type.bodyStrong, { color: c.ink, fontSize: 16, marginTop: 6 }]}>+{a.ml} ml</Text>
                  </TouchableOpacity>
                ))}
              </Rise>
              <Text style={[styles.hint, { textAlign: 'center', minHeight: 22, opacity: demoMl >= DEMO_CAP ? 1 : 0 }]}>{t('onboard.flow.demo.full')}</Text>
            </View>
          </>
        )}

        {step === 'body' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.goalStep', { n: 1 })} title={t('onboard.flow.body.title')} body={t('onboard.flow.body.body')} />
            <View style={styles.bodyArea}>
              <Rise i={3}>
                <View style={styles.measureHead}>
                  <Text style={styles.groupLabel}>{t('onboard.flow.body.weight')}</Text>
                  <UnitToggle styles={styles} c={c} value={weightUnit} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={setWeightUnit} />
                </View>
                {weightUnit === 'kg' ? (
                  <ValueScale compact value={Math.round(weightKg)} min={35} max={150} onChange={setWeightKg} unit="kg" />
                ) : (
                  <ValueScale compact value={Math.round(weightKg * LB)} min={77} max={330} onChange={(lb) => setWeightKg(lb / LB)} unit="lb" />
                )}
              </Rise>
              <Rise i={4}>
                <View style={styles.measureHead}>
                  <Text style={styles.groupLabel}>{t('onboard.flow.body.height')}</Text>
                  <UnitToggle styles={styles} c={c} value={heightUnit} options={[['cm', 'cm'], ['ftin', 'ft/in']]} onChange={setHeightUnit} />
                </View>
                {heightUnit === 'cm' ? (
                  <ValueScale compact value={heightCm} min={130} max={210} onChange={setHeightCm} unit="cm" />
                ) : (
                  <ValueScale compact value={Math.round(heightCm / 2.54)} min={51} max={83} onChange={(inch) => setHeightCm(Math.round(inch * 2.54))} format={fmtFtIn} />
                )}
              </Rise>
            </View>
          </>
        )}

        {step === 'rhythm' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.goalStep', { n: 2 })} title={t('onboard.flow.rhythm.title')} body={t('onboard.flow.rhythm.body')} />
            <Rise i={3} style={styles.formArea}>
              <TimeRow styles={styles} c={c} title={t('onboard.flow.rhythm.wake')} sub={t('onboard.flow.rhythm.wakeSub')} value={toHHMM(wakeAt)} on={editing === 'wake'} onPress={() => setEditing(editing === 'wake' ? null : 'wake')} />
              <TimeRow styles={styles} c={c} title={t('onboard.flow.rhythm.sleep')} sub={t('onboard.flow.rhythm.sleepSub')} value={toHHMM(sleepAt)} on={editing === 'sleep'} onPress={() => setEditing(editing === 'sleep' ? null : 'sleep')} />
              {editing ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.pickerWrap}>
                  <DateTimePicker
                    value={editing === 'wake' ? wakeAt : sleepAt}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    is24Hour
                    minuteInterval={5}
                    themeVariant={dark ? 'dark' : 'light'}
                    textColor={c.ink}
                    onValueChange={(e, d) => {
                      if (Platform.OS !== 'ios') setEditing(null);
                      if (d) (editing === 'wake' ? setWakeAt : setSleepAt)(d);
                    }}
                    onDismiss={() => setEditing(null)}
                  />
                </Animated.View>
              ) : null}
            </Rise>
          </>
        )}

        {step === 'goal' && phase === 'calc' && (
          <View>
            <Rise i={0}><Text style={styles.overline}>{upper(t('onboard.flow.goal.calcTag'))}</Text></Rise>
            <Rise i={1}><Text style={styles.title}>{t('onboard.flow.goal.calcTitle')}</Text></Rise>
            <View style={styles.calcLineWrap}>
              <Animated.Text key={calcLine} entering={FadeInDown.duration(380)} exiting={FadeOut.duration(160)} style={styles.bodyText}>
                {t(`onboard.flow.goal.${CALC_LINES[calcLine]}`)}
              </Animated.Text>
            </View>
          </View>
        )}
        {finalShown && (
          <Animated.View entering={FadeIn.duration(300)}>
            <Rise i={2}><Text style={styles.overline}>{upper(t('onboard.flow.goal.tag'))}</Text></Rise>
            <Rise i={3}><Text style={styles.title}>{t('onboard.flow.goal.title')}</Text></Rise>
            <Rise i={5} style={[styles.adjustRow, { backgroundColor: c.card, borderColor: c.divider }]}>
              <RoundBtn c={c} icon="remove" onPress={() => adjustGoal(-250)} label="-250 ml" />
              <Text style={[type.bodyStrong, { color: c.ink2, fontSize: 15 }]}>{t('onboard.flow.goal.adjust')}</Text>
              <RoundBtn c={c} icon="add" onPress={() => adjustGoal(250)} label="+250 ml" />
            </Rise>
          </Animated.View>
        )}

        {step === 'remind' && (
          <View style={styles.remindWrap}>
            <Text style={[styles.overline, { textAlign: 'center' }]}>{upper(t('onboard.flow.remind.tag'))}</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>{t('onboard.flow.remind.title')}</Text>
            <Rise i={2} style={{ marginTop: 18 }}>
              <IntervalDial minutes={intervalMin} onChange={setIntervalMin} topLabel={t('onboard.flow.remind.dialTop')} subLabel={t('onboard.flow.remind.dialSub')} />
            </Rise>
            <Rise i={3}>
            <View style={[styles.chips, { borderColor: c.divider, backgroundColor: c.card }]}>
              {INTERVAL_CHIPS.map((ch) => {
                const on = ch.min === intervalMin;
                return (
                  <TouchableOpacity
                    key={ch.key}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIntervalMin(ch.min);
                    }}
                    style={[styles.chip, on && { backgroundColor: c.chip }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[type.bodyStrong, { fontSize: 15, color: on ? c.chipInk : c.ink2 }]}>{t(`onboard.flow.remind.${ch.key}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            </Rise>
            <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15, textAlign: 'center', marginTop: 18 }]}>
              {t('onboard.flow.remind.summary', { from: toHHMM(wakeAt), to: toHHMM(sleepAt), count: reminderCount })}
            </Text>
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>{t('onboard.flow.remind.hint')}</Text>
          </View>
        )}

      </Animated.View>
      </Animated.View>

      {/* alt: ana buton + ilerleme */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        {CTA ? (
          <PrimaryButton styles={styles} c={c} label={CTA.label} icon={CTA.icon} onPress={CTA.onPress} disabled={busy} />
        ) : (
          <View style={{ height: 60 }} />
        )}
        {step === 'remind' || finalShown ? (
          <TouchableOpacity onPress={noReminders} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={[type.label, { color: c.ink2, fontSize: 14, textDecorationLine: 'underline' }]}>{t(step === 'goal' ? 'onboard.flow.goal.none' : 'onboard.flow.remind.none')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.secondary} />
        )}
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <Seg key={s} styles={styles} c={c} state={i < index ? 'done' : i === index ? 'now' : 'todo'} />
          ))}
        </View>
      </View>
      </Animated.View>
    </Animated.View>
  );
}

// ---- Parçalar ----------------------------------------------------------------------------

// Sırayla süzülen satır: adım açılınca başlık, metin ve içerik art arda yerine oturur
const Rise = ({ i = 0, style, children }) => (
  <Animated.View entering={FadeInDown.duration(520).delay(160 + i * 90).easing(Easing.out(Easing.cubic))} style={style}>
    {children}
  </Animated.View>
);

const Header = ({ styles, tag, title, body }) => (
  <View style={styles.header}>
    <Rise i={0}><Text style={styles.overline}>{upper(tag)}</Text></Rise>
    <Rise i={1}><Text style={styles.title}>{title}</Text></Rise>
    {body ? <Rise i={2}><Text style={styles.bodyText}>{body}</Text></Rise> : null}
  </View>
);

const HeroText = ({ styles, tag, title, body }) => (
  <View>
    <Rise i={0}><Text style={styles.overline}>{upper(tag)}</Text></Rise>
    <Rise i={1}><Text style={styles.title}>{title}</Text></Rise>
    <Rise i={2}><Text style={styles.bodyText}>{body}</Text></Rise>
  </View>
);

// Hedef sayısı sıfırdan yumuşakça sayarak gelir; bitince hafif bir titreşim
// Sayım her görünüşte bir kez oynar; sonraki değişiklikler (hedefi ayarlama) doğrudan yansır.
function useCountUp(target, active, reduceMotion) {
  const [shown, setShown] = useState(target);
  const played = useRef(false);
  useEffect(() => {
    if (!active) {
      played.current = false;
      return;
    }
    if (reduceMotion || played.current) return setShown(target);
    played.current = true;
    let raf;
    let start;
    const DUR = 1100;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DUR);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round((target * eased) / 10) * 10);
      if (p < 1) raf = requestAnimationFrame(tick);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    };
    setShown(0);
    const delay = setTimeout(() => {
      start = Date.now();
      raf = requestAnimationFrame(tick);
    }, 350);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [target, active]);
  return shown;
}

// İlerleme çubuğu parçası: etkin adım genişleyip dolar
function Seg({ styles, c, state }) {
  const grow = useSharedValue(state === 'now' ? 2.2 : 1);
  useEffect(() => {
    grow.value = withTiming(state === 'now' ? 2.2 : 1, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [state]);
  const anim = useAnimatedStyle(() => ({ flexGrow: grow.value }));
  return (
    <Animated.View
      style={[
        styles.seg,
        { backgroundColor: state === 'todo' ? c.track : c.accent, opacity: state === 'done' ? 0.45 : 1 },
        state === 'now' && { height: 4 },
        anim,
      ]}
    />
  );
}

const UnitToggle = ({ styles, c, value, options, onChange }) => (
  <View style={[styles.unitToggle, { backgroundColor: c.card, borderColor: c.divider }]}>
    {options.map(([key, label]) => {
      const on = key === value;
      return (
        <TouchableOpacity
          key={key}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onChange(key);
          }}
          style={[styles.unitOpt, on && { backgroundColor: c.chip }]}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
        >
          <Text style={[styles.unitText, { color: on ? c.chipInk : c.ink2 }]}>{label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const TimeRow = ({ styles, c, title, sub, value, on, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[styles.timeRow, { backgroundColor: c.card, borderColor: on ? c.accent : 'transparent' }]}
    accessibilityRole="button"
    accessibilityLabel={`${title}, ${value}`}
  >
    <View style={{ flex: 1 }}>
      <Text style={styles.timeTitle}>{title}</Text>
      <Text style={styles.timeSub}>{sub}</Text>
    </View>
    <View style={[styles.timePill, { backgroundColor: c.cardAlt }]}>
      <Text style={[styles.timeValue, { color: c.accentInk }]}>{value}</Text>
      <Ionicons name="time-outline" size={22} color={c.ink} />
    </View>
  </TouchableOpacity>
);

const RoundBtn = ({ c, icon, onPress, label }) => (
  <TouchableOpacity
    onPress={onPress}
    hitSlop={8}
    style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.chip }}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={icon} size={22} color={c.chipInk} />
  </TouchableOpacity>
);

function PrimaryButton({ styles, c, label, icon, onPress, disabled }) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.value * 0.03 }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 90 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 160 }))}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.cta, { backgroundColor: c.accent, shadowColor: c.accent, opacity: disabled ? 0.7 : 1 }, anim]}>
        <Text style={styles.ctaText} numberOfLines={1}>{label}</Text>
        <Ionicons name={icon ? `${icon}-outline` : 'arrow-forward'} size={24} color={c.onAccent} />
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (c, type) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: { height: 44, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topLeft: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 14, marginLeft: -6 },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    lang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    langText: { ...type.labelStrong, fontSize: 13, color: c.ink3 },
    langSep: { color: c.ink3 },
    skip: { ...type.body, fontSize: 16, color: c.ink2 },

    body: { flex: 1, paddingHorizontal: 28 },
    heroBody: { justifyContent: 'flex-end', paddingBottom: 36 },
    header: { marginTop: 28 },
    overline: { ...type.overline, color: c.accent, marginBottom: 16 },
    title: { ...type.title, fontSize: 34, lineHeight: 40, letterSpacing: -1.2, color: c.ink },
    bodyText: { ...type.body, fontFamily: fonts.medium, fontSize: 16, lineHeight: 25, color: c.ink2, marginTop: 14 },
    hint: { ...type.body, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: c.ink2 },

    formArea: { marginTop: 30 },
    groupLabel: { ...type.body, fontSize: 15, color: c.ink2, marginBottom: 14 },
    bodyArea: { flex: 1, justifyContent: 'space-evenly' },
    measureHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    unitToggle: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, marginBottom: 14 },
    unitOpt: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
    unitText: { ...type.labelStrong, fontSize: 14 },

    timeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1.5, padding: 18, paddingLeft: 20, marginBottom: 14 },
    timeTitle: { ...type.bodyStrong, fontSize: 17, color: c.ink },
    timeSub: { ...type.body, fontSize: 14, color: c.ink2, marginTop: 4 },
    timePill: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
    timeValue: { ...type.heading, fontSize: 24, letterSpacing: -0.5 },
    pickerWrap: { alignItems: 'center', marginTop: 4, borderRadius: 24, backgroundColor: c.card },

    orb: { position: 'absolute' },
    orbLabel: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    orbNum: { fontSize: 48, lineHeight: 56, letterSpacing: -2, color: '#FFFFFF', textShadowColor: 'rgba(0,40,80,0.35)', textShadowRadius: 8 },
    orbUnit: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: -2 },
    calcLineWrap: { height: 40, marginTop: 4 },
    adjustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 999, borderWidth: 1, padding: 6, marginTop: 22 },

    demoArea: { flex: 1, justifyContent: 'space-evenly' },
    demoMl: { color: c.ink, fontSize: 22, textAlign: 'center', marginTop: 10 },
    demoRow: { flexDirection: 'row', gap: 12 },
    demoBtn: { flex: 1, alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingVertical: 14 },

    remindWrap: { flex: 1, paddingTop: 14 },
    chips: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 5, marginTop: 18 },
    chip: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },

    bottom: { paddingHorizontal: 28 },
    cta: {
      height: 60,
      borderRadius: 30,
      paddingHorizontal: 26,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowOpacity: 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    ctaText: { ...type.bodyStrong, fontSize: 18, color: c.onAccent, flex: 1, marginRight: 12 },
    secondary: { height: 34, alignItems: 'center', justifyContent: 'center' },
    progress: { flexDirection: 'row', gap: 6, marginTop: 2 },
    seg: { flexBasis: 0, height: 3, borderRadius: 2 },
  });

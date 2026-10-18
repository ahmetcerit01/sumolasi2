import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  withDelay,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { scheduleOnRN } from 'react-native-worklets';
import { useHydrationStore } from '../storage/useHydrationStore';
import { computeReminderTimes, disableReminders, scheduleReminders } from '../utils/reminders';
import { fonts, useTheme } from '../theme/theme';
import { fmtNumber, upper } from '../utils/format';
import ParticleMorph from '../animation/ParticleMorph';
import { SCENE } from '../animation/particleScenes';
import ValueScale from '../components/onboarding/ValueScale';
import IntervalDial from '../components/onboarding/IntervalDial';

// Onboarding: 10 adım. Tek bir parçacık sürüsü bütün akış boyunca yaşar; "kahraman" adımlarda
// (karşılama, hazırlanıyor, hedef, hazırsın) şekil alır, form adımlarında soluk bir toz olarak arkada kalır.
// Kayıt: hedef "hazırlanıyor" adımında hesaplanıp kaydedilir; HAS_ONBOARDED en sonda yazılır.
// preview: geliştirici önizlemesi — hiçbir şey kaydedilmez, izin istenmez.

const STEPS = ['welcome', 'units', 'weight', 'height', 'rhythm', 'loading', 'goal', 'remind', 'notify', 'ready'];
const HERO = { welcome: SCENE.DROP, loading: SCENE.RHYTHM, goal: SCENE.GLASS, ready: SCENE.DROP };
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

export const computeGoalMl = (weightKg, heightCm) => {
  let ml = weightKg * 35;
  if (heightCm > 170) ml += (heightCm - 170) * 10;
  if (heightCm < 160) ml -= (160 - heightCm) * 10;
  return Math.max(1200, Math.min(5000, Math.round(ml)));
};

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
  const [goalMl, setGoalMl] = useState(computeGoalMl(70, 170));
  const [intervalMin, setIntervalMin] = useState(120);
  const [remindersOn, setRemindersOn] = useState(true);
  const [busy, setBusy] = useState(false);

  const index = STEPS.indexOf(step);
  const hero = step in HERO;
  const go = (s) => {
    setEditing(null);
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

  // Hazırlanıyor: hedefi hesapla + kaydet, ilerleme çubuğu dolunca hedef ekranına geç
  const loadProg = useSharedValue(0);
  useEffect(() => {
    if (step !== 'loading') return;
    const goal = computeGoalMl(weightKg, heightCm);
    setGoalMl(goal);
    persistProfile(goal);
    loadProg.value = 0;
    loadProg.value = withTiming(1, { duration: reduceMotion ? 900 : 2600, easing: Easing.inOut(Easing.cubic) });
    const timer = setTimeout(() => go('goal'), reduceMotion ? 1100 : 2900);
    return () => clearTimeout(timer);
  }, [step]);
  const loadBar = useAnimatedStyle(() => ({ width: `${loadProg.value * 100}%` }));

  // ---- Gezinme -------------------------------------------------------------------------
  const back = () => {
    if (step === 'goal') return go('rhythm');
    if (step === 'ready') return go(remindersOn ? 'notify' : 'remind');
    if (index > 0) go(STEPS[index - 1]);
  };

  const skip = async () => {
    if (step === 'welcome') return go('units');
    if (['units', 'weight', 'height', 'rhythm'].includes(step)) return go('loading');
    if (step === 'goal') return go('remind');
    if (step === 'remind') return go('notify');
    if (step === 'notify') {
      setRemindersOn(false);
      if (!preview) disableReminders().catch(() => {});
      return go('ready');
    }
  };

  const noReminders = () => {
    setRemindersOn(false);
    if (!preview) disableReminders().catch(() => {});
    go('ready');
  };

  const allowNotifications = async () => {
    if (busy) return;
    setBusy(true);
    let on = true;
    if (!preview) {
      try {
        const n = await scheduleReminders({ wakeAt: toHHMM(wakeAt), sleepAt: toHHMM(sleepAt), intervalHours: intervalMin / 60 });
        on = n >= 0;
      } catch (e) {
        console.warn('Reminder scheduling failed', e);
        on = false;
      }
    }
    setRemindersOn(on);
    setBusy(false);
    go('ready');
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
    welcome: { label: t('onboard.flow.welcome.cta'), onPress: () => go('units') },
    units: { label: t('common.continue'), onPress: () => go('weight') },
    weight: { label: t('common.continue'), onPress: () => go('height') },
    height: { label: t('common.continue'), onPress: () => go('rhythm') },
    rhythm: { label: t('onboard.flow.rhythm.cta'), onPress: () => go('loading') },
    goal: { label: t('onboard.flow.goal.cta'), onPress: () => go('remind') },
    remind: { label: t('onboard.flow.remind.cta'), onPress: () => go('notify') },
    notify: { label: t('onboard.flow.notify.cta'), onPress: allowNotifications },
    ready: { label: t('onboard.flow.ready.cta'), onPress: finish, icon: 'water' },
  }[step];

  // ---- Parçacık sahnesi yerleşimi: üstteki boş alanın ortası ---------------------------
  const stageTop = insets.top + 52;
  const stageBottom = height - 430;
  const stageCy = (stageTop + stageBottom) / 2;
  const stageR = Math.min(width * 0.27, ((stageBottom - stageTop) / 2) * 0.82);
  // ana ekrandaki bardağın yaklaşık merkezi (damla oraya iner)
  const glassY = insets.top + height * 0.3;
  const uiStyle = useAnimatedStyle(() => ({ opacity: uiFade.value }));
  const sceneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: exitP.value * (glassY - stageCy) }, { scale: 1 - exitP.value * 0.5 }],
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: sceneFade.value }));

  const intervalText =
    intervalMin % 60 === 0
      ? t('onboard.flow.everyHour', { n: intervalMin / 60 })
      : t('onboard.flow.everyMin', { n: intervalMin });
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
          scene={HERO[step] ?? SCENE.SCATTER}
          dim={hero ? 0 : 0.6}
          colors={c}
          dark={dark}
          reduceMotion={reduceMotion}
          active={introActive}
          transitionMs={1000}
          entryMs={1600}
        />
      </Animated.View>

      <Animated.View style={[{ flex: 1 }, uiStyle]}>
      {/* üst çubuk */}
      <View style={[styles.topBar, { marginTop: insets.top + 6 }]}>
        <View style={styles.topLeft}>
          {index > 0 && step !== 'loading' && (
            <TouchableOpacity onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('onboard.flow.back')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={c.ink2} />
            </TouchableOpacity>
          )}
          <View style={[styles.logoRing, { borderColor: c.accent }]} />
          <Text style={styles.brand}>{t('onboard.flow.brand')}</Text>
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
          {step !== 'loading' && step !== 'ready' && (
            <TouchableOpacity onPress={skip} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>{t('onboard.flow.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* adım içeriği */}
      <Animated.View
        key={step}
        entering={FadeInDown.duration(420).delay(120)}
        exiting={FadeOut.duration(140)}
        style={[styles.body, hero && styles.heroBody]}
      >
        {step === 'welcome' && (
          <HeroText styles={styles} tag={t('onboard.flow.welcome.tag')} title={t('onboard.flow.welcome.title')} body={t('onboard.flow.welcome.body')} />
        )}

        {step === 'units' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.units.tag')} title={t('onboard.flow.units.title')} body={t('onboard.flow.units.body')} />
            <View style={styles.formArea}>
              <Text style={styles.groupLabel}>{t('onboard.flow.units.weight')}</Text>
              <View style={styles.optRow}>
                <Option styles={styles} c={c} on={weightUnit === 'kg'} title={t('onboard.flow.units.kg')} sub="kg" onPress={() => setWeightUnit('kg')} />
                <Option styles={styles} c={c} on={weightUnit === 'lb'} title={t('onboard.flow.units.lb')} sub="lb" onPress={() => setWeightUnit('lb')} />
              </View>
              <Text style={[styles.groupLabel, { marginTop: 28 }]}>{t('onboard.flow.units.height')}</Text>
              <View style={styles.optRow}>
                <Option styles={styles} c={c} on={heightUnit === 'cm'} title={t('onboard.flow.units.cm')} sub="cm" onPress={() => setHeightUnit('cm')} />
                <Option styles={styles} c={c} on={heightUnit === 'ftin'} title={t('onboard.flow.units.ftin')} sub="ft / in" onPress={() => setHeightUnit('ftin')} />
              </View>
            </View>
          </>
        )}

        {step === 'weight' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.goalStep', { n: 1 })} title={t('onboard.flow.weight.title')} body={t('onboard.flow.weight.body')} />
            <View style={styles.scaleArea}>
              {weightUnit === 'kg' ? (
                <ValueScale value={Math.round(weightKg)} min={35} max={150} onChange={setWeightKg} unit="kg" minLabel="35 kg" maxLabel="150 kg" />
              ) : (
                <ValueScale value={Math.round(weightKg * LB)} min={77} max={330} onChange={(lb) => setWeightKg(lb / LB)} unit="lb" minLabel="77 lb" maxLabel="330 lb" />
              )}
            </View>
            <Text style={[styles.hint, { marginBottom: 20 }]}>{t('onboard.flow.weight.hint')}</Text>
          </>
        )}

        {step === 'height' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.goalStep', { n: 2 })} title={t('onboard.flow.height.title')} body={t('onboard.flow.height.body')} />
            <View style={styles.scaleArea}>
              {heightUnit === 'cm' ? (
                <ValueScale value={heightCm} min={130} max={210} onChange={setHeightCm} unit="cm" minLabel="130 cm" maxLabel="210 cm" />
              ) : (
                <ValueScale
                  value={Math.round(heightCm / 2.54)}
                  min={51}
                  max={83}
                  onChange={(inch) => setHeightCm(Math.round(inch * 2.54))}
                  format={fmtFtIn}
                  minLabel={fmtFtIn(51)}
                  maxLabel={fmtFtIn(83)}
                />
              )}
            </View>
          </>
        )}

        {step === 'rhythm' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.goalStep', { n: 3 })} title={t('onboard.flow.rhythm.title')} body={t('onboard.flow.rhythm.body')} />
            <View style={styles.formArea}>
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
              ) : (
                <Animated.View entering={FadeIn.duration(250)}>
                  <DayArc c={c} width={width - 56} wakeAt={wakeAt} sleepAt={sleepAt} />
                  <Text style={[styles.hint, { marginTop: 26 }]}>{t('onboard.flow.rhythm.note')}</Text>
                </Animated.View>
              )}
            </View>
          </>
        )}

        {step === 'loading' && (
          <>
            <HeroText styles={styles} tag={t('onboard.flow.loading.tag')} title={t('onboard.flow.loading.title')} body={t('onboard.flow.loading.body')} />
            <View style={[styles.loadTrack, { backgroundColor: c.track }]}>
              <Animated.View style={[styles.loadFill, { backgroundColor: c.accent }, loadBar]} />
            </View>
            <View style={{ height: 96 }} />
          </>
        )}

        {step === 'goal' && (
          <>
            <HeroText styles={styles} tag={t('onboard.flow.goal.tag')} title={t('onboard.flow.goal.title')} body={t('onboard.flow.goal.body')} />
            <View style={styles.goalRow}>
              <Text style={[type.display, styles.goalNum, { color: c.accent }]}>{fmtNumber(goalMl)}</Text>
              <Text style={[type.heading, { color: c.ink2, fontSize: 22, marginLeft: 8 }]}>{t('onboard.flow.goal.perDay')}</Text>
            </View>
          </>
        )}

        {step === 'remind' && (
          <View style={styles.remindWrap}>
            <Text style={[styles.overline, { textAlign: 'center' }]}>{upper(t('onboard.flow.remind.tag'))}</Text>
            <Text style={[styles.title, { textAlign: 'center' }]}>{t('onboard.flow.remind.title')}</Text>
            <View style={{ marginTop: 18 }}>
              <IntervalDial minutes={intervalMin} onChange={setIntervalMin} topLabel={t('onboard.flow.remind.dialTop')} subLabel={t('onboard.flow.remind.dialSub')} />
            </View>
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
            <Text style={[type.bodyStrong, { color: c.ink, fontSize: 15, textAlign: 'center', marginTop: 18 }]}>
              {t('onboard.flow.remind.summary', { from: toHHMM(wakeAt), to: toHHMM(sleepAt), count: reminderCount })}
            </Text>
            <Text style={[styles.hint, { textAlign: 'center', marginTop: 4 }]}>{t('onboard.flow.rhythm.note')}</Text>
          </View>
        )}

        {step === 'notify' && (
          <>
            <Header styles={styles} tag={t('onboard.flow.notify.tag')} title={t('onboard.flow.notify.title')} body={t('onboard.flow.notify.body')} />
            <View style={styles.formArea}>
              <View style={[styles.notif, { backgroundColor: c.card, borderColor: c.divider }]}>
                <View style={styles.notifHead}>
                  <View style={[styles.notifIcon, { backgroundColor: c.accent }]}>
                    <Ionicons name="water" size={13} color={c.onAccent} />
                  </View>
                  <Text style={[type.label, { color: c.ink2, flex: 1 }]}>{upper(t('onboard.flow.notify.previewApp'))}</Text>
                  <Text style={[type.label, { color: c.ink3 }]}>{t('onboard.flow.notify.previewNow')}</Text>
                </View>
                <Text style={[type.bodyStrong, { color: c.ink, fontSize: 17, marginTop: 10 }]}>{t('onboard.flow.notify.previewTitle')}</Text>
                <Text style={[type.body, { color: c.ink2, fontSize: 15, marginTop: 4, lineHeight: 21 }]}>{t('onboard.flow.notify.previewBody')}</Text>
              </View>
              <Text style={[styles.hint, { marginTop: 26 }]}>{t('onboard.flow.notify.hint')}</Text>
            </View>
          </>
        )}

        {step === 'ready' && (
          <>
            <HeroText styles={styles} tag={t('onboard.flow.ready.tag')} title={t('onboard.flow.ready.title')} body={t('onboard.flow.ready.body')} />
            <View style={{ marginTop: 18, gap: 8 }}>
              <CheckLine styles={styles} c={c} text={t('onboard.flow.ready.goalLine', { amount: `${fmtNumber(goalMl)} ml` })} />
              {remindersOn && <CheckLine styles={styles} c={c} text={t('onboard.flow.ready.remindLine', { interval: intervalText })} />}
            </View>
          </>
        )}
      </Animated.View>

      {/* alt: ana buton + ilerleme */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        {CTA ? (
          <PrimaryButton styles={styles} c={c} label={CTA.label} icon={CTA.icon} onPress={CTA.onPress} disabled={busy} />
        ) : (
          <View style={{ height: 60 }} />
        )}
        {step === 'remind' ? (
          <TouchableOpacity onPress={noReminders} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={[type.label, { color: c.ink2, fontSize: 14, textDecorationLine: 'underline' }]}>{t('onboard.flow.remind.none')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.secondary} />
        )}
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.seg,
                { backgroundColor: i <= index ? c.accent : c.track, opacity: i < index ? 0.45 : 1 },
                i === index && { height: 4 },
              ]}
            />
          ))}
        </View>
      </View>
      </Animated.View>
    </Animated.View>
  );
}

// ---- Parçalar ----------------------------------------------------------------------------

const Header = ({ styles, tag, title, body }) => (
  <View style={styles.header}>
    <Text style={styles.overline}>{upper(tag)}</Text>
    <Text style={styles.title}>{title}</Text>
    {body ? <Text style={styles.bodyText}>{body}</Text> : null}
  </View>
);

const HeroText = ({ styles, tag, title, body }) => (
  <View>
    <Text style={styles.overline}>{upper(tag)}</Text>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.bodyText}>{body}</Text>
  </View>
);

const Option = ({ styles, c, on, title, sub, onPress }) => (
  <TouchableOpacity
    onPress={() => {
      Haptics.selectionAsync().catch(() => {});
      onPress();
    }}
    activeOpacity={0.85}
    style={[styles.option, { backgroundColor: on ? c.chip : c.card, borderColor: on ? c.accent : c.divider }]}
    accessibilityRole="radio"
    accessibilityState={{ selected: on }}
  >
    <Text style={[styles.optTitle, { color: on ? c.accentInk : c.ink }]}>{title}</Text>
    <Text style={[styles.optSub, { color: c.ink2 }]}>{sub}</Text>
  </TouchableOpacity>
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

// Gün yayı: uyanıştan uykuya; güneş şu anki saatin gün içindeki yerinde durur.
// Uyku saatlerindeyse yayın ortasında soluk bir ay görünür.
function DayArc({ c, width, wakeAt, sleepAt }) {
  const H = 64;
  const y0 = 52;
  const cy = -16;
  const now = new Date();
  const toMin = (d) => d.getHours() * 60 + d.getMinutes();
  const start = toMin(wakeAt);
  let end = toMin(sleepAt);
  if (end <= start) end += 1440;
  let cur = toMin(now);
  if (cur < start) cur += 1440;
  const night = cur > end;
  const f = night ? 0.5 : Math.max(0.06, Math.min(0.94, (cur - start) / (end - start)));
  const orb = night ? '#C9D8EA' : '#F5C77E';
  const sx = (1 - f) * (1 - f) * 0 + 2 * f * (1 - f) * (width / 2) + f * f * width;
  const sy = (1 - f) * (1 - f) * y0 + 2 * f * (1 - f) * cy + f * f * y0;
  return (
    <Svg width={width} height={H} style={{ marginTop: 26 }}>
      <Path d={`M 0 ${y0} Q ${width / 2} ${cy} ${width} ${y0}`} stroke={c.ink3} strokeOpacity={0.6} strokeWidth={1.2} fill="none" />
      <Circle cx={sx} cy={sy} r={18} fill={orb} fillOpacity={0.12} />
      <Circle cx={sx} cy={sy} r={10} fill={orb} />
    </Svg>
  );
}

const CheckLine = ({ styles, c, text }) => (
  <View style={styles.checkLine}>
    <Ionicons name="checkmark" size={20} color={c.accent} />
    <Text style={[styles.hint, { color: c.ink2, marginLeft: 10 }]}>{text}</Text>
  </View>
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
    logoRing: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, marginRight: 10, opacity: 0.8 },
    brand: { ...type.bodyStrong, fontSize: 17, color: c.ink, letterSpacing: 0.2 },
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
    optRow: { flexDirection: 'row', gap: 14 },
    option: { flex: 1, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 20 },
    optTitle: { ...type.bodyStrong, fontSize: 18 },
    optSub: { ...type.body, fontSize: 15, marginTop: 8 },

    scaleArea: { flex: 1, justifyContent: 'center' },

    timeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1.5, padding: 18, paddingLeft: 20, marginBottom: 14 },
    timeTitle: { ...type.bodyStrong, fontSize: 17, color: c.ink },
    timeSub: { ...type.body, fontSize: 14, color: c.ink2, marginTop: 4 },
    timePill: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
    timeValue: { ...type.heading, fontSize: 24, letterSpacing: -0.5 },
    pickerWrap: { alignItems: 'center', marginTop: 4 },

    loadTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 28 },
    loadFill: { height: '100%', borderRadius: 2 },

    goalRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 18 },
    goalNum: { fontSize: 58, lineHeight: 66, letterSpacing: -2.5 },

    remindWrap: { flex: 1, paddingTop: 14 },
    chips: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 5, marginTop: 18 },
    chip: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999 },

    notif: { borderRadius: 24, borderWidth: 1, padding: 20 },
    notifHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    notifIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

    checkLine: { flexDirection: 'row', alignItems: 'center' },

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
    seg: { flex: 1, height: 3, borderRadius: 2 },
  });

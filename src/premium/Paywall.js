import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

import ParticleMorph from '../animation/ParticleMorph';
import { SCENE } from '../animation/particleScenes';
import { upper } from '../utils/format';
import { LanguageContext } from '../i18n';
import { useTheme } from '../theme/theme';
import { PREMIUM_MODE, usePremium } from './PremiumProvider';

// Paywall: uygulamanın her yerinden usePaywall().open() ile açılır.
// Yalnızca gerçekten var olan Premium özellikleri listelenir.

const PaywallContext = createContext({ open: () => {} });
export const usePaywall = () => useContext(PaywallContext);

const legal = Constants.expoConfig?.extra?.legal || {};
const HERO_H = 270;

function PaywallSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useContext(LanguageContext);
  const { c, type, dark } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { plans, purchase, restore, ready } = usePremium();
  const [selected, setSelected] = useState('annual');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setSelected(plans.some((p) => p.kind === 'annual') ? 'annual' : plans[0]?.kind || 'annual');
  }, [visible, plans]);

  const annual = plans.find((p) => p.kind === 'annual');
  const monthly = plans.find((p) => p.kind === 'monthly');
  const plan = plans.find((p) => p.kind === selected);
  // Yıllık planın aylığa göre tasarrufu (her iki fiyat da biliniyorsa)
  const savings = annual && monthly && monthly.price > 0 ? Math.round((1 - annual.price / (monthly.price * 12)) * 100) : 0;

  const benefits = [
    { icon: 'apps-outline', text: t('premium.benefits.widgets') },
    { icon: 'eye-off-outline', text: t('premium.benefits.noAds') },
    { icon: 'medkit-outline', text: t('premium.benefits.meds') },
    { icon: 'notifications-outline', text: t('premium.benefits.taken') },
    { icon: 'calendar-outline', text: t('premium.benefits.week') },
    { icon: 'sparkles-outline', text: t('premium.benefits.future') },
  ];

  const onBuy = async () => {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const res = await purchase(plan);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onClose(true);
      } else if (!res.cancelled) {
        Alert.alert(t('alert.error'), t('premium.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    try {
      const ok = await restore();
      Alert.alert(ok ? t('premium.restoredTitle') : t('premium.notFoundTitle'), ok ? t('premium.restoredMsg') : t('premium.notFoundMsg'));
      if (ok) onClose(true);
    } catch {
      Alert.alert(t('alert.error'), t('premium.failed'));
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = plan?.trialDays ? t('premium.ctaTrial', { days: plan.trialDays }) : t('premium.cta');
  const finePrint = plan
    ? plan.trialDays
      ? t('premium.fineTrial', { days: plan.trialDays, price: plan.priceString, period: t(`premium.per.${plan.kind}`) })
      : t('premium.fine', { price: plan.priceString, period: t(`premium.per.${plan.kind}`) })
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(false)}>
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        {/* parçacıklardan bardak: onboarding ile aynı görsel dil */}
        <View style={styles.hero} pointerEvents="none">
          {visible && (
            <ParticleMorph
              width={width}
              height={HERO_H}
              radius={HERO_H * 0.3}
              centerY={HERO_H * 0.52}
              scene={SCENE.GLASS}
              colors={c}
              dark={dark}
              reduceMotion={reduceMotion}
              count={340}
              entryMs={1300}
            />
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: HERO_H - 30, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <Text style={[type.overline, { color: c.accent, marginBottom: 14 }]}>{upper(t('premium.tag'))}</Text>
          <Text style={[type.title, styles.title, { color: c.ink }]}>{t('premium.heroTitle')}</Text>
          <Text style={[type.body, styles.sub, { color: c.ink2 }]}>{t('premium.subtitle')}</Text>

          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b.icon} style={styles.benefit}>
                <View style={[styles.benefitIcon, { borderColor: c.accent + '55', backgroundColor: c.accent + '14' }]}>
                  <Ionicons name={b.icon} size={17} color={c.accent} />
                </View>
                <Text style={[type.body, { color: c.ink, flex: 1, fontSize: 15, lineHeight: 21 }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          {!ready ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
          ) : plans.length === 0 ? (
            <Text style={[type.label, { color: c.ink2, textAlign: 'center', marginVertical: 20 }]}>{t('premium.unavailable')}</Text>
          ) : (
            <View style={{ gap: 12, marginTop: 26 }}>
              {[annual, monthly].filter(Boolean).map((p) => {
                const on = p.kind === selected;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setSelected(p.kind);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.plan, { backgroundColor: on ? c.chip : c.card, borderColor: on ? c.accent : c.divider }]}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[type.bodyStrong, { color: on ? c.accentInk : c.ink, fontSize: 17 }]}>{t(`premium.plan.${p.kind}`)}</Text>
                        {p.kind === 'annual' && savings > 0 && (
                          <View style={[styles.save, { backgroundColor: c.accent }]}>
                            <Text style={[type.caption, { color: c.onAccent, fontSize: 11 }]}>{t('premium.save', { pct: savings })}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>
                        {p.trialDays ? t('premium.trialThen', { days: p.trialDays, price: p.priceString, period: t(`premium.per.${p.kind}`) }) : `${p.priceString} ${t(`premium.per.${p.kind}`)}`}
                      </Text>
                    </View>
                    <View style={[styles.radio, { borderColor: on ? c.accent : c.ink3 }]}>{on && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}</View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            onPress={onBuy}
            disabled={!plan || busy}
            activeOpacity={0.85}
            style={[styles.cta, { backgroundColor: c.accent, shadowColor: c.accent, opacity: !plan || busy ? 0.6 : 1 }]}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <>
                <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 18, flex: 1 }]} numberOfLines={1}>{ctaLabel}</Text>
                <Ionicons name="arrow-forward" size={24} color={c.onAccent} />
              </>
            )}
          </TouchableOpacity>

          {!!finePrint && <Text style={[type.label, { color: c.ink3, textAlign: 'center', fontSize: 12, lineHeight: 17, marginTop: 14 }]}>{finePrint}</Text>}

          <View style={styles.links}>
            <TouchableOpacity onPress={onRestore} disabled={busy} accessibilityRole="button">
              <Text style={[type.labelStrong, { color: c.accentInk }]}>{t('premium.restore')}</Text>
            </TouchableOpacity>
            {!!legal.termsUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(legal.termsUrl)} accessibilityRole="link">
                <Text style={[type.label, { color: c.ink2 }]}>{t('premium.terms')}</Text>
              </TouchableOpacity>
            )}
            {!!legal.privacyUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(legal.privacyUrl)} accessibilityRole="link">
                <Text style={[type.label, { color: c.ink2 }]}>{t('premium.privacy')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* üst çubuk (kaydırırken de erişilebilir) */}
        <View style={styles.topRow}>
          {PREMIUM_MODE === 'mock' ? (
            <View style={[styles.devChip, { backgroundColor: c.chip }]}>
              <Text style={[type.caption, { color: c.chipInk }]}>{t('premium.devMode')}</Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={() => onClose(false)} hitSlop={10} style={[styles.close, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={20} color={c.ink2} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function PaywallProvider({ children }) {
  const [state, setState] = useState({ visible: false, onDone: null });
  const open = useCallback((onDone) => setState({ visible: true, onDone: onDone || null }), []);
  const close = useCallback(
    (purchased) => {
      const cb = state.onDone;
      setState({ visible: false, onDone: null });
      if (purchased && cb) setTimeout(cb, 400); // sayfa kapanınca kullanıcının istediği işi sürdür
    },
    [state.onDone]
  );
  const value = useMemo(() => ({ open }), [open]);
  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallSheet visible={state.visible} onClose={close} />
    </PaywallContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_H },
  topRow: { position: 'absolute', top: 16, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  devChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, lineHeight: 38, letterSpacing: -1.1 },
  sub: { fontSize: 16, lineHeight: 24, marginTop: 12 },
  benefits: { marginTop: 26, gap: 14 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  save: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cta: {
    marginTop: 22,
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 22, flexWrap: 'wrap', marginTop: 18 },
});

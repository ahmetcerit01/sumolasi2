import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

import Mascot from '../components/Mascot';
import { LanguageContext } from '../i18n';
import { useTheme } from '../theme/theme';
import { PREMIUM_MODE, usePremium } from './PremiumProvider';

// Paywall: uygulamanın her yerinden usePaywall().open() ile açılır.
// Yalnızca gerçekten var olan Premium özellikleri listelenir.

const PaywallContext = createContext({ open: () => {} });
export const usePaywall = () => useContext(PaywallContext);

const legal = Constants.expoConfig?.extra?.legal || {};

function PaywallSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useContext(LanguageContext);
  const { c, type } = useTheme();
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
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 24, gap: 18 }} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            {PREMIUM_MODE === 'mock' ? (
              <View style={[styles.devChip, { backgroundColor: c.chip }]}>
                <Text style={[type.caption, { color: c.chipInk }]}>{t('premium.devMode')}</Text>
              </View>
            ) : (
              <View />
            )}
            <TouchableOpacity onPress={() => onClose(false)} style={[styles.close, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={22} color={c.ink2} />
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center', gap: 8 }}>
            <Mascot mood="celebrate" size={120} />
            <Text style={[type.title, { color: c.ink, textAlign: 'center' }]}>{t('premium.title')}</Text>
            <Text style={[type.body, { color: c.ink2, textAlign: 'center' }]}>{t('premium.subtitle')}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card }]}>
            {benefits.map((b) => (
              <View key={b.icon} style={styles.benefit}>
                <View style={[styles.benefitIcon, { backgroundColor: c.chip }]}>
                  <Ionicons name={b.icon} size={18} color={c.chipInk} />
                </View>
                <Text style={[type.body, { color: c.ink, flex: 1 }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          {!ready ? (
            <ActivityIndicator color={c.accent} />
          ) : plans.length === 0 ? (
            <Text style={[type.label, { color: c.ink2, textAlign: 'center' }]}>{t('premium.unavailable')}</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {[annual, monthly].filter(Boolean).map((p) => {
                const on = p.kind === selected;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setSelected(p.kind);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[styles.plan, { backgroundColor: on ? c.chip : c.card, borderColor: on ? c.accent : c.divider }]}
                  >
                    <View style={[styles.radio, { borderColor: on ? c.accent : c.ink3 }]}>{on && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}</View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.bodyStrong, { color: c.ink }]}>{t(`premium.plan.${p.kind}`)}</Text>
                      <Text style={[type.label, { color: c.ink2 }]}>
                        {p.trialDays ? t('premium.trialThen', { days: p.trialDays, price: p.priceString, period: t(`premium.per.${p.kind}`) }) : `${p.priceString} ${t(`premium.per.${p.kind}`)}`}
                      </Text>
                    </View>
                    {p.kind === 'annual' && savings > 0 && (
                      <View style={[styles.save, { backgroundColor: c.successBg }]}>
                        <Text style={[type.caption, { color: c.successInk }]}>{t('premium.save', { pct: savings })}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            onPress={onBuy}
            disabled={!plan || busy}
            activeOpacity={0.85}
            style={[styles.cta, { backgroundColor: c.accent, opacity: !plan || busy ? 0.6 : 1 }]}
            accessibilityRole="button"
          >
            {busy ? <ActivityIndicator color={c.onAccent} /> : <Text style={[type.heading, { color: c.onAccent, fontSize: 18 }]}>{ctaLabel}</Text>}
          </TouchableOpacity>

          {!!finePrint && <Text style={[type.label, { color: c.ink3, textAlign: 'center', fontSize: 12, lineHeight: 17 }]}>{finePrint}</Text>}

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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  devChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 22, padding: 16, gap: 14 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 2, padding: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  save: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  cta: { borderRadius: 999, paddingVertical: 17, alignItems: 'center', minHeight: 58, justifyContent: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 22, flexWrap: 'wrap' },
});

import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LanguageContext } from '../i18n';
import { useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';
import { useWaterAdd } from '../hooks/useWaterAdd';
import { useQuickAdds } from '../storage/quickAdds';

const PRESETS = [100, 200, 250, 300, 500, 750];
const STEP = 50;
const MIN = 50;
const MAX = 2000;

// Sekme çubuğundaki "+" butonunun açtığı alt sayfa: miktar seç, ekle.
export default function AddSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type } = useTheme();
  const { addWater } = useWaterAdd();
  const [amount, setAmount] = useState(250);
  const quickAdds = useQuickAdds();
  // sabit seçenekler + kullanıcının hızlı ekleme miktarları (ör. 450 ml suluk)
  const presets = [...new Set([...PRESETS, ...quickAdds.map((q) => q.ml)])].sort((a, b) => a - b);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.spring(slide, { toValue: 1, damping: 18, stiffness: 180, mass: 0.9, useNativeDriver: true }).start();
    }
  }, [visible]);

  const close = (after) => {
    Animated.timing(slide, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      onClose?.();
      after?.();
    });
  };

  const change = (delta) => {
    setAmount((a) => Math.min(MAX, Math.max(MIN, a + delta)));
    Haptics.selectionAsync().catch(() => {});
  };

  const confirm = () => close(() => addWater(amount));

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close()} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={() => close()} accessibilityLabel={t('add.cancel')} />
      <Animated.View
        style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20, transform: [{ translateY }] }]}
      >
        <View style={[styles.grabber, { backgroundColor: c.divider }]} />
        <View style={styles.headerRow}>
          <Text style={[type.heading, { color: c.ink, fontSize: 24 }]}>{t('add.title')}</Text>
          <TouchableOpacity onPress={() => close()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('add.cancel')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.stepper, { backgroundColor: c.cardAlt }]}>
          <TouchableOpacity onPress={() => change(-STEP)} style={[styles.stepBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('add.decrease')}>
            <Ionicons name="remove" size={26} color={c.accentInk} />
          </TouchableOpacity>
          <View style={styles.amountRow}>
            <Text style={[type.display, { color: c.ink, fontSize: 54 }]}>{fmtNumber(amount)}</Text>
            <Text style={[type.heading, { color: c.ink2, fontSize: 20 }]}>ml</Text>
          </View>
          <TouchableOpacity onPress={() => change(STEP)} style={[styles.stepBtn, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={t('add.increase')}>
            <Ionicons name="add" size={26} color={c.accentInk} />
          </TouchableOpacity>
        </View>

        <View style={styles.presets}>
          {presets.map((v) => {
            const on = v === amount;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => { setAmount(v); Haptics.selectionAsync().catch(() => {}); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.preset, { borderColor: on ? c.accent : c.divider, backgroundColor: on ? c.chip : c.card }]}
              >
                <Text style={[type.bodyStrong, { color: on ? c.chipInk : c.ink }]}>{`${fmtNumber(v)} ml`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.nowRow}>
          <Ionicons name="time-outline" size={18} color={c.ink2} />
          <Text style={[type.label, { color: c.ink2, fontSize: 14 }]}>{t('add.now')}</Text>
        </View>

        <TouchableOpacity onPress={confirm} activeOpacity={0.85} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
          <Text style={[type.heading, { color: c.onAccent, fontSize: 18 }]}>{t('add.cta', { amount: `${fmtNumber(amount)} ml` })}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, paddingHorizontal: 22, gap: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 24, padding: 14 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 2 },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cta: { borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
});

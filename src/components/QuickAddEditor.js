import React, { useContext, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LanguageContext } from '../i18n';
import { useTheme } from '../theme/theme';
import { fmtNumber } from '../utils/format';
import { DrinkIcon } from './QuickAdd';
import { QUICK_ICONS, QUICK_MAX, QUICK_MIN, updateQuickAdd } from '../storage/quickAdds';

// Profil → Hızlı ekleme: bir butonun simgesini, miktarını ve adını düzenleyen alt sayfa.
const STEP = 25;
const SUGGESTIONS = [150, 250, 330, 450, 500, 750, 1000];

export default function QuickAddEditor({ index, item, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  const { c, type } = useTheme();
  const [icon, setIcon] = useState('cup');
  const [ml, setMl] = useState(200);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!item) return;
    setIcon(item.icon);
    setMl(item.ml);
    setName(item.name);
  }, [item]);

  const change = (d) => {
    setMl((v) => Math.min(QUICK_MAX, Math.max(QUICK_MIN, v + d)));
    Haptics.selectionAsync().catch(() => {});
  };

  const save = async () => {
    await updateQuickAdd(index, { icon, ml, name: name.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.header}>
            <Text style={[type.heading, { color: c.ink }]}>{t('quickAdd.editTitle')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={[type.bodyStrong, { color: c.accentInk }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>

          {/* simge */}
          <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('quickAdd.icon')}</Text>
          <View style={styles.icons}>
            {QUICK_ICONS.map((k) => {
              const on = k === icon;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setIcon(k)}
                  style={[styles.iconBtn, { backgroundColor: on ? c.chip : c.cardAlt, borderColor: on ? c.accent : 'transparent' }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(`quickAdd.icons.${k}`)}
                >
                  <DrinkIcon name={k} color={on ? c.accent : c.ink2} />
                  <Text style={[type.label, { color: on ? c.chipInk : c.ink2, fontSize: 12 }]}>{t(`quickAdd.icons.${k}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* miktar */}
          <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('quickAdd.amount')}</Text>
          <View style={styles.amountRow}>
            <TouchableOpacity onPress={() => change(-STEP)} style={[styles.stepBtn, { backgroundColor: c.cardAlt }]} accessibilityRole="button" accessibilityLabel="-25 ml">
              <Ionicons name="remove" size={24} color={c.accentInk} />
            </TouchableOpacity>
            <View style={styles.amount}>
              <Text style={[type.display, { color: c.ink, fontSize: 44 }]}>{fmtNumber(ml)}</Text>
              <Text style={[type.heading, { color: c.ink2, fontSize: 18 }]}>ml</Text>
            </View>
            <TouchableOpacity onPress={() => change(STEP)} style={[styles.stepBtn, { backgroundColor: c.cardAlt }]} accessibilityRole="button" accessibilityLabel="+25 ml">
              <Ionicons name="add" size={24} color={c.accentInk} />
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {SUGGESTIONS.map((v) => {
              const on = v === ml;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setMl(v)}
                  style={[styles.chip, { backgroundColor: on ? c.chip : c.cardAlt, borderColor: on ? c.accent : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[type.labelStrong, { color: on ? c.chipInk : c.ink2 }]}>{fmtNumber(v)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ad */}
          <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('quickAdd.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t(`quickAdd.icons.${icon}`)}
            placeholderTextColor={c.ink3}
            maxLength={18}
            style={[styles.input, type.bodyStrong, { color: c.ink, backgroundColor: c.cardAlt }]}
            accessibilityLabel={t('quickAdd.name')}
          />

          <TouchableOpacity onPress={save} style={[styles.cta, { backgroundColor: c.accent }]} accessibilityRole="button">
            <Text style={[type.bodyStrong, { color: c.onAccent, fontSize: 17 }]}>{t('quickAdd.save')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 22, gap: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  icons: { flexDirection: 'row', gap: 10 },
  iconBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  cta: { borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
});

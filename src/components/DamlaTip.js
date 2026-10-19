import React, { useContext } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext } from '../i18n';
import { cardShadow, useTheme } from '../theme/theme';
import Mascot from './Mascot';

// Damla'nın konuşma balonu: Siri komutlarını tanıtır.
// Ekranın altında, sekme çubuğunun üstünde belirir; ekranı kapatmaz ve karartmaz.
export default function DamlaTip({ visible, onClose }) {
  const { t } = useContext(LanguageContext);
  const { c, type } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  const app = t('app.name');
  const phrases = [t('tips.siri.phraseAdd', { app }), t('tips.siri.phraseStatus', { app })];

  return (
    <Animated.View
      // yumuşak belirme: zıplama yok, yavaşça görünür ve hafifçe yukarı süzülür
      entering={FadeInDown.duration(750).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(250)}
      style={[styles.wrap, { bottom: insets.bottom + 96 }]}
      pointerEvents="box-none"
    >
      <View style={styles.row} pointerEvents="box-none">
        <Mascot mood="happy" size={78} />
        <View style={[styles.bubble, { backgroundColor: c.card }, cardShadow(c)]}>
          {/* balonun Damla'ya bakan ucu */}
          <View style={[styles.tail, { backgroundColor: c.card }]} />
          <Text style={[type.bodyStrong, { color: c.ink, fontSize: 16 }]}>{t('tips.siri.title')}</Text>
          <Text style={[type.body, { color: c.ink2, fontSize: 14, lineHeight: 20, marginTop: 4 }]}>{t('tips.siri.body')}</Text>
          {phrases.map((p) => (
            <View key={p} style={[styles.phrase, { backgroundColor: c.chip }]}>
              <Ionicons name="mic" size={14} color={c.chipInk} />
              <Text style={[type.labelStrong, { color: c.chipInk, flex: 1 }]}>{p}</Text>
            </View>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => Linking.openURL('shortcuts://').catch(() => {})} hitSlop={8} accessibilityRole="button">
              <Text style={[type.labelStrong, { color: c.ink2 }]}>{t('tips.siri.shortcuts')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={[styles.ok, { backgroundColor: c.accent }]} accessibilityRole="button">
              <Text style={[type.labelStrong, { color: c.onAccent }]}>{t('tips.siri.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubble: { flex: 1, borderRadius: 22, padding: 16, gap: 2, marginBottom: 18 },
  tail: { position: 'absolute', left: -6, bottom: 22, width: 16, height: 16, borderRadius: 3, transform: [{ rotate: '45deg' }] },
  phrase: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  ok: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
});

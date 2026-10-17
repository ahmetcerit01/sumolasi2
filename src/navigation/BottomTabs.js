import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import BadgesScreen from '../screens/BadgesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddSheet from '../components/AddSheet';
import BadgeCelebration from '../components/BadgeCelebration';
import { useLanguage } from '../i18n';
import { useTheme } from '../theme/theme';

const Tab = createBottomTabNavigator();

// Sekme sırası: Ana Sayfa, Geçmiş, [+ su ekle], Rozetler, Profil.
// Hatırlatıcı ayarları artık Profil'in içinde.
const TABS = [
  { name: 'Home', label: 'tabs.home', icon: 'home', iconOff: 'home-outline' },
  { name: 'History', label: 'tabs.history', icon: 'stats-chart', iconOff: 'stats-chart-outline' },
  { name: 'Badges', label: 'tabs.badges', icon: 'ribbon', iconOff: 'ribbon-outline' },
  { name: 'Profile', label: 'tabs.profile', icon: 'person', iconOff: 'person-outline' },
];

function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { c, type } = useTheme();
  const [sheet, setSheet] = useState(false);

  // Kilit ekranındaki canlı etkinliğe dokununca (sumolasi://add) su ekleme sayfası açılır
  useEffect(() => {
    const handle = (url) => {
      if (url && /^sumolasi:\/\/add/.test(url)) {
        navigation.navigate('Home');
        setSheet(true);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const renderTab = (route, index) => {
    const meta = TABS.find((x) => x.name === route.name);
    const focused = state.index === index;
    const color = focused ? c.accent : c.ink2;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={t(meta.label)}
      >
        <Ionicons name={focused ? meta.icon : meta.iconOff} size={24} color={color} />
        <Text numberOfLines={1} style={[type.caption, { fontSize: 11, color, fontFamily: focused ? type.labelStrong.fontFamily : type.label.fontFamily }]}>
          {t(meta.label)}
        </Text>
      </TouchableOpacity>
    );
  };

  const left = state.routes.slice(0, 2).map((r, i) => renderTab(r, i));
  const right = state.routes.slice(2).map((r, i) => renderTab(r, i + 2));

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            bottom: Math.max(insets.bottom - 6, 12),
            backgroundColor: c.tabBg,
            shadowColor: c.shadowColor,
            shadowOpacity: c.shadowOpacity * 1.6,
          },
        ]}
      >
        {left}
        <View style={styles.centerSlot}>
          <TouchableOpacity
            onPress={() => setSheet(true)}
            activeOpacity={0.85}
            style={[styles.plus, { backgroundColor: c.accent, shadowColor: c.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('tabs.add')}
          >
            <Ionicons name="add" size={32} color={c.onAccent} />
          </TouchableOpacity>
        </View>
        {right}
      </View>
      <AddSheet visible={sheet} onClose={() => setSheet(false)} />
      <BadgeCelebration />
    </>
  );
}

export default function BottomTabs() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 72,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  centerSlot: { flex: 1, alignItems: 'center' },
  plus: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

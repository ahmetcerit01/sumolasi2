import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import RemindersScreen from '../screens/RemindersScreen';
import BadgesScreen from '../screens/BadgesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.tabBar],
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen
        name="Ana Sayfa"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              {focused ? (
                <LinearGradient
                  colors={["#7CE8FF", "#4C8CFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.iconCircle, styles.iconCircleActive]}
                >
                  <Ionicons name="home" size={26} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.iconCircleInactive}>
                  <Ionicons name="home" size={26} color="#9CA3AF" />
                </View>
              )}
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>Ana Sayfa</Text>
              {focused && (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={styles.activeUnderline} />
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Geçmiş"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              {focused ? (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={[styles.iconCircle, styles.iconCircleActive]}>
                  <Ionicons name="calendar" size={26} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.iconCircleInactive}>
                  <Ionicons name="calendar" size={26} color="#9CA3AF" />
                </View>
              )}
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>Geçmiş</Text>
              {focused && (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={styles.activeUnderline} />
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Hatırlatıcılar"
        component={RemindersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              {focused ? (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={[styles.iconCircle, styles.iconCircleActive]}>
                  <Ionicons name="alarm" size={26} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.iconCircleInactive}>
                  <Ionicons name="alarm" size={26} color="#9CA3AF" />
                </View>
              )}
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>Hatırlatıcılar</Text>
              {focused && (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={styles.activeUnderline} />
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Rozetler"
        component={BadgesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              {focused ? (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={[styles.iconCircle, styles.iconCircleActive]}>
                  <Ionicons name="ribbon" size={26} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.iconCircleInactive}>
                  <Ionicons name="ribbon" size={26} color="#9CA3AF" />
                </View>
              )}
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>Rozetler</Text>
              {focused && (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={styles.activeUnderline} />
              )}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              {focused ? (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={[styles.iconCircle, styles.iconCircleActive]}>
                  <Ionicons name="person" size={26} color="#fff" />
                </LinearGradient>
              ) : (
                <View style={styles.iconCircleInactive}>
                  <Ionicons name="person" size={26} color="#9CA3AF" />
                </View>
              )}
              <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>Profil</Text>
              {focused && (
                <LinearGradient colors={["#7CE8FF", "#4C8CFF"]} style={styles.activeUnderline} />
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    height: 108,
    borderTopWidth: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 12,
    overflow: 'visible',
  },
  tabBarItem: {
    paddingHorizontal: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },label: {
  fontSize: 10,
  lineHeight: 12,
  marginTop: 4,
  textAlign: 'center',
  maxWidth: 64, // sabit genişlik yerine maksimum genişlik
  flexShrink: 1, // sığmazsa küçültsün
},
iconCircle: {
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: 'center',
  alignItems: 'center',
},
iconCircleActive: {
  width: 46,
  height: 46,
  borderRadius: 23,
  marginTop: 2,
},

  iconCircleInactive: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EEF2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelActive: { color: '#4C8CFF', fontWeight: '600' },
  labelInactive: { color: '#A3AEC2', fontWeight: '500' },
  activeUnderline: {
    width: 32,
    height: 4,
    borderRadius: 4,
    marginTop: 4,
  },
});
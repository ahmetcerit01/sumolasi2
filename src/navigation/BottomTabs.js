import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

// Ekranlarınızı import edin
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import RemindersScreen from '../screens/RemindersScreen';
import BadgesScreen from '../screens/BadgesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Etiketleri manuel yönetiyoruz
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Ana Sayfa"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="home" label="Ana Sayfa" />
          ),
        }}
      />

      <Tab.Screen
        name="Geçmiş"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="calendar" label="Geçmiş" />
          ),
        }}
      />

      <Tab.Screen
        name="Hatırlatıcılar"
        component={RemindersScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="alarm" label="Hatırlatıcılar" />
          ),
        }}
      />

      <Tab.Screen
        name="Rozetler"
        component={BadgesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="ribbon" label="Rozetler" />
          ),
        }}
      />

      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="person" label="Profil" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Tekrar eden kodları önlemek için özel bileşen
const TabIcon = ({ focused, name, label }) => {
  return (
    <View style={styles.tabItem}>
      {/* İKON ALANI */}
      {focused ? (
        <LinearGradient
          colors={['#7CE8FF', '#4C8CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconContainerActive}
        >
          <Ionicons name={name} size={24} color="#fff" />
        </LinearGradient>
      ) : (
        <View style={styles.iconContainerInactive}>
          <Ionicons name={name} size={24} color="#9CA3AF" />
        </View>
      )}

      {/* METİN ALANI - numberOfLines={1} taşmayı engeller */}
      <Text 
        numberOfLines={1} 
        style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
      >
        {label}
      </Text>

      {/* AKTİF ÇİZGİSİ (Opsiyonel, şık durur) */}
      {focused && (
        <LinearGradient 
          colors={['#7CE8FF', '#4C8CFF']} 
          style={styles.activeLine} 
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    height: Platform.OS === 'ios' ? 95 : 80, // iPhone'larda home indicator için daha yüksek
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0,
    // Profesyonel gölge
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
    paddingHorizontal: 5, // Kenarlardan hafif boşluk
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: width / 5, // Ekranı tam 5 parçaya bölerek her tab'a eşit alan verir
    height: '100%',
    top: Platform.OS === 'ios' ? 10 : 0, // İçeriği biraz aşağı it
  },
  iconContainerActive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    // Aktif ikon gölgesi
    shadowColor: '#4C8CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  iconContainerInactive: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11, // Okunabilir ama küçük
    textAlign: 'center',
    width: '100%', // Bulunduğu alanın tamamını kullansın
    paddingHorizontal: 2, // Yanlardan çok az boşluk
  },
  labelActive: {
    color: '#4C8CFF',
    fontWeight: '700',
  },
  labelInactive: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    opacity: 0.8,
  }
});
import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, 
  Dimensions, Animated, Easing, StatusBar 
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

import BadgeIcon from '../components/BadgeIcon';
import { BADGES } from '../constants/badges';
import { useHydrationStore } from '../storage/useHydrationStore';

const { width } = Dimensions.get('window');

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  
  const earnedBadgesMap = useHydrationStore(s => s.badges) || {};
  const currentEarnedIds = Object.keys(earnedBadgesMap);

  const [selectedBadge, setSelectedBadge] = useState(null); 
  const [celebrationBadge, setCelebrationBadge] = useState(null);
  const [sound, setSound] = useState(null);

  const bgAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // --- ROZET TAKİP MANTIĞI ---
  const prevIdsRef = useRef(currentEarnedIds);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevIdsRef.current = currentEarnedIds;
      return;
    }

    const newBadgeId = currentEarnedIds.find(id => !prevIdsRef.current.includes(id));

    if (newBadgeId) {
      const badgeData = BADGES.find(b => b.id === newBadgeId);
      if (badgeData) {
        triggerCelebration(badgeData);
      }
    }

    prevIdsRef.current = currentEarnedIds;
  }, [currentEarnedIds]); 
  // ---------------------------

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();
  }, []);

  const triggerCelebration = async (badge) => {
    setCelebrationBadge(badge);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/success.mp3') 
      );
      setSound(sound);
      await sound.playAsync();
    } catch (e) { }

    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 50,
      useNativeDriver: true
    }).start();
  };

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync(); };
  }, [sound]);

  const bgTopColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F3E5F5', '#E1F5FE'] 
  });

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  const totalBadges = BADGES.length;
  const earnedCount = currentEarnedIds.length;
  const progressPercent = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.9)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Koleksiyon</Text>
          <Text style={styles.subtitle}>Başarılarını tamamla, rozetleri kap!</Text>
        </View>
        
        <View style={styles.progressCard}>
            <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>Rozet Seviyesi</Text>
                <Text style={styles.progressValue}>{earnedCount} / {totalBadges}</Text>
            </View>
            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.motivationText}>
               {progressPercent === 100 ? "Efsanesin! 🏆" : "Yolun başındasın, devam et!"}
            </Text>
        </View>

        <View style={styles.grid}>
          {BADGES.map((badge) => {
            const earnedData = earnedBadgesMap[badge.id];
            const isUnlocked = !!earnedData;
            
            return (
              <TouchableOpacity
                key={badge.id}
                style={styles.badgeWrapper}
                activeOpacity={0.8}
                onPress={() => setSelectedBadge({ ...badge, isUnlocked, earnedData })}
              >
                <View style={[styles.badgeCard, isUnlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
                  <View style={[styles.iconBox, !isUnlocked && { opacity: 0.5, grayscale: 1 }]}>
                    <BadgeIcon 
                      name={badge.icon || badge.id} 
                      size={50} 
                      unlocked={isUnlocked}
                      color={badge.color} 
                    />
                  </View>
                  {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={14} color="#90A4AE" />
                    </View>
                  )}
                  <Text numberOfLines={1} style={[styles.badgeLabel, !isUnlocked && { color: '#90A4AE' }]}>
                    {badge.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* DETAY MODALI */}
      <Modal transparent visible={!!selectedBadge} animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdropTouch} onPress={() => setSelectedBadge(null)} />
          <View style={styles.modalContent}>
            <LinearGradient colors={selectedBadge?.isUnlocked ? ['#E3F2FD', '#FFFFFF'] : ['#FAFAFA', '#FFFFFF']} style={styles.modalGradient}>
              <View style={[styles.bigIconCircle, selectedBadge?.isUnlocked ? styles.circleUnlocked : styles.circleLocked]}>
                  <BadgeIcon name={selectedBadge?.icon || selectedBadge?.id} size={80} unlocked={selectedBadge?.isUnlocked} color={selectedBadge?.color} />
              </View>
              <Text style={styles.modalTitle}>{selectedBadge?.title}</Text>
              {selectedBadge?.isUnlocked ? (
                 <View style={styles.earnedBadge}>
                    <Text style={styles.earnedText}>Kazanıldı</Text>
                    {selectedBadge.earnedData?.earnedDate && <Text style={styles.dateText}>• {formatDate(selectedBadge.earnedData.earnedDate)}</Text>}
                 </View>
              ) : (
                 <View style={styles.lockedBadge}><Text style={styles.lockedText}>KİLİTLİ</Text></View>
              )}
              <Text style={styles.modalDesc}>{selectedBadge?.description}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedBadge(null)}>
                <Text style={styles.closeBtnText}>Tamam</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* 🌟 KUTLAMA MODALI (TEMİZ VERSİYON) 🌟 */}
      <Modal 
        transparent 
        visible={!!celebrationBadge} 
        animationType="fade"
        statusBarTranslucent={true} 
      >
        {/* Arka plan daha karanlık yapıldı: opacity 0.95 */}
        <View style={styles.celebrationOverlay}>
            {celebrationBadge && (
                <ConfettiCannon 
                    count={200} 
                    origin={{ x: width / 2, y: -100 }} 
                    fallSpeed={3000} 
                    fadeOut={true}
                    autoStart={true}
                />
            )}

            <View style={styles.celebrationContent}>
                {/* BURADAKİ "celebrationLight" (BÜYÜK DAİRE) TAMAMEN SİLİNDİ */}
                
                <Text style={styles.celebrationTitle}>TEBRİKLER!</Text>
                <Text style={styles.celebrationSubtitle}>Yeni bir rozet kazandın</Text>

                <Animated.View style={{ transform: [{ scale: scaleAnim }], marginVertical: 40 }}>
                    <View style={[styles.celebrationIconBox, { shadowColor: celebrationBadge?.color || '#FFF' }]}>
                         <BadgeIcon 
                            name={celebrationBadge?.icon || celebrationBadge?.id} 
                            size={150} // İkon boyutu
                            unlocked={true}
                            color={celebrationBadge?.color} 
                        />
                    </View>
                </Animated.View>
                
                <Text style={styles.celebrationBadgeName}>{celebrationBadge?.title}</Text>

                <TouchableOpacity 
                    style={[styles.celebrationBtn, { backgroundColor: celebrationBadge?.color || '#29B6F6' }]} 
                    onPress={() => setCelebrationBadge(null)}
                >
                    <Text style={styles.celebrationBtnText}>Harika!</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  animatedBg: { ...StyleSheet.absoluteFillObject },
  header: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#1A237E', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: '#5C6BC0', marginTop: 4, fontWeight: '500' },
  progressCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 24, borderRadius: 20, padding: 20, shadowColor: '#5C6BC0', shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#546E7A' },
  progressValue: { fontSize: 14, fontWeight: '800', color: '#1976D2' },
  progressBarTrack: { height: 8, backgroundColor: '#E3F2FD', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', backgroundColor: '#29B6F6', borderRadius: 4 },
  motivationText: { fontSize: 12, color: '#78909C', fontStyle: 'italic', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  badgeWrapper: { width: '33.33%', padding: 8, alignItems: 'center' },
  badgeCard: { width: '100%', aspectRatio: 0.9, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, borderWidth: 1 },
  badgeUnlocked: { borderColor: '#E1F5FE', backgroundColor: '#fff' },
  badgeLocked: { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.6)', shadowOpacity: 0 },
  iconBox: { marginBottom: 8 },
  lockOverlay: { position: 'absolute', top: 6, right: 6, backgroundColor: '#ECEFF1', padding: 4, borderRadius: 12 },
  badgeLabel: { fontSize: 11, fontWeight: '700', color: '#374151', textAlign: 'center' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBackdropTouch: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '85%', borderRadius: 32, overflow: 'hidden', elevation: 10 },
  modalGradient: { padding: 24, alignItems: 'center' },
  bigIconCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  circleUnlocked: { backgroundColor: '#fff' },
  circleLocked: { backgroundColor: '#ECEFF1', opacity: 0.8 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A237E', textAlign: 'center', marginBottom: 6 },
  earnedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  earnedText: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginLeft: 4 },
  dateText: { fontSize: 12, color: '#2E7D32', marginLeft: 4 },
  lockedBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  lockedText: { fontSize: 12, fontWeight: '700', color: '#C62828' },
  modalDesc: { fontSize: 15, color: '#546E7A', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  closeBtn: { backgroundColor: '#29B6F6', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, elevation: 4 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // --- KUTLAMA (TEMİZLENDİ) ---
  celebrationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  celebrationContent: { alignItems: 'center', width: '100%', padding: 20, zIndex: 2 },
  celebrationTitle: { fontSize: 36, fontWeight: '900', color: '#FFF', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 },
  celebrationSubtitle: { fontSize: 18, color: '#B3E5FC', marginTop: 5, fontWeight: '600' },
  celebrationIconBox: { 
    alignItems: 'center',
    justifyContent: 'center',
    // Sadece İKON PARLAMASI (Arkada kutu yok)
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.9, 
    shadowRadius: 40, 
  },
  celebrationBadgeName: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 10, marginBottom: 30, textAlign: 'center' },
  celebrationBtn: { paddingHorizontal: 50, paddingVertical: 16, borderRadius: 30, elevation: 10 },
  celebrationBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
});
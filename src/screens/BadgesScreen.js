import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity, 
  Dimensions, Animated, Easing, StatusBar 
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import BadgeIcon from '../components/BadgeIcon';
import { BADGES } from '../constants/badges';
import { useHydrationStore } from '../storage/useHydrationStore';

const { width, height } = Dimensions.get('window');

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const earnedBadgesMap = useHydrationStore(s => s.badges) || {};
  
  const [celebrate, setCelebrate] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const bgAnim = useRef(new Animated.Value(0)).current;
  
  const totalBadges = BADGES.length;
  const earnedCount = Object.keys(earnedBadgesMap).length;
  const progressPercent = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, { toValue: 1, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bgAnim, { toValue: 0, duration: 8000, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    ).start();
  }, []);

  const prevCountRef = useRef(earnedCount);
  useEffect(() => {
    if (earnedCount > prevCountRef.current) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 5000);
    }
    prevCountRef.current = earnedCount;
  }, [earnedCount]);

  const bgTopColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F3E5F5', '#E1F5FE'] 
  });

  const formatDate = (isoString) => {
    if (!isoString || typeof isoString !== 'string') return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent barStyle="dark-content" backgroundColor="transparent" />

      <Animated.View style={[styles.animatedBg, { backgroundColor: bgTopColor }]}>
        <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.9)']} style={StyleSheet.absoluteFill} />
        <View style={[styles.bubble, { top: 50, left: -30, width: 180, height: 180, backgroundColor: '#B3E5FC', opacity: 0.2 }]} />
        <View style={[styles.bubble, { top: height * 0.6, right: -40, width: 220, height: 220, backgroundColor: '#E1BEE7', opacity: 0.15 }]} />
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Koleksiyon</Text>
          <Text style={styles.subtitle}>Başarılarını tamamla, rozetleri kap!</Text>
        </View>
        
        {/* Progress */}
        <View style={styles.progressCard}>
            <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>Rozet Seviyesi</Text>
                <Text style={styles.progressValue}>{earnedCount} / {totalBadges}</Text>
            </View>
            <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.motivationText}>
                {progressPercent === 100 ? "Efsanesin! 🏆" : progressPercent > 50 ? "Harika gidiyorsun!" : "Yolun başındasın, devam et!"}
            </Text>
        </View>

        {/* Grid */}
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
                  <View style={[styles.iconBox, !isUnlocked && { opacity: 0.5 }]}>
                    <BadgeIcon 
                      name={badge.icon || badge.id} 
                      size={50} 
                      unlocked={isUnlocked}
                      color={badge.color} 
                    />
                  </View>
                  {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={16} color="#90A4AE" />
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

      {celebrate && <ConfettiCannon count={200} origin={{ x: width / 2, y: -20 }} autoStart={true} fadeOut={true} />}

      <Modal transparent visible={!!selectedBadge} animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdropTouch} onPress={() => setSelectedBadge(null)} />
          <View style={styles.modalContent}>
            <LinearGradient colors={selectedBadge?.isUnlocked ? ['#E3F2FD', '#FFFFFF'] : ['#FAFAFA', '#FFFFFF']} style={styles.modalGradient}>
              <View style={[styles.bigIconCircle, selectedBadge?.isUnlocked ? styles.circleUnlocked : styles.circleLocked]}>
                  <BadgeIcon 
                    name={selectedBadge?.icon || selectedBadge?.id} 
                    size={80} 
                    unlocked={selectedBadge?.isUnlocked}
                    color={selectedBadge?.color} // Modal içindeki büyük ikona da renk gidiyor
                  />
                  {!selectedBadge?.isUnlocked && (
                     <View style={styles.bigLockIcon}><Ionicons name="lock-closed" size={40} color="rgba(0,0,0,0.2)" /></View>
                  )}
              </View>
              <Text style={styles.modalTitle}>{selectedBadge?.title}</Text>
              {selectedBadge?.isUnlocked ? (
                 <View style={styles.earnedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.earnedText}>Kazanıldı</Text>
                    {typeof selectedBadge.earnedDate === 'string' && <Text style={styles.dateText}>• {formatDate(selectedBadge.earnedDate)}</Text>}
                 </View>
              ) : (
                 <View style={styles.lockedBadge}><Text style={styles.lockedText}>KİLİTLİ</Text></View>
              )}
              <Text style={styles.modalDesc}>{selectedBadge?.description}</Text>
              {!selectedBadge?.isUnlocked && (
                <View style={styles.hintBox}>
                  <Ionicons name="bulb" size={20} color="#00b7ffff" style={{marginRight: 8}} />
                  <Text style={styles.hintText}>{selectedBadge?.howToEarn}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedBadge(null)}>
                <Text style={styles.closeBtnText}>Tamam</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  animatedBg: { ...StyleSheet.absoluteFillObject },
  bubble: { position: 'absolute', borderRadius: 999 },
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
  bigLockIcon: { position: 'absolute' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A237E', textAlign: 'center', marginBottom: 6 },
  earnedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  earnedText: { fontSize: 12, fontWeight: '700', color: '#2E7D32', marginLeft: 4 },
  dateText: { fontSize: 12, color: '#2E7D32', marginLeft: 4 },
  lockedBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  lockedText: { fontSize: 12, fontWeight: '700', color: '#C62828' },
  modalDesc: { fontSize: 15, color: '#546E7A', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  hintBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', padding: 12, borderRadius: 12, marginBottom: 20, width: '100%' },
  hintText: { flex: 1, fontSize: 13, color: '#F57F17', fontWeight: '600' },
  closeBtn: { backgroundColor: '#29B6F6', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, elevation: 4 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});
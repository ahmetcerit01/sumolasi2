import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity, Pressable, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BadgeIcon from '../components/BadgeIcon';
import { BADGES } from '../constants/badges';
import { useHydrationStore } from '../storage/useHydrationStore';
import { Ionicons } from '@expo/vector-icons';

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const badgesState = useHydrationStore(s => s.badges) || {};
  const unlockedBadgeIdsFromStore = useHydrationStore(s => s.unlockedBadgeIds) || [];
  const [celebrateId, setCelebrateId] = React.useState(null);
  const [selectedBadge, setSelectedBadge] = React.useState(null);
  const prevBadgesRef = React.useRef({});
  const mountedRef = React.useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevBadgesRef.current = badgesState || {};
      return;
    }

    const prev = prevBadgesRef.current || {};
    Object.keys(badgesState || {}).forEach((id) => {
      const was = !!prev[id];
      const now = !!badgesState[id];
      if (!was && now && !celebrateId) {
        setCelebrateId(id);
        const title = (Array.isArray(BADGES) ? BADGES.find(b => b.id === id)?.title : id) || id;
        Alert.alert('🎉 Tebrikler!', `${title} rozetini kazandın!`);
      }
    });
    prevBadgesRef.current = badgesState || {};
  }, [badgesState]);

  const data = Array.isArray(BADGES) ? BADGES : [];
  const screenW = Dimensions.get('window').width || 360;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: 60 },
      ]}
    >
      <Text style={styles.title}>Rozetlerim</Text>

      {!data.length && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Hiç rozet tanımlı değil</Text>
          <Text style={styles.emptyText}>src/constants/badges.js içindeki BADGES dizisini ve görsel dosya adlarını kontrol et.</Text>
        </View>
      )}

      <View style={styles.grid}>
        {data.map(badge => {
          const unlocked = !!badgesState[badge.id] || unlockedBadgeIdsFromStore.includes(badge.id);
          return (
            <Pressable
              key={badge.id}
              style={[styles.cell, { opacity: unlocked ? 1 : 0.5 }]}
              onPress={() => setSelectedBadge(badge)}
            >
              <View style={styles.iconWrap}>
                <BadgeIcon name={badge.id} size={80} />
                {!unlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={26} color="#94A3B8" />
                  </View>
                )}
              </View>
              <Text numberOfLines={2} style={[styles.label, !unlocked && styles.locked]}>
                {badge.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {celebrateId && (
        <ConfettiCannon
          count={100}
          origin={{ x: screenW / 2, y: 0 }}
          autoStart={true}
          fadeOut={true}
          explosionSpeed={400}
          onAnimationEnd={() => setCelebrateId(null)}
        />
      )}

      {/* Seçilen rozet için bilgi modalı */}
      <Modal
        transparent
        visible={!!selectedBadge}
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selectedBadge && (
              <>
                <BadgeIcon name={selectedBadge.id} size={140} />
                <Text style={styles.modalTitle}>{selectedBadge.title}</Text>

                {/* Kısa açıklama (varsa) */}
                {selectedBadge.description || selectedBadge.desc ? (
                  <Text style={styles.modalDesc}>
                    {selectedBadge.description || selectedBadge.desc}
                  </Text>
                ) : null}

                {/* YENİ: Nasıl kazanılır? (howToEarn alanını göster) */}
                <View style={styles.howBlock}>
                  <Text style={styles.howLabel}>Nasıl kazanılır?</Text>
                  <Text style={styles.howText}>
                    {selectedBadge.howToEarn || 'Bu rozetin koşulu yakında eklenecek.'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedBadge(null)}>
                  <Text style={styles.modalCloseText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2A44',
    marginBottom: 16,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  cell: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 28,
  },
  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F6FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    textAlign: 'center',
    color: '#1F2A44',
    marginTop: 6,
    fontWeight: '500',
  },
  locked: {
    color: '#9FB6D6',
  },
  emptyBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: '#E3EEFF',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2A44',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#4E6480',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2A44',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#4E6480',
    textAlign: 'center',
    marginBottom: 12,
  },
  howBlock: {
    width: '100%',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2FF',
    marginBottom: 16,
  },
  howLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C8CFF',
    marginBottom: 6,
  },
  howText: {
    fontSize: 14,
    color: '#384152',
    textAlign: 'center',
  },
  modalClose: {
    backgroundColor: '#4C8CFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '600',
  },
});

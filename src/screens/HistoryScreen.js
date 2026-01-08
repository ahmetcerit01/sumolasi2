import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native"; 
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../theme/colors";
import { S } from "../theme/spacing";
import { useHydrationStore } from "../storage/useHydrationStore";
import { LanguageContext } from "../../App";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_HEIGHT = 220;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useContext(LanguageContext);
  
  // Store Verileri
  const weeklyData = useHydrationStore((s) => s.getWeeklyData());
  const currentGoal = useHydrationStore((s) => s.goalMl); 
  
  const [selectedDay, setSelectedDay] = useState(null);
  const [animationKey, setAnimationKey] = useState(0); // Animasyonları tetiklemek için anahtar

  // Sayfa Animasyonu (Fade & Slide)
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- HER EKRAN AÇILDIĞINDA ÇALIŞACAK ---
  useFocusEffect(
    useCallback(() => {
      // 1. Opaklığı sıfırla
      fadeAnim.setValue(0);
      
      // 2. Animasyon anahtarını değiştir (Barları yeniden çizmek için)
      setAnimationKey(prev => prev + 1);

      // 3. Giriş animasyonunu başlat
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
      
    }, []) 
  );

  // --- VERİ TAKİBİ VE GÜNCELLEME (DÜZELTİLDİ) ---
  useEffect(() => {
    if (weeklyData && weeklyData.length > 0) {
      // Listenin son elemanı (Bugün)
      const todayItem = weeklyData[weeklyData.length - 1];

      if (!selectedDay) {
        // 1. Hiç gün seçili değilse (ilk açılış), bugünü seç
        setSelectedDay(todayItem);
      } else {
        // 2. Zaten bir gün seçiliyse, o günün GÜNCEL verisini bul
        // (Böylece geçmişe tıklayınca sayfa yenilense bile o günde kalırsın)
        const updatedSelectedDay = weeklyData.find(d => d.fullDate === selectedDay.fullDate);
        
        if (updatedSelectedDay) {
          // Sadece veri (ml) değiştiyse state güncelle (Gereksiz render önler)
          if (updatedSelectedDay.ml !== selectedDay.ml) {
            setSelectedDay(updatedSelectedDay);
          }
        } else {
          // Eğer seçili gün artık listede yoksa (örn: hafta değişti), bugüne dön
          setSelectedDay(todayItem);
        }
      }
    }
  }, [weeklyData]); // selectedDay'i buraya eklemedik, böylece döngüye girmez

  if (!selectedDay || !weeklyData || weeklyData.length === 0) {
    return <View style={styles.container} />;
  }

  // --- HESAPLAMALAR ---
  const maxIntake = Math.max(...weeklyData.map(d => d.ml || 0));
  const chartScaleMax = Math.max(maxIntake, currentGoal, 2500);
  const targetLinePosition = (currentGoal / chartScaleMax) * CHART_HEIGHT;
  const totalWeekly = weeklyData.reduce((acc, curr) => acc + (curr.ml || 0), 0);
  const avgWeekly = Math.round(totalWeekly / weeklyData.length);
  const bestDay = weeklyData.reduce((prev, current) => 
    ((prev.ml || 0) > (current.ml || 0)) ? prev : current
  , { ml: 0, day: '-' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.headerBg, { height: insets.top + 80 }]}>
        <LinearGradient colors={["#E0F2FE", "#F0F9FF"]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={[styles.headerContent, { marginTop: insets.top + 10 }]}>
          <Text style={styles.headerTitle}>{t('history.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('history.subtitle')}</Text>
        </View>

        {/* ÖZET KARTI (Animasyonlu) */}
        <Animated.View 
          style={[
            styles.summaryCard, 
            { 
              opacity: fadeAnim, 
              transform: [{translateY: fadeAnim.interpolate({inputRange:[0,1], outputRange:[20,0]})}] 
            }
          ]}
        >
          <LinearGradient
            colors={[COLORS.primaryStart, COLORS.primaryEnd]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.summaryLabel}>{t('history.weekTotal')}</Text>
                <Text style={styles.summaryValue}>{(totalWeekly / 1000).toFixed(1)} L</Text>
              </View>
              <View style={styles.summaryIconBox}>
                <Ionicons name="stats-chart" size={24} color="#fff" />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* GRAFİK ALANI */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>{t('history.dailyPerformance')}</Text>
          
          <View style={styles.chartContainer}>
            <View style={[styles.targetLine, { bottom: targetLinePosition }]} />
            <Text style={[styles.targetLabel, { bottom: targetLinePosition + 5 }]}>
              {t('history.goalLabel', { goal: currentGoal })}
            </Text>

            <View style={styles.barsRow}>
              {weeklyData.map((item, index) => {
                const isSelected = selectedDay.fullDate === item.fullDate;
                const heightPercent = Math.min((item.ml || 0) / chartScaleMax, 1);
                const isGoalMet = item.ml >= (item.goal || currentGoal) && item.ml > 0;

                return (
                  <TouchableOpacity 
                    key={index} 
                    activeOpacity={0.8}
                    style={styles.barWrapper}
                    // Tıklanınca state'i güncelle
                    onPress={() => setSelectedDay(item)}
                  >
                    {isSelected && (
                      <Animated.View style={styles.bubble}>
                        <Text style={styles.bubbleText}>{item.ml}</Text>
                        <View style={styles.bubbleArrow} />
                      </Animated.View>
                    )}

                    <Bar 
                      key={`bar-${index}-${animationKey}`} 
                      height={heightPercent * CHART_HEIGHT} 
                      color={isSelected ? COLORS.primaryEnd : "#E0E7FF"}
                      isGoalMet={isGoalMet}
                    />
                    
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* İSTATİSTİKLER GRID (Animasyonlu) */}
        <Animated.View 
          style={[
            styles.statsGrid,
            { 
              opacity: fadeAnim, 
              transform: [{translateY: fadeAnim.interpolate({inputRange:[0,1], outputRange:[40,0]})}] 
            }
          ]}
        >
          <View style={styles.statBox}>
            <View style={[styles.iconCircle, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="water-outline" size={20} color={COLORS.primaryEnd} />
            </View>
            <Text style={styles.statValue}>{avgWeekly} ml</Text>
            <Text style={styles.statLabel}>{t('history.dailyAvg')}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="trophy-outline" size={20} color="#D97706" />
            </View>
            <Text style={styles.statValue}>{bestDay.ml > 0 ? bestDay.day : "-"}</Text>
            <Text style={styles.statLabel}>{t('history.bestDay', { ml: bestDay.ml })}</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.iconCircle, { backgroundColor: selectedDay.ml >= (selectedDay.goal || currentGoal) && selectedDay.ml > 0 ? "#DCFCE7" : "#FEE2E2" }]}>
              <Ionicons 
                name={selectedDay.ml >= (selectedDay.goal || currentGoal) && selectedDay.ml > 0 ? "checkmark-circle-outline" : "close-circle-outline"} 
                size={20} 
                color={selectedDay.ml >= (selectedDay.goal || currentGoal) && selectedDay.ml > 0 ? "#16A34A" : "#DC2626"} 
              />
            </View>
            <Text style={[styles.statValue, { fontSize: 16 }]}>
              {selectedDay.ml === 0
                ? t('history.noData')
                : (selectedDay.ml >= (selectedDay.goal || currentGoal)
                    ? t('history.goalMet')
                    : t('history.belowGoal'))}
            </Text>
            <Text style={styles.statLabel}>{t('history.dayLabel', { day: selectedDay.day })}</Text>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// Animated Bar
const Bar = ({ height, color, isGoalMet }) => {
  const animHeight = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(animHeight, {
      toValue: height || 5,
      friction: 6,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [height]);

  return (
    <View style={styles.barContainer}>
      <View style={styles.barBackground} />
      <Animated.View 
        style={[
          styles.barFill, 
          { 
            height: animHeight, 
            backgroundColor: color,
            shadowColor: isGoalMet ? color : "transparent",
            shadowOpacity: isGoalMet ? 0.5 : 0,
            shadowRadius: 8,
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, zIndex: -1 },
  headerContent: { paddingHorizontal: S.xl, marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#1F2937" },
  headerSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  summaryCard: { marginHorizontal: S.xl, borderRadius: 24, shadowColor: COLORS.primaryEnd, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  cardGradient: { padding: 24, borderRadius: 24 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  summaryValue: { color: "#fff", fontSize: 32, fontWeight: "800" },
  summaryIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  chartSection: { marginTop: 30, paddingHorizontal: S.xl },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937", marginBottom: 20 },
  chartContainer: { height: CHART_HEIGHT + 50, justifyContent: "flex-end" },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: CHART_HEIGHT },
  targetLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#9CA3AF", borderStyle: "dashed", borderWidth: 1, borderColor: "#9CA3AF", opacity: 0.3, zIndex: -1 },
  targetLabel: { position: "absolute", right: 0, fontSize: 10, color: "#9CA3AF", fontWeight: "700", backgroundColor: "#FAFAFA", paddingLeft: 4 },
  barWrapper: { alignItems: "center", width: (SCREEN_WIDTH - 60) / 7 },
  barContainer: { width: 14, height: CHART_HEIGHT, justifyContent: "flex-end", backgroundColor: "rgba(229, 231, 235, 0.3)", borderRadius: 10, overflow: "hidden" },
  barBackground: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#F3F4F6", borderRadius: 10 },
  barFill: { width: "100%", borderRadius: 10 },
  dayText: { marginTop: 12, fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  dayTextSelected: { color: COLORS.primaryEnd, fontWeight: "800" },
  bubble: { position: "absolute", top: -35, backgroundColor: "#1F2937", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: "center", zIndex: 10 },
  bubbleText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  bubbleArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#1F2937", marginTop: -1 },
  statsGrid: { marginTop: 30, paddingHorizontal: S.xl, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statBox: { flexGrow: 1, width: "45%", backgroundColor: "#fff", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#F3F4F6", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1F2937", marginBottom: 2 },
  statLabel: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
});
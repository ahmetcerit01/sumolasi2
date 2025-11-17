import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info } from "lucide-react-native";

// Tema güvenli import (isim/konum şaşsa bile default ver)
import * as THEME from "../theme/colors";
const COLORS = THEME?.COLORS ?? {
  bg: "#F9FBFF",
  text: "#0F172A",
  subtext: "#667085",
  card: "#FFFFFF",
  border: "#EAEFF7",
  shadow: "rgba(16, 24, 40, 0.07)",
  primaryStart: "#7CE8FF",
  primaryEnd: "#4C8CFF",
  accent: "#A2E4F5",
};
const S = THEME?.S ?? { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Store
import { useHydrationStore } from "../storage/useHydrationStore";

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 80;
const BAR_WIDTH = (CHART_WIDTH - 40) / 5;
const MAX_BAR_HEIGHT = 200;

// Tipografi ağırlıkları (iOS hissi)
const titleFontWeight = "800";
const cardTitleFontWeight = "700";
const barValueFontWeight = "700";
const barLabelFontWeight = "600";
const todayLabelFontWeight = "800";
const statLabelFontWeight = "500";
const statValueFontWeight = "700";
const infoTitleFontWeight = "700";
const infoLabelFontWeight = "500";
const infoValueFontWeight = "700";

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

// --- Tarih yardımcıları ---
const pad2 = (n) => (n < 10 ? `0${n}` : String(n));
const yyyymmdd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, delta) => { const x = new Date(d); x.setDate(x.getDate() + delta); return x; };

const HISTORY_KEY = (dateStr) => `HISTORY:${dateStr}`; // ör: HISTORY:2025-11-10

export default function HistoryScreen() {
  const { totalMl, goalMl } = useHydrationStore((s) => ({
    totalMl: s.totalMl,
    goalMl: s.goalMl,
  }));
  const insets = useSafeAreaInsets();

  const [history5, setHistory5] = useState([]); // [{label, value, goal, isToday, date}]

  const loadLast5 = useCallback(async () => {
    const today = new Date();
    const items = [];
    for (let i = 4; i >= 0; i--) {
      const d = addDays(today, -i);
      const dateStr = yyyymmdd(d);
      const isToday = i === 0;
      // Haftanın Türkçe kısaltmaları pazartesiden başlasın
      const dow = d.getDay(); // 0 Pazar … 6 Cumartesi
      const mapIndex = ((dow - 1 + 7) % 7);
      const label = WEEKDAY_LABELS[mapIndex] || "?";

      let stored = 0;
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY(dateStr));
        stored = raw ? Number(raw) : 0;
      } catch {}

      const value = isToday ? totalMl : stored; // bugünse store içeriğini canlı değerden ez
      items.push({ label, value: Math.max(0, value), goal: goalMl, isToday, date: dateStr });
    }
    setHistory5(items);
  }, [totalMl, goalMl]);

  // Bugünün değeri değiştikçe kalıcılaştır (gece 00:00 sonrası geçmişte kalacak)
  useEffect(() => {
    const todayStr = yyyymmdd(new Date());
    AsyncStorage.setItem(HISTORY_KEY(todayStr), String(totalMl)).catch(() => {});
  }, [totalMl]);

  // Ekran odağa geldiğinde ve her dakika bir kez yenile (gün dönüşünü yakalamak için)
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => { if (mounted) await loadLast5(); })();
      const iv = setInterval(() => { loadLast5(); }, 60 * 1000);
      return () => { mounted = false; clearInterval(iv); };
    }, [loadLast5])
  );

  const chartData = history5.length ? history5 : [];
  const maxValue = useMemo(() => Math.max(...(chartData.length ? chartData.map(d => Math.max(d.value, d.goal)) : [1]), 1), [chartData]);
  const average = useMemo(() => chartData.length ? Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length) : 0, [chartData]);

  return (
    <LinearGradient
      colors={[COLORS.primaryStart, COLORS.primaryEnd]}
      style={styles.gradient}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.title}>Geçmiş 💧</Text>
        </View>

        {/* Kart: Son 5 Gün */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Son 5 Gün</Text>
            <TouchableOpacity style={styles.infoButton} activeOpacity={0.7}>
              <Info size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Grafik */}
          <View style={styles.chartContainer}>
            {/* Üst boş alan — ekranda ilk kartın üstü temiz kalsın */}
            <View style={styles.chartTopSpacer} />

            <View style={styles.chart}>
              {chartData.map((item, index) => {
                const isToday = item.isToday;
                const barHeight = Math.max(
                  10,
                  (item.value / maxValue) * MAX_BAR_HEIGHT
                );

                return (
                  <TouchableOpacity key={index} style={styles.barWrapper} activeOpacity={0.8} onPress={() => {
                    Alert.alert(
                      `${item.label} Günü`,
                      `${Math.round(item.value)} ml içildi.`
                    );
                  }}>
                    {/* Bugün: dikey yüksek bar / Diğer günler: yatay hap bar */}
                    {isToday ? (
                      <View style={[styles.todayBarContainer, { height: MAX_BAR_HEIGHT }]}>
                        <LinearGradient
                          colors={[COLORS.accent, COLORS.primaryEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={[styles.todayBar, { height: barHeight, justifyContent:'center' }]}
                        >
                          <Text style={styles.barValue}>{Math.round(item.value)}</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View style={[styles.todayBarContainer, { height: MAX_BAR_HEIGHT }]}>
                        <LinearGradient
                          colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={[
                            styles.todayBar,
                            {
                              height: barHeight,
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Text style={styles.barValue}>{Math.round(item.value)}</Text>
                        </LinearGradient>
                      </View>
                    )}

                    {/* Gün etiketi */}
                    <Text
                      style={[
                        styles.barLabel,
                        isToday && styles.todayLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Alt çizgi (divider) */}
            <View style={styles.chartDivider} />

            {/* Ortalama */}
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <Text style={styles.statSubLabel}>Ortalama</Text>
              <Text style={styles.statBigValue}>{average} ml / gün</Text>
            </View>
          </View>
        </View>

        {/* Kart: Haftalık Özet */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Haftalık Özet</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bugün</Text>
            <Text style={styles.infoValue}>{totalMl} ml</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Günlük Hedef</Text>
            <Text style={styles.infoValue}>{goalMl} ml</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Ortalama</Text>
            <Text style={styles.infoValue}>{average} ml</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  content: { padding: S.xl, paddingBottom: 120 },

  header: { marginBottom: S.xl },
  title: { fontSize: 32, fontWeight: titleFontWeight, color: "#FFF" },

  // Kartlar
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: cardTitleFontWeight,
    color: COLORS.text,
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Grafik
  chartContainer: { marginTop: 8, marginBottom: 8 },
  chartTopSpacer: { height: 8 },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: MAX_BAR_HEIGHT + 40,
    paddingHorizontal: 8,
  },
  barWrapper: { alignItems: "center", flex: 1 },

  // Bugün barı (dikey uzun)
  todayBarContainer: {
    width: BAR_WIDTH,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  todayBar: {
    width: BAR_WIDTH - 6,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primaryEnd,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },

  barValue: {
    fontSize: 13,
    fontWeight: barValueFontWeight,
    color: '#FFFFFF',
  },
  barLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: barLabelFontWeight,
    color: "#9AA3AF",
  },
  todayLabel: {
    color: COLORS.primaryEnd,
    fontWeight: todayLabelFontWeight,
  },

  chartDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 8,
  },

  statSubLabel: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: statLabelFontWeight,
  },
  statBigValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: statValueFontWeight,
    color: COLORS.primaryEnd,
  },

  // Haftalık özet kartı
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 28,
    padding: 20,
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: infoTitleFontWeight,
    color: COLORS.text,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: infoLabelFontWeight,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: infoValueFontWeight,
    color: COLORS.text,
  },
});

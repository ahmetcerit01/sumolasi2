import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
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

export default function HistoryScreen() {
  const { totalMl, goalMl } = useHydrationStore((s) => ({
    totalMl: s.totalMl,
    goalMl: s.goalMl,
  }));
  const insets = useSafeAreaInsets();

  // Şimdilik sadece bugünün değeri mevcut: geçmiş 4 güne 0 veriyoruz.
  const getLast5Days = () => {
    const today = new Date();
    const last5 = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const isToday = i === 0;
      const dow = d.getDay(); // 0 Pazar…6 Cumartesi
      // Haftanın Türkçe kısaltmaları pazartesiden başlasın diye map’liyoruz:
      const mapIndex = ((dow - 1 + 7) % 7); // Pazartesi=0
      last5.push({
        label: WEEKDAY_LABELS[mapIndex] || "?",
        value: isToday ? totalMl : 0,
        goal: goalMl,
        isToday,
      });
    }
    return last5;
  };

  const chartData = getLast5Days();
  const maxValue = Math.max(
    ...chartData.map((d) => Math.max(d.value, d.goal)),
    1
  );
  const average = Math.round(
    chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length
  );

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
                  <View key={index} style={styles.barWrapper}>
                    {/* Bugün: dikey yüksek bar / Diğer günler: yatay hap bar */}
                    {isToday ? (
                      <View style={[styles.todayBarContainer, { height: MAX_BAR_HEIGHT }]}>
                        <LinearGradient
                          colors={[COLORS.accent, COLORS.primaryEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={[styles.todayBar, { height: barHeight }]}
                        >
                          <Text style={styles.barValue}>{Math.round(item.value)}</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View style={styles.pillBarBox}>
                        <LinearGradient
                          colors={[COLORS.primaryStart, COLORS.primaryEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.pillBar}
                        />
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
                  </View>
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

  // Diğer günler: yatay hap görünümü
  pillBarBox: {
    width: BAR_WIDTH,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillBar: {
    width: BAR_WIDTH - 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#E6F7FF",
  },

  barValue: {
    fontSize: 12,
    fontWeight: barValueFontWeight,
    color: "#FFF",
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

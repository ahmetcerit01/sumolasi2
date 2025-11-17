import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  Easing,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import WaterGlass from "../components/WaterGlass";
import { useHydrationStore } from "../storage/useHydrationStore";
import { COLORS } from "../theme/colors";
import { S } from "../theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import subardagi from "../../assets/subardagi.png";
import susisesi from "../../assets/susisesi.png";
import fincan from "../../assets/fincan.png";

const HEADER_H = 120;

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const totalMl = useHydrationStore((s) => s.totalMl);
  const goalMl = useHydrationStore((s) => s.goalMl);
  const add = useHydrationStore((s) => s.add);
  const resetToday = useHydrationStore((s) => s.resetToday);
  const resetAll = useHydrationStore((s) => s.resetAll);
  const safeGoal = goalMl || 2000;
  const pctText = Math.round(Math.min((totalMl / Math.max(safeGoal, 1)) * 100, 100));
  const soundRef = React.useRef(null);
  const { streakDays } = useHydrationStore((s) => ({ streakDays: s.streakDays }));

  // --- Wave & Fill Animations ---
  const waveAnim = React.useRef(new Animated.Value(0)).current;
  const fillHeight = React.useRef(new Animated.Value(0)).current;
  const glassHeightRef = React.useRef(0);
  const waveYAnim = React.useRef(new Animated.Value(0)).current;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ratio = clamp01(totalMl / Math.max(safeGoal, 1));

  // preload water sound
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/water.mp3"),
          { shouldPlay: false }
        );
        if (mounted) {
          soundRef.current = sound;
          await soundRef.current.setVolumeAsync(1.0);
        } else {
          await sound.unloadAsync();
        }
      } catch (e) {
        console.warn("[AudioInit]", e?.message || e);
      }
    })();
    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // looping waves
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [waveAnim]);

  // vertical bob
  React.useEffect(() => {
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(waveYAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(waveYAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loopY.start();
    return () => loopY.stop();
  }, [waveYAnim]);

  // fill height
  React.useEffect(() => {
    const h = glassHeightRef.current || 0;
    const target = h * ratio;
    Animated.timing(fillHeight, {
      toValue: target,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, fillHeight]);

  const playWaterSound = async () => {
    try {
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      } else {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/water.mp3"),
          { shouldPlay: true }
        );
        await sound.playAsync();
        setTimeout(() => sound.unloadAsync(), 1500);
      }
    } catch (error) {
      console.warn("Sound playback failed:", error?.message || error);
    }
  };

  // --- Quick Add basış animasyonu (scale) ---
  const scaleCup    = React.useRef(new Animated.Value(1)).current;   // Bardak
  const scaleMug    = React.useRef(new Animated.Value(1)).current;   // Fincan
  const scaleBottle = React.useRef(new Animated.Value(1)).current;   // Şişe

  const pressIn = (val) => {
    Animated.spring(val, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = (val) => {
    Animated.spring(val, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const quickAdd = async (ml) => {
    // Store + ses
    add(ml);
    playWaterSound();
    // Gün geçmişi sistemi için bugünkü değeri AsyncStorage'a yaz
    try {
      const newVal = totalMl + ml; // store'daki güncel değeri baz alıyoruz
      await AsyncStorage.setItem("TODAY_CONSUMED_ML", String(newVal));
    } catch (e) {
      console.warn("Günlük miktar kaydedilemedi", e);
    }
  };

  const askNotifAndTest = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const req = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        });
        finalStatus = req.status;
      }
      if (finalStatus !== "granted") return;
      await Notifications.scheduleNotificationAsync({
        content: { title: "💧 Su Molası", body: "Bir bardak su içme zamanı!", sound: "default" },
        trigger: Platform.OS === "android" ? { seconds: 5, channelId: "water-reminders" } : { seconds: 5 },
      });
    } catch (e) {
      console.warn("[NotifTest]", e?.message || e);
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? "Günaydın" :
    hour >= 12 && hour < 21 ? "İyi günler" : "İyi geceler";
  const greetingIcon =
    hour >= 5 && hour < 12 ? "sunny-outline" :
    hour >= 12 && hour < 21 ? "partly-sunny-outline" : "moon-outline";

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* bounce boşluğunu kapatan ekstra gradyan */}
      <LinearGradient
        pointerEvents="none"
        colors={[COLORS.primaryStart, COLORS.primaryEnd]}
        style={[styles.topBleed, { height: insets.top + HEADER_H + 80 }]}
      />

      <Animated.ScrollView
        bounces
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
      >
        {/* Header */}
        <LinearGradient
          colors={[COLORS.primaryStart, COLORS.primaryEnd]}
          style={[styles.header, { paddingTop: S.xl + insets.top }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name={greetingIcon} size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.greet}>{greeting}</Text>
          </View>
        </LinearGradient>

        {/* Kart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.droplet}>
              <Ionicons name="water" size={18} color={COLORS.primaryEnd} />
            </View>
            <Text style={styles.cardTitle}>Bugün içtiğin su</Text>
          </View>

          <Text style={styles.amount}>
            <Text style={{ fontWeight: "800", fontSize: 32, color: "#111827" }}>
              {totalMl}
            </Text>
            <Text style={{ color: "#6B7280", fontWeight: "700" }}> / {safeGoal} ml</Text>
          </Text>

          <View
            style={styles.glassWrap}
            onLayout={(e) => { glassHeightRef.current = e.nativeEvent.layout.height; }}
          >
            <WaterGlass totalMl={totalMl} goalMl={safeGoal} />

            <Animated.View pointerEvents="none" style={[styles.overlayClip, { height: fillHeight }]}>
              <LinearGradient
                colors={["rgba(122,215,240,0.25)", "rgba(80,129,229,0.25)"]}
                start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.surfaceWrap,
                  {
                    transform: [
                      { translateY: waveYAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) },
                    ],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.wave,
                    {
                      top: 0,
                      transform: [{ translateX: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) }],
                      opacity: 0.6,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.wave,
                    {
                      top: 6,
                      transform: [{ translateX: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, -120] }) }],
                      opacity: 0.35,
                    },
                  ]}
                />
              </Animated.View>
            </Animated.View>
          </View>

          {/* Günlük hedef % | Seri */}
          <View style={styles.rowBoxes}>
            <View style={styles.goalBox}>
              <Text style={styles.boxTitle}>Günlük hedefin</Text>
              <Text style={styles.boxValue}>%{pctText}</Text>
            </View>
            <View style={styles.streakBox}>
              <Text style={styles.boxTitle}>Seri</Text>
              <View style={styles.streakBoxRow}>
                <Ionicons name="flame" size={16} color={COLORS.primaryEnd} style={{ marginRight: 6 }} />
                <Text style={styles.streakBoxNumber}>{streakDays}</Text>
                <Text style={styles.boxUnit}>gün</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Hızlı Ekle */}
        <View style={styles.quickAddWrap}>

          {/* Bardak */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={() => pressIn(scaleCup)}
            onPressOut={() => pressOut(scaleCup)}
            onPress={() => quickAdd(200)}
            style={{ flex: 1 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleCup }] }}>
              <LinearGradient colors={["#4dc7d9", "#66a6ff"]} style={styles.quickBtn}>
                <View style={styles.quickIconWrapper}>
                  <Image source={subardagi} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                </View>
                <View style={styles.quickTextWrap}>
                  <Text style={styles.quickBtnText}>Bardak</Text>
                  <Text style={styles.quickBtnSub}>200 ml</Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          {/* Fincan */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={() => pressIn(scaleMug)}
            onPressOut={() => pressOut(scaleMug)}
            onPress={() => quickAdd(300)}
            style={{ flex: 1 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleMug }] }}>
              <LinearGradient colors={["#4dc7d9", "#66a6ff"]} style={styles.quickBtn}>
                <View style={styles.quickIconWrapper}>
                  <Image source={fincan} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                </View>
                <View style={styles.quickTextWrap}>
                  <Text style={styles.quickBtnText}>Fincan</Text>
                  <Text style={styles.quickBtnSub}>300 ml</Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          {/* Şişe */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPressIn={() => pressIn(scaleBottle)}
            onPressOut={() => pressOut(scaleBottle)}
            onPress={() => quickAdd(500)}
            style={{ flex: 1 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleBottle }] }}>
              <LinearGradient colors={["#4dc7d9", "#66a6ff"]} style={styles.quickBtn}>
                <View style={styles.quickIconWrapper}>
                  <Image source={susisesi} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                </View>
                <View style={styles.quickTextWrap}>
                  <Text style={styles.quickBtnText}>0.5 L Şişe</Text>
                  <Text style={styles.quickBtnSub}>500 ml</Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

        </View>

        {/* Motivasyon */}
        <View style={styles.motivation}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.motivationTitle}>Harika gidiyorsun!</Text>
            <Ionicons name="water" size={18} color={COLORS.primaryEnd} style={{ marginLeft: 6 }} />
          </View>
          <Text style={styles.motivationSub}>Günün %{pctText}'ını tamamladın.</Text>
          <Text style={styles.motivationSub}>
            {new Date().toLocaleDateString("tr-TR")} • Hedef: {safeGoal} ml
          </Text>
        </View>

        {/* Aksiyonlar */}
        <View style={styles.actionsWrap}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => navigation.navigate("Hatırlatıcılar")}
            >
              <Ionicons name="alarm-outline" size={18} color={COLORS.primaryEnd} />
              <Text style={styles.secondaryTxt}>Hatırlatıcı</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondary}
              disabled={totalMl < safeGoal}
              onPress={resetToday}
            >
              <Ionicons name="refresh-outline" size={18} color={totalMl < safeGoal ? "#9CA3AF" : "#111827"} />
              <Text style={[styles.secondaryTxt, { color: totalMl < safeGoal ? "#9CA3AF" : "#111827" }]}>
                Bugünü Sıfırla
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.danger}
              onPress={() => {
                resetAll();
                Alert.alert("Sıfırlandı", "Tüm ilerleme, rozetler ve hedefler sıfırlandı.");
              }}
            >
              <Text style={styles.dangerTxt}>Tümünü Sıfırla (Test)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.secondary} onPress={askNotifAndTest}>
              <Text style={styles.secondaryTxt}>Test Bildirimi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  topBleed: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  header: {
    paddingHorizontal: S.xl,
    paddingBottom: S.xl + 12,
    minHeight: HEADER_H,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greet: { color: "#fff", fontSize: 22, fontWeight: "800" },

  card: {
    marginHorizontal: S.xl,
    marginTop: -24,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: S.xl,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  droplet: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#E6F6FF", alignItems: "center", justifyContent: "center",
  },
  cardTitle: { color: COLORS.subtext, fontSize: 14, fontWeight: "700" },
  amount: { marginTop: 4 },

  glassWrap: {
    alignItems: "center",
    marginTop: S.md,
    position: "relative",
    alignSelf: "center",
  },
  overlayClip: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    overflow: "hidden",
    borderRadius: 16,
  },
  surfaceWrap: { position: "absolute", top: 0, left: 0, right: 0, height: 24 },
  wave: {
    position: "absolute", left: 0, right: 0, top: 0, height: 24,
    backgroundColor: "rgba(255,255,255,0.35)", borderRadius: 50,
    shadowColor: "#ffffff", shadowOpacity: 0.3, shadowRadius: 20,
  },

  /* Günlük hedef & Seri */
  rowBoxes: {
    marginTop: S.lg,
    flexDirection: "row",
    alignItems: "stretch",
    gap: S.lg,
  },
  goalBox: {
    flex: 1, backgroundColor: "#F7FAFF",
    borderWidth: 1, borderColor: "#E6EEF9",
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    justifyContent: "center",
  },
  streakBox: {
    flex: 1, backgroundColor: "#F7FAFF",
    borderWidth: 1, borderColor: "#E6EEF9",
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    justifyContent: "center",
  },
  boxTitle: { color: COLORS.subtext, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  boxValue: { color: COLORS.primaryEnd, fontSize: 22, fontWeight: "800", lineHeight: 24 },
  streakBoxRow: { flexDirection: "row", alignItems: "flex-end" },
  streakBoxNumber: { color: COLORS.text, fontSize: 22, fontWeight: "800", lineHeight: 24, marginRight: 6 },
  boxUnit: { color: COLORS.subtext, fontSize: 13, fontWeight: "600", marginBottom: 1 },

  /* Hızlı Ekle */
  quickAddWrap: {
    marginHorizontal: S.xl,
    marginTop: S.lg,
    flexDirection: "row",
    gap: S.lg,
  },
  quickBtn: {
    borderRadius: 25,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 2,
    gap: 8,
  },
  quickBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, lineHeight: 16 },
  quickBtnSub: { color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 12, lineHeight: 14 },

  quickIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTextWrap: { marginLeft: 4 },

  /* Motivasyon */
  motivation: {
    marginHorizontal: S.xl,
    marginTop: S.xl,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: S.lg,
  },
  motivationTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginBottom: 2 },
  motivationSub: { color: COLORS.subtext, marginTop: 2 },

  /* Aksiyonlar */
  actionsWrap: { marginHorizontal: S.xl, marginTop: S.lg, gap: S.md },
  actionsRow: { flexDirection: "row", gap: S.lg, alignItems: "center" },
  secondary: {
    flex: 1, borderWidth: 2, borderColor: "#BFD8FF",
    borderRadius: 16, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, flexDirection: "row", gap: 8,
  },
  secondaryTxt: { color: COLORS.primaryEnd, fontWeight: "800" },
  danger: {
    flex: 1, borderWidth: 2, borderColor: "#DC2626",
    borderRadius: 16, alignItems: "center", justifyContent: "center",
    paddingVertical: 16,
  },
  dangerTxt: { color: "#DC2626", fontWeight: "800" },
});
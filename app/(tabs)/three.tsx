import React, { useMemo } from "react";
import { StyleSheet, View, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useCalendar, DotColor } from "@/context/CalendarContext";
import DonutChart from "@/components/DonutChart";
import { useAppTheme } from "@/context/ThemeContext";

/** Einheitliche Mood-Farben (hex) */
const MOOD = {
  blue: "#00b4d8",    // great
  green: "#7bd23c",   // nice
  yellow: "#f1c40f",  // okay
  orange: "#e67e22",  // bad
  red: "#e74c3c",     // very bad
};

type MoodLabel = "great" | "nice" | "okay" | "bad" | "very bad";

/** Mapping von gespeicherten Token-Farben → Labels */
const colorToDefaultLabel = (c: DotColor): MoodLabel | null => {
  switch (c) {
    case "blue": return "great";
    case "green": return "nice";
    case "yellow": return "okay";
    case "orange": return "bad";
    case "red": return "very bad";
    default: return null;
  }
};

/** Verträgt v1 (string) & v2 (objekt) Einträge */
const getLabelFromEntry = (entry: any): MoodLabel | null => {
  if (!entry) return null;
  if (typeof entry === "string") return colorToDefaultLabel(entry as DotColor);
  if (typeof entry === "object") {
    const lbl = entry.label as MoodLabel | undefined;
    if (lbl && ["great", "nice", "okay", "bad", "very bad"].includes(lbl)) return lbl;
    if (typeof entry.color === "string") return colorToDefaultLabel(entry.color as DotColor);
  }
  return null;
};

type Counts = Record<MoodLabel, number> & { total: number };
const emptyCounts: Counts = { great: 0, nice: 0, okay: 0, bad: 0, "very bad": 0, total: 0 };

const countAll = (data: Record<string, any>): Counts => {
  const c: Counts = { ...emptyCounts };
  for (const entry of Object.values(data)) {
    const lbl = getLabelFromEntry(entry);
    if (lbl) { c[lbl] += 1; c.total += 1; }
  }
  return c;
};

const countYear = (data: Record<string, any>, year: number): Counts => {
  const c: Counts = { ...emptyCounts };
  for (const [iso, entry] of Object.entries(data)) {
    const y = Number(iso.slice(0, 4));
    if (y !== year) continue;
    const lbl = getLabelFromEntry(entry);
    if (lbl) { c[lbl] += 1; c.total += 1; }
  }
  return c;
};

/* ---------- kleine Datums-Utils für Streaks ---------- */
const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, delta: number) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + delta);
  return nd;
};

/* ---------- UI-Bausteine ---------- */
const ProgressRow: React.FC<{
  label: string; value: number; barColor: string; trackColor: string; labelColor: string;
}> = ({ label, value, barColor, trackColor, labelColor }) => {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
};

const LegendRow: React.FC<{ color: string; label: string; pct: number; textColor: string }> =
({ color, label, pct, textColor }) => (
  <View style={styles.legendRow}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
    <Text style={[styles.legendPct, { color: textColor }]}>{`${Math.round(pct * 100)} %`}</Text>
  </View>
);

export default function OverviewScreen() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360 || height < 650; 

  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];
  const { savedData } = useCalendar();
  const curYear = new Date().getFullYear();

  /* Theme-abhängige Card-Palette */
  const palette = useMemo(() => {
    if (colorScheme === "dark") {
      return {
        cardBg: "#171717",
        cardBorder: "#2a2a2a",
        topHairline: "rgba(255,255,255,0.06)",
        track: "#262626",
        textPrimary: C.text,
        textSecondary: "rgba(241,241,241,0.7)",
      };
    }
    return {
      cardBg: "#ffffff",
      cardBorder: "#e6e6e6",
      topHairline: "rgba(0,0,0,0.04)",
      track: "#eeeeee",
      textPrimary: C.text,
      textSecondary: "#555555",
    };
  }, [colorScheme, C.text]);

  /* Counts & Prozente */
  const { yearPct, allPct, allCounts } = useMemo(() => {
    const y = countYear(savedData, curYear);
    const a = countAll(savedData);
    const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
    return {
      yearPct: {
        great: safe(y.great, y.total),
        nice: safe(y.nice, y.total),
        okay: safe(y.okay, y.total),
        bad: safe(y.bad, y.total),
        veryBad: safe(y["very bad"], y.total),
      },
      allPct: {
        great: safe(a.great, a.total),
        nice: safe(a.nice, a.total),
        okay: safe(a.okay, a.total),
        bad: safe(a.bad, a.total),
        veryBad: safe(a["very bad"], a.total),
      },
      allCounts: a,
    };
  }, [savedData, curYear]);

  /* Donut-Daten */
  const donutSlices = useMemo(
    () => [
      { value: allCounts.great,        color: MOOD.blue },
      { value: allCounts.nice,         color: MOOD.green },
      { value: allCounts.okay,         color: MOOD.yellow },
      { value: allCounts.bad,          color: MOOD.orange },
      { value: allCounts["very bad"],  color: MOOD.red },
    ],
    [allCounts]
  );

  /* ---------- Streak-Berechnung ---------- */
  const { currentStreak, bestStreak } = useMemo(() => {
    const active = new Set(
      Object.entries(savedData)
        .filter(([, v]) => typeof v === "string" && (v as DotColor) !== "gray")
        .map(([k]) => k)
    );

    let cur = 0;
    let day = new Date(); 
    while (active.has(fmtISO(day))) {
      cur += 1;
      day = addDays(day, -1);
    }

    const dates = Array.from(active).sort(); 
    let best = 0;
    let run = 0;
    let prev: Date | null = null;

    for (const iso of dates) {
      const d = new Date(iso + "T00:00:00");
      if (prev && fmtISO(addDays(prev, 1)) === fmtISO(d)) {
        run += 1;
      } else {
        run = 1;
      }
      best = Math.max(best, run);
      prev = d;
    }

    return { currentStreak: cur, bestStreak: best };
  }, [savedData]);

  const donutSize = isSmall ? 110 : 140;
  const donutThickness = isSmall ? 12 : 14;

  return (
    <View style={[styles.screen, { backgroundColor: C.pagebackground }]}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeHeader}>
        <Text style={[styles.title, { color: C.text }]}>Overview</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Card 1: Streaks */}
        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Streaks</Text>

          <View style={styles.streakRow}>
            <View style={[styles.streakBox, { borderColor: "#36c15c" }]}>
              <Text style={[styles.streakLabel, { color: palette.textSecondary }]}>Current streak</Text>
              <Text style={[styles.streakValue, { color: palette.textPrimary }]}>{currentStreak}</Text>
              <Text style={[styles.streakSuffix, { color: palette.textSecondary }]}>day{currentStreak === 1 ? "" : "s"}</Text>
            </View>

            <View style={[styles.streakBox, { borderColor: "#ffd700" }]}>
              <Text style={[styles.streakLabel, { color: palette.textSecondary }]}>Best streak</Text>
              <Text style={[styles.streakValue, { color: palette.textPrimary }]}>{bestStreak}</Text>
              <Text style={[styles.streakSuffix, { color: palette.textSecondary }]}>day{bestStreak === 1 ? "" : "s"}</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Year Stats */}
        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Stats of this year</Text>
          <ProgressRow label="great"    value={yearPct.great}    barColor={MOOD.blue}   trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="nice"     value={yearPct.nice}     barColor={MOOD.green}  trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="okay"     value={yearPct.okay}     barColor={MOOD.yellow} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="bad"      value={yearPct.bad}      barColor={MOOD.orange} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="very bad" value={yearPct.veryBad}  barColor={MOOD.red}    trackColor={palette.track} labelColor={palette.textSecondary} />
        </View>

        {/* Card 3: All time stats */}
        <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>All time stats</Text>

          <View style={styles.allTimeRow}>
            <DonutChart
              size={donutSize}
              thickness={donutThickness}
              slices={donutSlices}
              trackColor={palette.track}
              showCenterTotal
            />
            <View style={styles.legend}>
              <LegendRow color={MOOD.blue}   label="great"    pct={allPct.great}    textColor={palette.textPrimary} />
              <LegendRow color={MOOD.green}  label="nice"     pct={allPct.nice}     textColor={palette.textPrimary} />
              <LegendRow color={MOOD.yellow} label="okay"     pct={allPct.okay}     textColor={palette.textPrimary} />
              <LegendRow color={MOOD.orange} label="bad"      pct={allPct.bad}      textColor={palette.textPrimary} />
              <LegendRow color={MOOD.red}    label="very bad" pct={allPct.veryBad}  textColor={palette.textPrimary} />
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignSelf: "stretch",
  },
  title: { fontSize: 42, fontWeight: "800" },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  topHairline: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  row: { marginBottom: 10 },
  rowLabel: { marginBottom: 6, fontSize: 13 },
  track: { height: 10, borderRadius: 8, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 8 },
  allTimeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  legend: { flex: 1, justifyContent: "center", gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendLabel: { fontSize: 13, flex: 1, textTransform: "lowercase" },
  legendPct: { fontSize: 13, fontWeight: "700" },
  streakRow: { flexDirection: "row", gap: 12 },
  streakBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  streakLabel: { fontSize: 13, marginBottom: 4 },
  streakValue: { fontSize: 36, fontWeight: "800", lineHeight: 40 },
  streakSuffix: { fontSize: 12, marginTop: 2 },
});
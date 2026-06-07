import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useCalendar, DotColor } from "@/context/CalendarContext";
import DonutChart from "@/components/DonutChart";
import { useAppTheme } from "@/context/ThemeContext";

const SLEEP_STORAGE_KEY = "@sleep_entries_v1";

/** Einheitliche Mood-Farben (hex) */
const MOOD = {
  blue: "#00b4d8",
  green: "#7bd23c",
  yellow: "#f1c40f",
  orange: "#e67e22",
  red: "#e74c3c",
};

/** Sleep-Farben passend zur AddSleepScreen-Skala */
const HOURS_COLORS = [
  "#480CA8",
  "#6930C3",
  "#5E60CE",
  "#5390D9",
  "#4EA8DE",
];

const WAKEUP_COLORS = [
  "#480CA8",
  "#6930C3",
  "#5E60CE",
  "#5390D9",
  "#4EA8DE",
];

const HOURS_LEVELS = [
  { label: "9+", value: 5, color: HOURS_COLORS[4] },
  { label: "8", value: 4, color: HOURS_COLORS[3] },
  { label: "7", value: 3, color: HOURS_COLORS[2] },
  { label: "6", value: 2, color: HOURS_COLORS[1] },
  { label: "5-", value: 1, color: HOURS_COLORS[0] },
];

const WAKEUPS_LEVELS = [
  { label: "0", value: 5, color: WAKEUP_COLORS[4] },
  { label: "1", value: 4, color: WAKEUP_COLORS[3] },
  { label: "2", value: 3, color: WAKEUP_COLORS[2] },
  { label: "3", value: 2, color: WAKEUP_COLORS[1] },
  { label: "4+", value: 1, color: WAKEUP_COLORS[0] },
];

type MoodLabel = "great" | "nice" | "okay" | "bad" | "very bad";

type Counts = Record<MoodLabel, number> & { total: number };

type SleepEntry = {
  date: string;
  hoursValue: number;
  hoursLabel: string;
  wakeUpsValue: number;
  wakeUpsLabel: string;
  createdAt: string;
};

type ScaleCounts = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  total: number;
};

const emptyCounts: Counts = {
  great: 0,
  nice: 0,
  okay: 0,
  bad: 0,
  "very bad": 0,
  total: 0,
};

const makeEmptyScaleCounts = (): ScaleCounts => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  total: 0,
});

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

  if (typeof entry === "string") {
    return colorToDefaultLabel(entry as DotColor);
  }

  if (typeof entry === "object") {
    const lbl = entry.label as MoodLabel | undefined;

    if (lbl && ["great", "nice", "okay", "bad", "very bad"].includes(lbl)) {
      return lbl;
    }

    if (typeof entry.color === "string") {
      return colorToDefaultLabel(entry.color as DotColor);
    }
  }

  return null;
};

const moodLabelToScore = (label: MoodLabel): number => {
  switch (label) {
    case "very bad": return 1;
    case "bad": return 2;
    case "okay": return 3;
    case "nice": return 4;
    case "great": return 5;
    default: return 0;
  }
};

const averageMoodToLabel = (average: number | null): MoodLabel | "—" => {
  if (average === null) return "—";
  if (average < 1.5) return "very bad";
  if (average < 2.5) return "bad";
  if (average < 3.5) return "okay";
  if (average < 4.5) return "nice";
  return "great";
};

const averageMoodToColor = (label: MoodLabel | "—") => {
  switch (label) {
    case "great": return MOOD.blue;
    case "nice": return MOOD.green;
    case "okay": return MOOD.yellow;
    case "bad": return MOOD.orange;
    case "very bad": return MOOD.red;
    default: return "#5390D9";
  }
};

const calculateMoodAverage = (data: Record<string, any>) => {
  let totalScore = 0;
  let count = 0;

  for (const entry of Object.values(data)) {
    const label = getLabelFromEntry(entry);
    if (!label) continue;

    totalScore += moodLabelToScore(label);
    count += 1;
  }

  const averageMoodScore = count > 0 ? totalScore / count : null;
  const averageMoodLabel = averageMoodToLabel(averageMoodScore);

  return {
    averageMoodScore,
    averageMoodLabel,
    totalMoodEntries: count,
  };
};

const countAll = (data: Record<string, any>): Counts => {
  const c: Counts = { ...emptyCounts };

  for (const entry of Object.values(data)) {
    const lbl = getLabelFromEntry(entry);

    if (lbl) {
      c[lbl] += 1;
      c.total += 1;
    }
  }

  return c;
};

const countYear = (data: Record<string, any>, year: number): Counts => {
  const c: Counts = { ...emptyCounts };

  for (const [iso, entry] of Object.entries(data)) {
    const y = Number(iso.slice(0, 4));
    if (y !== year) continue;

    const lbl = getLabelFromEntry(entry);

    if (lbl) {
      c[lbl] += 1;
      c.total += 1;
    }
  }

  return c;
};

const countSleepScale = (
  data: Record<string, SleepEntry>,
  key: "hoursValue" | "wakeUpsValue",
  year?: number
): ScaleCounts => {
  const c = makeEmptyScaleCounts();

  for (const [iso, entry] of Object.entries(data)) {
    if (!entry) continue;

    const entryDate = entry.date ?? iso;
    const entryYear = Number(entryDate.slice(0, 4));

    if (year && entryYear !== year) continue;

    const value = entry[key];

    if (value >= 1 && value <= 5) {
      c[value as 1 | 2 | 3 | 4 | 5] += 1;
      c.total += 1;
    }
  }

  return c;
};

const hoursValueToHours = (value: number): number | null => {
  switch (value) {
    case 1: return 5;
    case 2: return 6;
    case 3: return 7;
    case 4: return 8;
    case 5: return 9;
    default: return null;
  }
};

const wakeUpsValueToCount = (value: number): number | null => {
  switch (value) {
    case 1: return 4;
    case 2: return 3;
    case 3: return 2;
    case 4: return 1;
    case 5: return 0;
    default: return null;
  }
};

const calculateSleepAverages = (data: Record<string, SleepEntry>) => {
  let totalHours = 0;
  let totalWakeUps = 0;
  let count = 0;

  for (const entry of Object.values(data)) {
    if (!entry) continue;

    const hours = hoursValueToHours(entry.hoursValue);
    const wakeUps = wakeUpsValueToCount(entry.wakeUpsValue);

    if (hours === null || wakeUps === null) continue;

    totalHours += hours;
    totalWakeUps += wakeUps;
    count += 1;
  }

  return {
    averageHoursSlept: count > 0 ? totalHours / count : null,
    averageWakeUps: count > 0 ? totalWakeUps / count : null,
    totalEntries: count,
  };
};

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

const ProgressRow: React.FC<{
  label: string;
  value: number;
  barColor: string;
  trackColor: string;
  labelColor: string;
}> = ({ label, value, barColor, trackColor, labelColor }) => {
  const pct = Math.max(0, Math.min(1, value));

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>

      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct * 100}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const LegendRow: React.FC<{
  color: string;
  label: string;
  pct: number;
  textColor: string;
}> = ({ color, label, pct, textColor }) => (
  <View style={styles.legendRow}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={[styles.legendLabel, { color: textColor }]}>{label}</Text>
    <Text style={[styles.legendPct, { color: textColor }]}>
      {`${Math.round(pct * 100)} %`}
    </Text>
  </View>
);

const AverageStatBox: React.FC<{
  label: string;
  value: string;
  suffix: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}> = ({ label, value, suffix, borderColor, textPrimary, textSecondary }) => (
  <View style={[styles.averageBox, { borderColor }]}>
    <Text style={[styles.averageLabel, { color: textSecondary }]}>{label}</Text>
    <Text style={[styles.averageValue, { color: textPrimary }]}>{value}</Text>
    <Text style={[styles.averageSuffix, { color: textSecondary }]}>{suffix}</Text>
  </View>
);

export default function OverviewScreen() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 360 || height < 650;

  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];
  const { savedData } = useCalendar();
  const curYear = new Date().getFullYear();

  const [sleepData, setSleepData] = useState<Record<string, SleepEntry>>({});

  const loadSleepData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
      setSleepData(raw ? JSON.parse(raw) : {});
    } catch (error) {
      console.error("Failed to load sleep data:", error);
      setSleepData({});
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSleepData();
    }, [loadSleepData])
  );

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

  const safe = (n: number, d: number) => {
    return d > 0 ? n / d : 0;
  };

  const { averageMoodScore, averageMoodLabel, totalMoodEntries } = useMemo(() => {
    return calculateMoodAverage(savedData);
  }, [savedData]);

  const averageMoodColor = useMemo(() => {
    return averageMoodToColor(averageMoodLabel);
  }, [averageMoodLabel]);

  const { yearPct, allPct, allCounts } = useMemo(() => {
    const y = countYear(savedData, curYear);
    const a = countAll(savedData);

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

  const {
    sleepHoursYearPct,
    wakeUpsYearPct,
    sleepHoursAllPct,
    wakeUpsAllPct,
    sleepHoursAllCounts,
    wakeUpsAllCounts,
  } = useMemo(() => {
    const hoursYear = countSleepScale(sleepData, "hoursValue", curYear);
    const wakeUpsYear = countSleepScale(sleepData, "wakeUpsValue", curYear);

    const hoursAll = countSleepScale(sleepData, "hoursValue");
    const wakeUpsAll = countSleepScale(sleepData, "wakeUpsValue");

    return {
      sleepHoursYearPct: {
        1: safe(hoursYear[1], hoursYear.total),
        2: safe(hoursYear[2], hoursYear.total),
        3: safe(hoursYear[3], hoursYear.total),
        4: safe(hoursYear[4], hoursYear.total),
        5: safe(hoursYear[5], hoursYear.total),
      },
      wakeUpsYearPct: {
        1: safe(wakeUpsYear[1], wakeUpsYear.total),
        2: safe(wakeUpsYear[2], wakeUpsYear.total),
        3: safe(wakeUpsYear[3], wakeUpsYear.total),
        4: safe(wakeUpsYear[4], wakeUpsYear.total),
        5: safe(wakeUpsYear[5], wakeUpsYear.total),
      },
      sleepHoursAllPct: {
        1: safe(hoursAll[1], hoursAll.total),
        2: safe(hoursAll[2], hoursAll.total),
        3: safe(hoursAll[3], hoursAll.total),
        4: safe(hoursAll[4], hoursAll.total),
        5: safe(hoursAll[5], hoursAll.total),
      },
      wakeUpsAllPct: {
        1: safe(wakeUpsAll[1], wakeUpsAll.total),
        2: safe(wakeUpsAll[2], wakeUpsAll.total),
        3: safe(wakeUpsAll[3], wakeUpsAll.total),
        4: safe(wakeUpsAll[4], wakeUpsAll.total),
        5: safe(wakeUpsAll[5], wakeUpsAll.total),
      },
      sleepHoursAllCounts: hoursAll,
      wakeUpsAllCounts: wakeUpsAll,
    };
  }, [sleepData, curYear]);

  const { averageHoursSlept, averageWakeUps, totalEntries } = useMemo(() => {
    return calculateSleepAverages(sleepData);
  }, [sleepData]);

  const donutSlices = useMemo(
    () => [
      { value: allCounts.great, color: MOOD.blue },
      { value: allCounts.nice, color: MOOD.green },
      { value: allCounts.okay, color: MOOD.yellow },
      { value: allCounts.bad, color: MOOD.orange },
      { value: allCounts["very bad"], color: MOOD.red },
    ],
    [allCounts]
  );

  const sleepHoursDonutSlices = useMemo(
    () => [
      { value: sleepHoursAllCounts[5], color: HOURS_COLORS[4] },
      { value: sleepHoursAllCounts[4], color: HOURS_COLORS[3] },
      { value: sleepHoursAllCounts[3], color: HOURS_COLORS[2] },
      { value: sleepHoursAllCounts[2], color: HOURS_COLORS[1] },
      { value: sleepHoursAllCounts[1], color: HOURS_COLORS[0] },
    ],
    [sleepHoursAllCounts]
  );

  const wakeUpsDonutSlices = useMemo(
    () => [
      { value: wakeUpsAllCounts[5], color: WAKEUP_COLORS[4] },
      { value: wakeUpsAllCounts[4], color: WAKEUP_COLORS[3] },
      { value: wakeUpsAllCounts[3], color: WAKEUP_COLORS[2] },
      { value: wakeUpsAllCounts[2], color: WAKEUP_COLORS[1] },
      { value: wakeUpsAllCounts[1], color: WAKEUP_COLORS[0] },
    ],
    [wakeUpsAllCounts]
  );

  const { currentStreak, bestStreak } = useMemo(() => {
    const active = new Set(
      Object.entries(savedData)
        .filter(([, v]) => getLabelFromEntry(v) !== null)
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
        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Streaks
          </Text>

          <View style={styles.streakRow}>
            <View style={[styles.streakBox, { borderColor: "#36c15c" }]}>
              <Text style={[styles.streakLabel, { color: palette.textSecondary }]}>
                Current streak
              </Text>
              <Text style={[styles.streakValue, { color: palette.textPrimary }]}>
                {currentStreak}
              </Text>
              <Text style={[styles.streakSuffix, { color: palette.textSecondary }]}>
                day{currentStreak === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={[styles.streakBox, { borderColor: "#ffd700" }]}>
              <Text style={[styles.streakLabel, { color: palette.textSecondary }]}>
                Best streak
              </Text>
              <Text style={[styles.streakValue, { color: palette.textPrimary }]}>
                {bestStreak}
              </Text>
              <Text style={[styles.streakSuffix, { color: palette.textSecondary }]}>
                day{bestStreak === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
        </View>

        {/* Mood Stats */}
        <Text style={[styles.sectionHeading, { color: C.text }]}>Mood Stats</Text>

        {/* Average Mood Panel */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Average mood
          </Text>

          <View style={styles.averageRow}>
            <AverageStatBox
              label="Mood score"
              value={averageMoodScore === null ? "—" : averageMoodScore.toFixed(1)}
              suffix="/ 5"
              borderColor={averageMoodColor}
              textPrimary={palette.textPrimary}
              textSecondary={palette.textSecondary}
            />

            <AverageStatBox
              label="Average mood"
              value={averageMoodLabel}
              suffix="overall"
              borderColor={averageMoodColor}
              textPrimary={palette.textPrimary}
              textSecondary={palette.textSecondary}
            />
          </View>

          <Text style={[styles.averageFootnote, { color: palette.textSecondary }]}>
            Based on {totalMoodEntries} saved mood day{totalMoodEntries === 1 ? "" : "s"}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Stats of this year
          </Text>

          <ProgressRow label="great" value={yearPct.great} barColor={MOOD.blue} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="nice" value={yearPct.nice} barColor={MOOD.green} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="okay" value={yearPct.okay} barColor={MOOD.yellow} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="bad" value={yearPct.bad} barColor={MOOD.orange} trackColor={palette.track} labelColor={palette.textSecondary} />
          <ProgressRow label="very bad" value={yearPct.veryBad} barColor={MOOD.red} trackColor={palette.track} labelColor={palette.textSecondary} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            All time stats
          </Text>

          <View style={styles.allTimeRow}>
            <DonutChart
              size={donutSize}
              thickness={donutThickness}
              slices={donutSlices}
              trackColor={palette.track}
              showCenterTotal
            />

            <View style={styles.legend}>
              <LegendRow color={MOOD.blue} label="great" pct={allPct.great} textColor={palette.textPrimary} />
              <LegendRow color={MOOD.green} label="nice" pct={allPct.nice} textColor={palette.textPrimary} />
              <LegendRow color={MOOD.yellow} label="okay" pct={allPct.okay} textColor={palette.textPrimary} />
              <LegendRow color={MOOD.orange} label="bad" pct={allPct.bad} textColor={palette.textPrimary} />
              <LegendRow color={MOOD.red} label="very bad" pct={allPct.veryBad} textColor={palette.textPrimary} />
            </View>
          </View>
        </View>

        {/* Sleep Tracker */}
        <Text style={[styles.sectionHeading, { color: C.text }]}>Sleep Tracker</Text>

        {/* Average Sleep Panel */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Average sleep stats
          </Text>

          <View style={styles.averageRow}>
            <AverageStatBox
              label="Average sleep"
              value={averageHoursSlept === null ? "—" : averageHoursSlept.toFixed(1)}
              suffix="hours"
              borderColor="#5390D9"
              textPrimary={palette.textPrimary}
              textSecondary={palette.textSecondary}
            />

            <AverageStatBox
              label="Average wake-ups"
              value={averageWakeUps === null ? "—" : averageWakeUps.toFixed(1)}
              suffix="times"
              borderColor="#4EA8DE"
              textPrimary={palette.textPrimary}
              textSecondary={palette.textSecondary}
            />
          </View>

          <Text style={[styles.averageFootnote, { color: palette.textSecondary }]}>
            Based on {totalEntries} saved day{totalEntries === 1 ? "" : "s"}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            Stats of this year
          </Text>

          <Text style={[styles.subCardTitle, { color: palette.textSecondary }]}>
            Hours slept
          </Text>

          {HOURS_LEVELS.map((level) => (
            <ProgressRow
              key={`hours-year-${level.value}`}
              label={level.label}
              value={sleepHoursYearPct[level.value as 1 | 2 | 3 | 4 | 5]}
              barColor={level.color}
              trackColor={palette.track}
              labelColor={palette.textSecondary}
            />
          ))}

          <Text style={[styles.subCardTitle, { color: palette.textSecondary, marginTop: 10 }]}>
            Wake-ups
          </Text>

          {WAKEUPS_LEVELS.map((level) => (
            <ProgressRow
              key={`wakeups-year-${level.value}`}
              label={level.label}
              value={wakeUpsYearPct[level.value as 1 | 2 | 3 | 4 | 5]}
              barColor={level.color}
              trackColor={palette.track}
              labelColor={palette.textSecondary}
            />
          ))}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>
            All time stats
          </Text>

          <Text style={[styles.subCardTitle, { color: palette.textSecondary }]}>
            Hours slept
          </Text>

          <View style={styles.allTimeRow}>
            <DonutChart
              size={donutSize}
              thickness={donutThickness}
              slices={sleepHoursDonutSlices}
              trackColor={palette.track}
              showCenterTotal
            />

            <View style={styles.legend}>
              {HOURS_LEVELS.map((level) => (
                <LegendRow
                  key={`hours-all-${level.value}`}
                  color={level.color}
                  label={level.label}
                  pct={sleepHoursAllPct[level.value as 1 | 2 | 3 | 4 | 5]}
                  textColor={palette.textPrimary}
                />
              ))}
            </View>
          </View>

          <Text style={[styles.subCardTitle, { color: palette.textSecondary, marginTop: 18 }]}>
            Wake-ups
          </Text>

          <View style={styles.allTimeRow}>
            <DonutChart
              size={donutSize}
              thickness={donutThickness}
              slices={wakeUpsDonutSlices}
              trackColor={palette.track}
              showCenterTotal
            />

            <View style={styles.legend}>
              {WAKEUPS_LEVELS.map((level) => (
                <LegendRow
                  key={`wakeups-all-${level.value}`}
                  color={level.color}
                  label={level.label}
                  pct={wakeUpsAllPct[level.value as 1 | 2 | 3 | 4 | 5]}
                  textColor={palette.textPrimary}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignSelf: "stretch",
  },
  title: {
    fontSize: 42,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 2,
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
  emptyCard: {
    minHeight: 120,
  },
  topHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  subCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  row: {
    marginBottom: 10,
  },
  rowLabel: {
    marginBottom: 6,
    fontSize: 13,
  },
  track: {
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 8,
  },
  allTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legend: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 13,
    flex: 1,
    textTransform: "lowercase",
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "700",
  },
  averageRow: {
    flexDirection: "row",
    gap: 12,
  },
  averageBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  averageLabel: {
    fontSize: 13,
    marginBottom: 4,
    textAlign: "center",
  },
  averageValue: {
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
    textAlign: "center",
  },
  averageSuffix: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
  },
  averageFootnote: {
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  streakRow: {
    flexDirection: "row",
    gap: 12,
  },
  streakBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  streakLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  streakSuffix: {
    fontSize: 12,
    marginTop: 2,
  },
});
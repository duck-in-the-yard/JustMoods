import React, { useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useAppTheme } from "@/context/ThemeContext";
import { NotificationService } from "@/services/NotificationService";

// ─── Storage ──────────────────────────────────────────────────────────────────

const SLEEP_STORAGE_KEY = "@sleep_entries_v1";

// ─── Scale definitions ────────────────────────────────────────────────────────

const HOURS_LEVELS = [
  { label: "9+", value: 5 },
  { label: "8", value: 4 },
  { label: "7", value: 3 },
  { label: "6", value: 2 },
  { label: "5-", value: 1 },
];

const WAKEUPS_LEVELS = [
  { label: "0", value: 5 },
  { label: "1", value: 4 },
  { label: "2", value: 3 },
  { label: "3", value: 2 },
  { label: "4+", value: 1 },
];

// Purple gradient for hours — darkest at bottom (5-), lightest at top (9+)
const HOURS_COLORS = [
  "#480CA8", // 5- bottom
  "#6930C3", // 6
  "#5E60CE", // 7
  "#5390D9", // 8
  "#4EA8DE", // 9+ top
];

// Blue → purple gradient for wake-ups
const WAKEUP_COLORS = [
  "#480CA8", // 4+ bottom
  "#6930C3", // 3
  "#5E60CE", // 2
  "#5390D9", // 1
  "#4EA8DE", // 0 top
];

// ─── Types ────────────────────────────────────────────────────────────────────

type SleepEntry = {
  date: string;
  hoursValue: number;
  hoursLabel: string;
  wakeUpsValue: number;
  wakeUpsLabel: string;
  createdAt: string;
};

interface ScaleProps {
  levels: { label: string; value: number }[];
  colors: string[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  title: string;
  palette: ReturnType<typeof buildPalette>;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ─── Palette builder ──────────────────────────────────────────────────────────

function buildPalette(colorScheme: "light" | "dark", textColor: string) {
  if (colorScheme === "dark") {
    return {
      cardBg: "#171717",
      cardBorder: "#2a2a2a",
      topHairline: "rgba(255,255,255,0.06)",
      track: "#262626",
      textPrimary: textColor,
      textSecondary: "rgba(241,241,241,0.7)",
      segmentEmpty: "#2a2a2a",
    };
  }

  return {
    cardBg: "#ffffff",
    cardBorder: "#e6e6e6",
    topHairline: "rgba(0,0,0,0.04)",
    track: "#eeeeee",
    textPrimary: textColor,
    textSecondary: "#555555",
    segmentEmpty: "#E5E7EB",
  };
}

// ─── Interactive Scale Component ──────────────────────────────────────────────

function InteractiveScale({
  levels,
  colors,
  selectedValue,
  onValueChange,
  title,
  palette,
}: ScaleProps) {
  const containerRef = useRef<View>(null);
  const containerY = useRef(0);
  const containerHeight = useRef(0);
  const SEGMENT_COUNT = levels.length;

  const onLayout = (e: any) => {
    containerHeight.current = e.nativeEvent.layout.height;

    containerRef.current?.measure((_fx, _fy, _w, h, _px, py) => {
      containerY.current = py;
      containerHeight.current = h;
    });
  };

  const yToValue = (touchY: number): number => {
    const segH = containerHeight.current / SEGMENT_COUNT;
    const idx = Math.floor(touchY / segH);
    const clamped = Math.max(0, Math.min(SEGMENT_COUNT - 1, idx));

    return SEGMENT_COUNT - clamped;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        containerRef.current?.measure((_fx, _fy, _w, h, _px, py) => {
          containerY.current = py;
          containerHeight.current = h;

          const localY = evt.nativeEvent.pageY - py;
          onValueChange(yToValue(localY));
        });
      },
      onPanResponderMove: (evt) => {
        const localY = evt.nativeEvent.pageY - containerY.current;
        onValueChange(yToValue(localY));
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
      ]}
    >
      <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />

      <Text style={[styles.cardTitle, { color: palette.textSecondary }]}>
        {title}
      </Text>

      <View style={styles.scaleRow}>
        <View style={styles.labelsCol}>
          {levels.map((level) => (
            <View key={level.value} style={styles.labelCell}>
              <Text style={[styles.labelText, { color: palette.textSecondary }]}>
                {level.label}
              </Text>
            </View>
          ))}
        </View>

        <View
          ref={containerRef}
          style={styles.barContainer}
          onLayout={onLayout}
          {...panResponder.panHandlers}
        >
          {levels.map((level, idx) => {
            const segmentValue = SEGMENT_COUNT - idx;
            const filled = segmentValue <= selectedValue;
            const colorIdx = level.value - 1;

            return (
              <View
                key={level.value}
                style={[
                  styles.segment,
                  {
                    backgroundColor: filled ? colors[colorIdx] : palette.segmentEmpty,
                    marginBottom: idx < SEGMENT_COUNT - 1 ? 3 : 0,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddSleepScreen() {
  const [hoursValue, setHoursValue] = useState(1);
  const [wakeUpsValue, setWakeUpsValue] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];

  const palette = useMemo(
    () => buildPalette(colorScheme, C.text),
    [colorScheme, C.text]
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const date = fmtISO(new Date());

      const hoursLabel =
        HOURS_LEVELS.find((l) => l.value === hoursValue)?.label ?? "?";

      const wakeUpsLabel =
        WAKEUPS_LEVELS.find((l) => l.value === wakeUpsValue)?.label ?? "?";

      const newEntry: SleepEntry = {
        date,
        hoursValue,
        hoursLabel,
        wakeUpsValue,
        wakeUpsLabel,
        createdAt: new Date().toISOString(),
      };

      const raw = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
      const currentEntries: Record<string, SleepEntry> = raw ? JSON.parse(raw) : {};

      const nextEntries = {
        ...currentEntries,
        [date]: newEntry,
      };

      await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(nextEntries));

      // Reschedule the sleep notification to tomorrow now that today is tracked
      await NotificationService.rescheduleAfterSleepTracked();

      Alert.alert("Saved", "Your sleep data has been saved.");
    } catch (error) {
      console.error("Failed to save sleep data:", error);
      Alert.alert("Could not save", "Your sleep data could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.pagebackground }]}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeHeader}>
        <Text style={[styles.title, { color: C.text }]}>Sleep Tracker</Text>
      </SafeAreaView>

      <View style={styles.bottomContent}>
        <View style={styles.cardsRow}>
          <InteractiveScale
            title="How many hours did you sleep?"
            levels={HOURS_LEVELS}
            colors={HOURS_COLORS}
            selectedValue={hoursValue}
            onValueChange={setHoursValue}
            palette={palette}
          />

          <InteractiveScale
            title="How many times did you wake up?"
            levels={WAKEUPS_LEVELS}
            colors={WAKEUP_COLORS}
            selectedValue={wakeUpsValue}
            onValueChange={setWakeUpsValue}
            palette={palette}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? "saving..." : "save"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width } = Dimensions.get("window");

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
  bottomContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  topHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
    lineHeight: 18,
  },
  scaleRow: {
    flexDirection: "row",
    alignItems: "stretch",
    height: 220,
  },
  labelsCol: {
    width: 32,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  labelCell: {
    flex: 1,
    justifyContent: "center",
  },
  labelText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "right",
  },
  barContainer: {
    flex: 1,
    flexDirection: "column",
    borderRadius: 10,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    borderRadius: 4,
  },
  saveButton: {
    backgroundColor: "#5390D9",
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#5390D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "lowercase",
  },
});

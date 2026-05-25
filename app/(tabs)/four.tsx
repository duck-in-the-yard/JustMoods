import React, { useRef, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useAppTheme } from "@/context/ThemeContext";

// ─── Scale definitions ────────────────────────────────────────────────────────

const HOURS_LEVELS = [
  { label: "9+", value: 5 },
  { label: "8",  value: 4 },
  { label: "7",  value: 3 },
  { label: "6",  value: 2 },
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
  "#480CA8", // 5- (bottom, darkest)
  "#6930C3", // 6
  "#5E60CE", // 7
  "#5390D9", // 8
  "#4EA8DE", // 9+ (top, lightest)
];

// Blue → purple gradient for wake-ups
const WAKEUP_COLORS = [
  "#480CA8", // 4 (bottom, darkest purple)
  "#6930C3", // 3
  "#5E60CE", // 2
  "#5390D9", // 1
  "#4EA8DE", // 0 (top, sky blue)
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScaleProps {
  levels: { label: string; value: number }[];
  colors: string[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  title: string;
  palette: ReturnType<typeof buildPalette>;
}

// ─── Palette builder (mirrors OverviewScreen) ─────────────────────────────────

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

function InteractiveScale({ levels, colors, selectedValue, onValueChange, title, palette }: ScaleProps) {
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
    <View style={[
      styles.card,
      { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
    ]}>
      {/* top hairline matching overview cards */}
      <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
      <Text style={[styles.cardTitle, { color: palette.textSecondary }]}>{title}</Text>
      <View style={styles.scaleRow}>
        {/* Labels column */}
        <View style={styles.labelsCol}>
          {levels.map((level) => (
            <View key={level.value} style={styles.labelCell}>
              <Text style={[styles.labelText, { color: palette.textSecondary }]}>{level.label}</Text>
            </View>
          ))}
        </View>

        {/* Bar column */}
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

  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];

  const palette = useMemo(
    () => buildPalette(colorScheme, C.text),
    [colorScheme, C.text]
  );

  const handleSave = () => {
    const hoursLabel = HOURS_LEVELS.find((l) => l.value === hoursValue)?.label ?? "?";
    const wakeLabel  = WAKEUPS_LEVELS.find((l) => l.value === wakeUpsValue)?.label ?? "?";
    console.log(`Saved: ${hoursLabel} hours, woke up ${wakeLabel} times`);
    // TODO: persist to your data store
  };

  return (
    <View style={[styles.screen, { backgroundColor: C.pagebackground }]}>
      {/* Title — same SafeAreaView pattern as OverviewScreen */}
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeHeader}>
        <Text style={[styles.title, { color: C.text }]}>Sleep Tracker</Text>
      </SafeAreaView>

      {/* Cards + button pushed to bottom */}
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveText}>save</Text>
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
  saveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "lowercase",
  },
});

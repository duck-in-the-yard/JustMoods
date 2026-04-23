import React, { useMemo, useRef } from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useCalendar, DotColor } from "@/context/CalendarContext";
import { useAppTheme } from "@/context/ThemeContext";
import Colors from "@/constants/Colors";

// Anzeige-Farbpalette (gleich wie Overview)
const PALETTE: Record<DotColor, string> = {
  blue:   "#00b4d8", // great
  green:  "#7bd23c", // nice
  yellow: "#f1c40f", // okay
  orange: "#e67e22", // bad
  red:    "#e74c3c", // very bad
  gray:   "#6b7280", // neutral
};

const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const mondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7;

const buildMonthGrid = (year: number, month: number) => {
  const firstOfMonth = new Date(year, month, 1);
  const lead = mondayFirstIndex(firstOfMonth.getDay());
  const start = new Date(year, month, 1 - lead);
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d);
  }
  return grid;
};

const CELL_H = 28;
const WEEKROW_H = 24;
const PADDING_TOP = 8;
const MONTH_PAGE_HEIGHT = PADDING_TOP + CELL_H * 6;

const MonthGrid: React.FC<{
  year: number;
  month: number;
  savedData: Record<string, DotColor>;
  todayISO: string;
  isDark: boolean;
}> = ({ year, month, savedData, todayISO, isDark }) => {
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <View style={styles.monthContainer}>
      <View style={styles.grid}>
        {grid.map((date, idx) => {
          const inMonth = date.getMonth() === month;
          const iso = fmtISO(date);
          const token: DotColor = inMonth ? (savedData[iso] ?? "gray") : "gray";
          const color = PALETTE[token];
          const isToday = iso === todayISO;

          return (
            <View key={iso + idx} style={styles.cell}>
              <View
                style={[
                  styles.dotRing,
                  isToday && {
                    borderWidth: 2,
                    borderColor: isDark ? "white" : "#111", // better contrast per theme
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: color },
                    !inMonth && styles.dotFaded,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const Calendar: React.FC = () => {
  const now = new Date();
  const listRef = useRef<FlatList<any>>(null);
  const { savedData } = useCalendar();
  const todayISO = fmtISO(now);

  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === "dark";
  const C = Colors[colorScheme];

  const TOTAL_MONTHS = 60;
  const START_OFFSET = Math.floor(TOTAL_MONTHS / 2);
  const months = useMemo(() => {
    const arr: { id: string; year: number; month: number }[] = [];
    for (let i = -START_OFFSET; i < TOTAL_MONTHS - START_OFFSET; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push({ id: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth() });
    }
    return arr;
  }, []);
  const initialIndex = START_OFFSET;

  const snapOffsets = useMemo(() => months.map((_, i) => i * MONTH_PAGE_HEIGHT), [months]);

  const jumpToCurrentMonth = () => {
    listRef.current?.scrollToIndex({ index: initialIndex, animated: true, viewPosition: 0 });
  };

  return (
    <View
      style={[
        styles.container,
        {
          // 👇 light gray in light mode, keep black in dark
          backgroundColor: isDark ? "#000000ff" : "#f0f0f0",
          borderRadius: 24,
        },
      ]}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={months}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onLongPress={jumpToCurrentMonth} delayLongPress={400} android_disableSound>
            <MonthGrid
              year={item.year}
              month={item.month}
              savedData={savedData}
              todayISO={todayISO}
              isDark={isDark}
            />
          </Pressable>
        )}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: MONTH_PAGE_HEIGHT, offset: MONTH_PAGE_HEIGHT * index, index })}
        snapToInterval={MONTH_PAGE_HEIGHT}
        snapToAlignment="start"
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={7}
        onScrollToIndexFailed={({ index }) => {
          const offset = Math.max(0, (index - 1) * MONTH_PAGE_HEIGHT);
          listRef.current?.scrollToOffset({ offset, animated: false });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
          }, 16);
        }}
      />

      <View style={styles.weekRowFixed}>
        {daysOfWeek.map((d, i) => (
          <Text
            key={`${d}-${i}`}
            style={[
              styles.weekLabel,
              { color: isDark ? "#c2c2c2ff" : "#666666" }, // darker on light bg
            ]}
          >
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // bg is overridden per theme
    paddingHorizontal: 16,
    paddingTop: 8,
    height: 224,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 0 },
  monthContainer: { height: MONTH_PAGE_HEIGHT, paddingTop: PADDING_TOP },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", height: CELL_H, justifyContent: "center", alignItems: "center" },
  dotRing: { height: 22, width: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotFaded: { opacity: 0.4 },
  weekRowFixed: {
    height: WEEKROW_H,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 5,
    marginTop: 10,
  },
  weekLabel: { width: "14.2857%", textAlign: "center", fontSize: 12 },
});

export default Calendar;

import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Pressable, Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useCalendar, DotColor } from "@/context/CalendarContext";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/context/ThemeContext";
import { NotificationService } from "@/services/NotificationService";

const fmtISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const labelToDot: Record<string, DotColor> = {
  great: "blue",
  nice: "green",
  okay: "yellow",
  bad: "orange",
  "very bad": "red",
};

export default function TabTwoScreen() {
  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];
  const { addEntry } = useCalendar();
  const router = useRouter();

  const options = useMemo(() => [
    { label: "great",    color: "#00b4d8" },
    { label: "nice",     color: "#7bd23c" },
    { label: "okay",     color: "#f1c40f" },
    { label: "bad",      color: "#e67e22" },
    { label: "very bad", color: "#e74c3c" },
  ], []);

  const [open, setOpen] = useState(false);
  const panel = useRef(new Animated.Value(1)).current;
  const itemVals = useRef(options.map(() => new Animated.Value(0))).current;

  const appearStagger = useCallback(() => {
    const seq = [...itemVals].reverse().map((v) =>
      Animated.timing(v, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    );
    Animated.stagger(70, seq).start();
  }, [itemVals]);

  const disappearStaggerThenSlide = useCallback((after?: () => void) => {
    const seq = itemVals.map((v) =>
      Animated.timing(v, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true })
    );
    Animated.stagger(60, seq).start(() => {
      Animated.timing(panel, { toValue: 1, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => { setOpen(false); after?.(); });
    });
  }, [itemVals, panel]);

  const openMenu = useCallback(() => {
    itemVals.forEach((v) => v.setValue(0));
    setOpen(true);
    Animated.timing(panel, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(appearStagger);
  }, [panel, appearStagger, itemVals]);

  const closeMenu = useCallback(() => disappearStaggerThenSlide(), [disappearStaggerThenSlide]);

  useFocusEffect(React.useCallback(() => { openMenu(); return () => closeMenu(); }, [openMenu, closeMenu]));

  const translateY = panel.interpolate({ inputRange: [0, 1], outputRange: [0, 340] });

  const onPick = (label: string) => {
    disappearStaggerThenSlide(async () => {
      const date = fmtISO(new Date());
      const color = labelToDot[label] ?? "gray";

      addEntry(date, color);

      // Heute wurde getrackt:
      // Falls die 18:00 Notification für heute noch offen war, wird sie ersetzt
      // und direkt auf morgen 18:00 geplant.
      await NotificationService.rescheduleAfterMoodTracked();

      router.push("/");
    });
  };

  const pillBg = colorScheme === "dark" ? "#171717" : "#f5f5f5";
  const pillPressed = colorScheme === "dark" ? "#1d1d1d" : "#ececec";
  const pillBorder = colorScheme === "dark" ? "#2a2a2a" : "#e3e3e3";
  const dotBorder = colorScheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)";

  return (
    <View style={[styles.container, { backgroundColor: C.pagebackground }]}>
      <Animated.View style={[styles.stack, { transform: [{ translateY }] }]}>
        {options.map((o, i) => {
          const v = itemVals[i];
          const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
          const offset  = v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

          return (
            <Animated.View key={o.label} style={{ opacity, transform: [{ translateY: offset }], marginTop: i === 0 ? 8 : 12, width: "100%" }}>
              <Pressable
                onPress={() => onPick(o.label)}
                style={({ pressed }) => [
                  styles.optionRow,
                  { backgroundColor: pressed ? pillPressed : pillBg, borderColor: pillBorder },
                ]}
              >
                <Text style={[styles.optionText, { color: C.text }]}>{o.label}</Text>
                <View style={[styles.dot, { backgroundColor: o.color, borderColor: dotBorder }]} />
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  stack: { position: "absolute", left: 18, right: 18, bottom: 12 },
  optionRow: {
    height: 56, borderRadius: 18, paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 6,
  },
  optionText: { fontSize: 18, fontWeight: "700" },
  dot: { width: 22, height: 22, borderRadius: 50, borderWidth: 1 },
});
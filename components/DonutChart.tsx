import React from "react";
import Svg, { Circle, G } from "react-native-svg";
import { View, Text } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";

type Slice = { value: number; color: string };

type Props = {
  size?: number;          // Gesamtgröße
  thickness?: number;     // Ringdicke
  slices: Slice[];        // absolute Werte! (z.B. 2,4,0, ...)
  trackColor?: string;    // Hintergrundring
  showCenterTotal?: boolean;
};

export default function DonutChart({
  size = 140,
  thickness = 14,
  slices,
  trackColor = "#2b2b2b",
  showCenterTotal = true,
}: Props) {
  const { colorScheme } = useAppTheme();
  const totalColor = colorScheme === "dark" ? "#ffffff" : "#121212"; // ← Wunschfarben

  const radius = size / 2;
  const r = radius - thickness / 2;
  const C = 2 * Math.PI * r;

  const total = slices.reduce((s, x) => s + x.value, 0);
  let acc = 0; // kumulierter Anteil 0..1

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${radius}, ${radius}`}>
          {/* Track */}
          <Circle cx={radius} cy={radius} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
          {/* Segmente */}
          {slices.map((s, i) => {
            const pct = total === 0 ? 0 : s.value / total;
            const dash = pct * C;
            const gap = C - dash;
            const offset = -acc * C;
            acc += pct;

            return (
              <Circle
                key={i}
                cx={radius}
                cy={radius}
                r={r}
                stroke={s.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>

      {showCenterTotal && (
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Text style={{ color: totalColor, fontWeight: "700" }}>{total}</Text>
          <Text style={{ color: "#9ca3af", fontSize: 12 }}>total</Text>
        </View>
      )}
    </View>
  );
}

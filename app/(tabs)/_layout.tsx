// app/(tabs)/_layout.tsx
import React from "react";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import Colors from "@/constants/Colors";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useAppTheme } from "@/context/ThemeContext";

function TabBarIcon({ name, color }: { name: string; color: string }) {
  return <Icon name={name} size={28} style={{ marginBottom: -3 }} color={color} />;
}

export default function TabLayout() {
  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];

  const palette = React.useMemo(
    () =>
      colorScheme === "dark"
        ? { tabBg: "#0f0f0f", topBorder: "#1f1f1f" }
        : { tabBg: "#ffffff", topBorder: "#e6e6e6" },
    [colorScheme]
  );

  return (
    <View style={[styles.container, { backgroundColor: C.pagebackground }]}>
      <Tabs
        // ❌ sceneContainerStyle — remove it
        screenOptions={{
          headerShown: useClientOnlyValue(false, true),

          tabBarActiveTintColor: C.tabIconSelected,
          tabBarInactiveTintColor: C.tabIconDefault,
          tabBarStyle: {
            backgroundColor: palette.tabBg,
            borderTopColor: palette.topBorder,
            height: 84,
          },
          tabBarLabelStyle: { fontSize: 12 },
          // Optional: if you want a custom bg component
          // tabBarBackground: () => <View style={{ flex: 1, backgroundColor: palette.tabBg }} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            title: "Add Mood",
            headerShown: false,
            tabBarIcon: ({ color }) => <TabBarIcon name="add" color={color} />,
          }}
        />
        <Tabs.Screen
          name="three"
          options={{
            title: "Overview",
            headerShown: false,
            tabBarIcon: ({ color }) => <TabBarIcon name="donut-large" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

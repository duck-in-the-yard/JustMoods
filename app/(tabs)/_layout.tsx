// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import Colors from "@/constants/Colors";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useAppTheme } from "@/context/ThemeContext";
import MaterialSymbol from "@/components/MaterialSymbol";
import { Text } from "react-native";

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof MaterialSymbol>["name"];
  color: string;
}) {
  return (
    <MaterialSymbol
      name={name}
      size={28}
      color={color}
      style={{ marginBottom: -3 }}
    />
  );
}

export default function TabLayout() {
  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];

  const palette = React.useMemo(
    () =>
      colorScheme === "dark"
        ? { tabBg: "#0f0f0f", topBorder: "#1f1f1f" }
        : { tabBg: "#ffffff", topBorder: "#e6e6e6" },
    [colorScheme],
  );

  return (
    <View style={[styles.container, { backgroundColor: C.pagebackground }]}>
      <Tabs
        screenOptions={{
          headerShown: useClientOnlyValue(false, true),
          tabBarActiveTintColor: C.tabIconSelected,
          tabBarInactiveTintColor: C.tabIconDefault,
          tabBarStyle: {
            backgroundColor: palette.tabBg,
            borderTopColor: palette.topBorder,
            height: 84,
          },
          tabBarLabelStyle: {
            fontSize: 12,
          },
        }}
      >
        <Tabs.Screen
          name='index'
          options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ color }) => <TabBarIcon name='home' color={color} />,
          }}
        />

        <Tabs.Screen
          name='two'
          options={{
            title: "Add Mood",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <TabBarIcon name='add_circle' color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name='four'
          options={{
            title: "Add Sleep",
            headerShown: false,

            tabBarIcon: ({ focused, color }) => (
              <TabBarIcon name='sleep' color={focused ? C.sleepIcon : color} />
            ),

            tabBarLabel: ({ focused, color }) => (
              <Text
                style={{
                  fontSize: 12,
                  color: focused ? C.sleepIconSelected : color,
                }}
              >
                Add Sleep
              </Text>
            ),
          }}
        />

        <Tabs.Screen
          name='three'
          options={{
            title: "Overview",
            headerShown: false,
            tabBarIcon: ({ color }) => (
              <TabBarIcon name='donut_large' color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

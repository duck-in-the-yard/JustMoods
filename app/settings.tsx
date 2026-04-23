import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Colors from "@/constants/Colors";
import { useCalendar } from "@/context/CalendarContext";
import { useAppTheme } from "@/context/ThemeContext";

const USERNAME_KEY = "@user:displayName";
const ACCENT = "#36c15c"; // ← gewünschte Switch-Farbe

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme, setColorScheme } = useAppTheme();
  const C = Colors[colorScheme];
  const { exportJson, importJson, clearAll, isLoading, savedData } = useCalendar();

  const palette = useMemo(() => {
    if (colorScheme === "dark") {
      return {
        tabsBg: "#0f0f0f", tabActiveBg: "#1e1e1e", tabInactiveText: "rgba(241,241,241,0.7)",
        cardBg: "#171717", cardBorder: "#2a2a2a", topHairline: "rgba(255,255,255,0.06)",
        inputBg: "#151515", inputBorder: "#2a2a2a", placeholder: "rgba(241,241,241,0.6)",
        secondaryBtnBg: "#151515", secondaryBtnBorder: "#2a2a2a", secondaryBtnText: C.text,
        switchOffTrack: "#3a3a3a",
      };
    }
    return {
      tabsBg: "#f0f0f0", tabActiveBg: "#ffffff", tabInactiveText: "#666666",
      cardBg: "#ffffff", cardBorder: "#e6e6e6", topHairline: "rgba(0,0,0,0.04)",
      inputBg: "#fafafa", inputBorder: "#cccccc", placeholder: "#777777",
      secondaryBtnBg: "#eef2f7", secondaryBtnBorder: "#d9dee6", secondaryBtnText: "#333333",
      switchOffTrack: "#d1d5db",
    };
  }, [colorScheme, C.text]);

  const [activeTab, setActiveTab] = useState<"data" | "user" | "display">("data");
  const [importText, setImportText] = useState("");

  // User
  const [displayName, setDisplayName] = useState("");
  const [initialNameLoaded, setInitialNameLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const n = await AsyncStorage.getItem(USERNAME_KEY);
        if (n) setDisplayName(n);
      } catch {}
      setInitialNameLoaded(true);
    })();
  }, []);

  const handleExport = async () => {
    try {
      const json = await exportJson();
      await Clipboard.setStringAsync(json);
      const path = FileSystem.cacheDirectory + "moods-export.json";
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "application/json" });
      Alert.alert("Export", "JSON kopiert und bereit zum Teilen.");
    } catch {
      Alert.alert("Fehler", "Export fehlgeschlagen.");
    }
  };

  const handleImport = async () => {
    try {
      await importJson(importText);
      Alert.alert("Import", "Daten erfolgreich importiert.");
      setImportText("");
    } catch {
      Alert.alert("Fehler", "Ungültiges JSON. Bitte prüfen.");
    }
  };

  const handleClear = async () => {
    Alert.alert("Alles löschen?", "Diese Aktion kann nicht rückgängig gemacht werden.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: async () => await clearAll() },
    ]);
  };

  const handleSaveName = async () => {
    try {
      const trimmed = displayName.trim();
      await AsyncStorage.setItem(USERNAME_KEY, trimmed);
      router.back();
    } catch {
      Alert.alert("Fehler", "Name konnte nicht gespeichert werden.");
    }
  };

  const handleClearName = async () => {
    try {
      await AsyncStorage.removeItem(USERNAME_KEY);
      setDisplayName("");
      router.back();
    } catch {
      Alert.alert("Fehler", "Konnte den Namen nicht entfernen.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.pagebackground }]}>
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeHeader}>
        <Text style={[styles.title, { color: C.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#666" }]}>
          {isLoading ? "Lade…" : `Number of days: ${Object.keys(savedData).length}`}
        </Text>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: palette.tabsBg }]}>
          {(["data", "user", "display"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && { backgroundColor: palette.tabActiveBg }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? C.text : palette.tabInactiveText },
                ]}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "data" ? (
          <>
            {/* Export */}
            <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
              <Text style={[styles.cardTitle, { color: C.text }]}>Export</Text>
              <Text style={[styles.cardText, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#555" }]}>
                Export your current data as JSON.
              </Text>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ACCENT }]} onPress={handleExport}>
                <Text style={styles.primaryBtnText}>Export</Text>
              </TouchableOpacity>
            </View>

            {/* Import */}
            <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
              <Text style={[styles.cardTitle, { color: C.text }]}>Import</Text>
              <Text style={[styles.cardText, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#555" }]}>
                Paste your JSON here and import with the button below
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: C.text },
                ]}
                placeholder='{"2025-09-22":"green"}'
                placeholderTextColor={palette.placeholder}
                value={importText}
                onChangeText={setImportText}
                multiline
              />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ACCENT }]} onPress={handleImport}>
                <Text style={styles.primaryBtnText}>Import</Text>
              </TouchableOpacity>
            </View>

            {/* Reset */}
            <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
              <Text style={[styles.cardTitle, { color: C.text }]}>Reset</Text>
              <Text style={[styles.cardText, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#555" }]}>
                Delete all data
              </Text>
              <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: "#e74c3c" }]} onPress={handleClear}>
                <Text style={styles.dangerBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : activeTab === "user" ? (
          <>
            {/* USER SETTINGS */}
            <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
              <Text style={[styles.cardTitle, { color: C.text }]}>Display name</Text>
              <Text style={[styles.cardText, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#555" }]}>
                This name will be displayed on the home page.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: palette.inputBg, borderColor: palette.inputBorder, color: C.text },
                ]}
                placeholder="Your name"
                placeholderTextColor={palette.placeholder}
                value={displayName}
                onChangeText={setDisplayName}
                editable={initialNameLoaded}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity style={[styles.primaryBtn, { flex: 1, backgroundColor: ACCENT }]} onPress={handleSaveName}>
                  <Text style={styles.primaryBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    { flex: 1, backgroundColor: palette.secondaryBtnBg, borderColor: palette.secondaryBtnBorder },
                  ]}
                  onPress={handleClearName}
                >
                  <Text style={[styles.secondaryBtnText, { color: palette.secondaryBtnText }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* DISPLAY SETTINGS */}
            <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.topHairline, { backgroundColor: palette.topHairline }]} />
              <Text style={[styles.cardTitle, { color: C.text }]}>Theme</Text>
              <Text style={[styles.cardText, { color: colorScheme === "dark" ? "rgba(241,241,241,0.7)" : "#555" }]}>
                Switch between light and dark mode. The choice persists across restarts.
              </Text>

              <View style={styles.rowBetween}>
                <Text style={{ fontWeight: "600", color: C.text }}>
                  Dark mode ({colorScheme === "dark" ? "ON" : "OFF"})
                </Text>

                {/* ✅ Custom colored switch */}
                <Switch
                  value={colorScheme === "dark"}
                  onValueChange={(v) => setColorScheme(v ? "dark" : "light")}
                  trackColor={{ false: palette.switchOffTrack, true: ACCENT }}
                  thumbColor={"#299345ff"}
                  ios_backgroundColor={palette.switchOffTrack}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  safeHeader: { paddingTop: 4, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { marginTop: 4 },

  tabs: { flexDirection: "row", gap: 8, marginTop: 16, padding: 4, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabText: { fontWeight: "600" },

  content: { paddingBottom: 32 },

  card: {
    marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1,
    position: "relative", overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14, elevation: 6,
  },
  topHairline: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },

  cardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  cardText: { marginBottom: 12 },

  textArea: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },

  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  primaryBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "white", fontWeight: "bold" },

  secondaryBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  secondaryBtnText: { fontWeight: "bold" },

  dangerBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  dangerBtnText: { color: "white", fontWeight: "bold" },
});

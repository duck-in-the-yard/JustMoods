import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/Colors";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import Calendar from "@/components/Calendar";
import { useAppTheme } from "@/context/ThemeContext";

const { width, height } = Dimensions.get("window");

// Speicher-Keys
const USERNAME_KEY = "@user:displayName";
const TASKS_KEY = "@tasks_data";

// Kleiner Helfer für die Hintergrundfarben
const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function TabOneScreen() {
  const router = useRouter();
  const { colorScheme } = useAppTheme();
  const C = Colors[colorScheme];

  // Lokaler State für Name und Tasks
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tasks, setTasks] = useState([
    { id: 1, text: "Physical Win", checked: false },
    { id: 2, text: "Mental Win", checked: false },
    { id: 3, text: "Personal Win", checked: false },
  ]);

  // Farben berechnen
  const palette = useMemo(() => {
    const checkedBg = hexToRgba(C.green, colorScheme === "dark" ? 0.20 : 0.12);
    if (colorScheme === "dark") {
      return {
        rowBg: "#171717",
        rowBorder: "#2a2a2a",
        rowCheckedBg: checkedBg,
        checkBorder: "#3a3a3a",
      };
    }
    return {
      rowBg: "#ffffff",
      rowBorder: "#dddddd",
      rowCheckedBg: "#8fdfa4ff",
      checkBorder: "#bbbbbb",
    };
  }, [colorScheme, C.green]);

  // KOMBINIERTES LADEN: Name & Tasks
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      const loadInitialData = async () => {
        try {
          // 1. Name laden
          const savedName = await AsyncStorage.getItem(USERNAME_KEY);
          if (!cancelled) setDisplayName(savedName ?? null);

          // 2. Tasks laden
          const savedData = await AsyncStorage.getItem(TASKS_KEY);
          if (savedData && !cancelled) {
            const { date, savedTasks } = JSON.parse(savedData);
            const todayStr = new Date().toLocaleDateString();

            // Check: Ist es noch derselbe Tag?
            if (date === todayStr) {
              setTasks(savedTasks);
            } else {
              // Neuer Tag -> Wir bleiben bei den Standard-Tasks (unchecked)
              console.log("Neuer Tag erkannt - Tasks zurückgesetzt.");
            }
          }
        } catch (e) {
          console.error("Fehler beim Laden der Daten", e);
        }
      };

      loadInitialData();
      return () => { cancelled = true; };
    }, [])
  );

  // TASK TOGGLE & SPEICHERN
  const toggleTask = async (id: number) => {
    const newTasks = tasks.map((t) =>
      t.id === id ? { ...t, checked: !t.checked } : t
    );
    
    setTasks(newTasks);

    // Persistenz: Speichern mit aktuellem Datum
    try {
      const dataToSave = {
        date: new Date().toLocaleDateString(),
        savedTasks: newTasks,
      };
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Fehler beim Speichern der Tasks", e);
    }
  };

  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const greeting = `Hello, ${displayName?.trim()?.length ? displayName : "User"}!`;

  return (
    <View style={[styles.container, { backgroundColor: C.pagebackground }]}>
      {/* HEADER */}
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeHeader, { backgroundColor: C.pagebackground }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.dateText, { color: C.text }]}>{formattedDate}</Text>
            <Text style={[styles.greetingText, { color: C.text }]}>{greeting}</Text>
          </View>

          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push("/settings")}
          >
            <MaterialIcons name="settings" size={28} color={C.tint} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* KALENDER KOMPONENTE */}
      <Calendar />

      {/* TASKS SEKTION */}
      <View style={styles.tasksSection}>
        <View style={styles.tasksTitleContainer}>
          <Text style={[styles.tasksTitle, { color: C.text }]}>Daily Tasks</Text>
        </View>

        <ScrollView 
          contentContainerStyle={styles.tasksScrollContent} 
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tasksContainer}>
            {tasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                activeOpacity={0.8}
                style={[
                  styles.taskItem,
                  {
                    backgroundColor: task.checked ? palette.rowCheckedBg : palette.rowBg,
                    borderColor: task.checked ? "transparent" : palette.rowBorder,
                  },
                ]}
                onPress={() => toggleTask(task.id)}
              >
                <Text style={[styles.taskText, { color: C.text }]}>{task.text}</Text>

                <View
                  style={[
                    styles.checkCircle,
                    task.checked
                      ? { backgroundColor: Colors[colorScheme].green, borderColor: "transparent" }
                      : { backgroundColor: "transparent", borderColor: palette.checkBorder },
                  ]}
                >
                  {task.checked ? <MaterialIcons name="check" size={20} color="#fff" /> : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: width * 0.05 },
  safeHeader: { width: "100%" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: height * 0.008,
  },
  headerLeft: { flexShrink: 1 },
  settingsBtn: { padding: 8, marginBottom: 40, borderRadius: 20 },
  dateText: { fontSize: width < 375 ? 16 : 20, fontWeight: "bold" },
  greetingText: { fontSize: width < 375 ? 32 : 42, fontWeight: "bold" },

  tasksSection: { marginTop: height * 0.03, flex: 1 },
  tasksTitleContainer: { marginBottom: height * 0.015, paddingHorizontal: 4 },
  tasksTitle: { fontSize: width < 375 ? 24 : 34, fontWeight: "bold" },

  tasksScrollContent: { paddingBottom: height * 0.05 },
  tasksContainer: { width: "100%" },

  taskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.05,
    marginBottom: height * 0.018,
    borderRadius: 24,
    borderWidth: 1,
  
  },
  taskText: { fontSize: width < 375 ? 18 : 22, fontWeight: "600", flex: 1 },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
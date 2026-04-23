// @/app/CalendarContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DotColor = "gray" | "red" | "yellow" | "green" | "orange" | "blue";

type CalendarContextValue = {
  savedData: Record<string, DotColor>;               // z.B. { "2025-09-22": "green" }
  addEntry: (dateISO: string, color: DotColor) => Promise<void>;
  exportJson: () => Promise<string>;                 // für Export
  importJson: (json: string) => Promise<void>;       // für Import
  clearAll: () => Promise<void>;                     // alles löschen
  isLoading: boolean;                                // true, solange initial geladen wird
};

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

// Schlüssel, unter dem wir in AsyncStorage speichern
const STORAGE_KEY = "@moods:v1";

// winzige Helfer
const isValidColor = (c: string): c is DotColor =>
  ["gray", "red", "yellow", "green", "orange", "blue"].includes(c);

export const CalendarProvider = ({ children }: { children: ReactNode }) => {
  const [savedData, setSavedData] = useState<Record<string, DotColor>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 1) Beim Start einmal aus AsyncStorage laden
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as Record<string, unknown>;
          // defensive: nur gültige Farben übernehmen
          const cleaned: Record<string, DotColor> = {};
          Object.entries(obj).forEach(([k, v]) => {
            if (typeof v === "string" && isValidColor(v)) cleaned[k] = v;
          });
          setSavedData(cleaned);
        }
      } catch (e) {
        console.warn("Failed to load moods:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // kleine Hilfsfunktion: Zustand setzen + in AsyncStorage schreiben
  const setAndPersist = async (next: Record<string, DotColor>) => {
    setSavedData(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to persist moods:", e);
    }
  };

  // 2) Eintrag hinzufügen/überschreiben
  const addEntry = async (dateISO: string, color: DotColor) => {
    // Erwartet Format YYYY-MM-DD – du gibst uns das bereits so
    const next = { ...savedData, [dateISO]: color };
    await setAndPersist(next);
  };

  // 3) Export: gib JSON-String zurück
  const exportJson = async () => {
    // immer den aktuellen Stand aus dem State exportieren
    return JSON.stringify(savedData, null, 2);
  };

  // 4) Import: JSON-String annehmen, validieren, speichern
  const importJson = async (json: string) => {
    try {
      const obj = JSON.parse(json) as Record<string, unknown>;
      const cleaned: Record<string, DotColor> = {};
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v === "string" && isValidColor(v)) cleaned[k] = v;
      });
      await setAndPersist(cleaned);
    } catch (e) {
      console.warn("Import failed (invalid JSON?)", e);
      throw e;
    }
  };

  // 5) Alles löschen
  const clearAll = async () => {
    await setAndPersist({});
  };

  const value = useMemo(
    () => ({ savedData, addEntry, exportJson, importJson, clearAll, isLoading }),
    [savedData, isLoading]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
};

export const useCalendar = () => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within a CalendarProvider");
  return ctx;
};

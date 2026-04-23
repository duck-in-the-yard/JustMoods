// app/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type ColorScheme = "light" | "dark";
const THEME_KEY = "@ui:theme";

type Ctx = {
  colorScheme: ColorScheme;
  setColorScheme: (mode: ColorScheme) => Promise<void>;
  isReady: boolean;
};

const ThemeCtx = createContext<Ctx | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (stored === "light" || stored === "dark") {
          setColorSchemeState(stored);
        } else {
          const sys = Appearance.getColorScheme();
          setColorSchemeState(sys === "dark" ? "dark" : "light");
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setColorScheme = async (mode: ColorScheme) => {
    setColorSchemeState(mode);
    try { await AsyncStorage.setItem(THEME_KEY, mode); } catch {}
  };

  return (
    <ThemeCtx.Provider value={{ colorScheme, setColorScheme, isReady }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export const useAppTheme = () => {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useAppTheme must be used within AppThemeProvider");
  return ctx;
};

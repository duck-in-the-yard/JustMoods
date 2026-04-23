// app/_layout.tsx
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar'; 
import 'react-native-reanimated';

// Deine Provider
import { CalendarProvider } from '@/context/CalendarContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
// Notification Service Import
import { NotificationService } from '@/services/NotificationService'; 

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      
      // Benachrichtigungen initialisieren
      const setupNotifications = async () => {
        const hasPermission = await NotificationService.requestPermissions();
        if (hasPermission) {
          await NotificationService.scheduleDailyReminder();
        }
      };
      
      setupNotifications();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <ThemeBridge />
    </AppThemeProvider>
  );
}

function ThemeBridge() {
  const { colorScheme } = useAppTheme(); // "light" | "dark"

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Erzwingt den Kontrast: 
          Dunkles Theme -> helle Icons (light)
          Helles Theme -> dunkle Icons (dark) 
      */}
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} /> 
      
      <CalendarProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </CalendarProvider>
    </ThemeProvider>
  );
}
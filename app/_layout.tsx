import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CalendarProvider } from '@/context/CalendarContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { NotificationService } from '@/services/NotificationService';

const getTodayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

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
    if (!loaded) return;

    SplashScreen.hideAsync();

    const setupNotifications = async () => {
      try {
        const savedMoods = await AsyncStorage.getItem('@calendar_moods');
        const today = getTodayISO();

        const hasTrackedToday = !!savedMoods && savedMoods.includes(today);

        await NotificationService.scheduleMoodReminder(hasTrackedToday);

        if (hasTrackedToday) {
          console.log('Check: Heute bereits geloggt. Reminder auf morgen geplant.');
        } else {
          console.log('Check: Heute noch nicht geloggt. Reminder für nächste 18:00 geplant.');
        }
      } catch (e) {
        console.log('Notification setup error:', e);
        await NotificationService.scheduleMoodReminder(false);
      }
    };

    setupNotifications();
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
  const { colorScheme } = useAppTheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
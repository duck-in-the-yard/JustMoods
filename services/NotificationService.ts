import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOOD_REMINDER_ID_KEY = 'moodReminderNotificationId';
const SLEEP_REMINDER_ID_KEY = 'sleepReminderNotificationId';

export const SLEEP_STORAGE_KEY = '@sleep_entries_v1';

const ANDROID_CHANNEL_ID = 'daily-reminders';

const MOOD_REMINDER_HOUR = 18;
const MOOD_REMINDER_MINUTE = 0;

const SLEEP_REMINDER_HOUR = 7;
const SLEEP_REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns the next Date at which a reminder should fire.
 *
 * Rules:
 * - If the user has NOT tracked today AND the reminder time hasn't passed yet
 *   → fire today at reminderHour:reminderMinute
 * - In every other case (already tracked OR time already passed)
 *   → fire tomorrow at reminderHour:reminderMinute
 *
 * This fixes the sleep-notification bug: the old code could return a date
 * that was already in the past (e.g. app opened at 09:00, reminder set for
 * 07:00 → Expo silently drops a past-date trigger and the notification never
 * fires). By always jumping to tomorrow when the window has passed we
 * guarantee the trigger date is always in the future.
 */
function getNextReminderDate(
  hasTrackedToday: boolean,
  reminderHour: number,
  reminderMinute: number
): Date {
  const now = new Date();

  const candidate = new Date();
  candidate.setHours(reminderHour, reminderMinute, 0, 0);

  const timeHasPassed = now >= candidate;

  if (hasTrackedToday || timeHasPassed) {
    // Push to tomorrow
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

async function setupAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function cancelStoredMoodReminder() {
  const existingId = await AsyncStorage.getItem(MOOD_REMINDER_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(MOOD_REMINDER_ID_KEY);
  }
}

async function cancelStoredSleepReminder() {
  const existingId = await AsyncStorage.getItem(SLEEP_REMINDER_ID_KEY);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(SLEEP_REMINDER_ID_KEY);
  }
}

async function hasTrackedSleepToday(): Promise<boolean> {
  try {
    const today = getTodayISO();
    const raw = await AsyncStorage.getItem(SLEEP_STORAGE_KEY);
    const sleepEntries = raw ? JSON.parse(raw) : {};
    return Boolean(sleepEntries?.[today]);
  } catch (error) {
    console.warn('Could not read sleep data:', error);
    return false;
  }
}

export const NotificationService = {
  requestPermissions: async (): Promise<boolean> => {
    if (!Device.isDevice) {
      console.log('Notifications only work on real devices.');
      return false;
    }

    await setupAndroidNotificationChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied.');
      return false;
    }

    return true;
  },

  scheduleMoodReminder: async (hasTrackedToday: boolean) => {
    const hasPermission = await NotificationService.requestPermissions();
    if (!hasPermission) return null;

    await cancelStoredMoodReminder();

    const reminderDate = getNextReminderDate(
      hasTrackedToday,
      MOOD_REMINDER_HOUR,
      MOOD_REMINDER_MINUTE
    );

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'How was your day? 🌿',
        body: "Don't forget to log your mood for today.",
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: ANDROID_CHANNEL_ID,
      },
    });

    await AsyncStorage.setItem(MOOD_REMINDER_ID_KEY, notificationId);
    console.log('Mood reminder scheduled:', reminderDate.toString());
    return notificationId;
  },

  scheduleSleepReminder: async () => {
    const hasPermission = await NotificationService.requestPermissions();
    if (!hasPermission) return null;

    await cancelStoredSleepReminder();

    // Check AFTER cancelling the old one so there's no gap
    const trackedToday = await hasTrackedSleepToday();

    const reminderDate = getNextReminderDate(
      trackedToday,
      SLEEP_REMINDER_HOUR,
      SLEEP_REMINDER_MINUTE
    );

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Track your sleep 😴',
        body: "Good morning! Don't forget to log your sleep.",
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: ANDROID_CHANNEL_ID,
      },
    });

    await AsyncStorage.setItem(SLEEP_REMINDER_ID_KEY, notificationId);
    console.log('Sleep reminder scheduled:', reminderDate.toString(), '| tracked today:', trackedToday);
    return notificationId;
  },

  rescheduleAfterMoodTracked: async () => {
    await NotificationService.scheduleMoodReminder(true);
    console.log('Mood tracked today — reminder moved to tomorrow.');
  },

  // Called by AddSleepScreen after a successful save
  rescheduleAfterSleepTracked: async () => {
    // At this point AsyncStorage already has today's entry, so
    // hasTrackedSleepToday() will return true → date jumps to tomorrow.
    await NotificationService.scheduleSleepReminder();
    console.log('Sleep tracked today — reminder moved to tomorrow.');
  },

  cancelMoodReminder: async () => {
    await cancelStoredMoodReminder();
    console.log('Mood reminder cancelled.');
  },

  cancelSleepReminder: async () => {
    await cancelStoredSleepReminder();
    console.log('Sleep reminder cancelled.');
  },

  cancelAllReminders: async () => {
    await cancelStoredMoodReminder();
    await cancelStoredSleepReminder();
    console.log('All reminders cancelled.');
  },

  getScheduledNotifications: async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Scheduled notifications:', scheduled);
    return scheduled;
  },

  getTodayISO,
  hasTrackedSleepToday,
};

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MOOD_REMINDER_ID_KEY = 'moodReminderNotificationId';
const ANDROID_CHANNEL_ID = 'daily-reminders';

const REMINDER_HOUR = 18;
const REMINDER_MINUTE = 0;

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

function getNextReminderDate(hasTrackedToday: boolean) {
  const now = new Date();

  const reminderDate = new Date();
  reminderDate.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);

  const reminderTimeAlreadyPassed = now >= reminderDate;

  if (hasTrackedToday || reminderTimeAlreadyPassed) {
    reminderDate.setDate(reminderDate.getDate() + 1);
  }

  return reminderDate;
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

export const NotificationService = {
  requestPermissions: async () => {
    if (!Device.isDevice) {
      console.log('Notifications funktionieren nur auf echten Geräten.');
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
      console.log('Notification permission nicht erteilt.');
      return false;
    }

    return true;
  },

  scheduleMoodReminder: async (hasTrackedToday: boolean) => {
    const hasPermission = await NotificationService.requestPermissions();

    if (!hasPermission) {
      return null;
    }

    await cancelStoredMoodReminder();

    const reminderDate = getNextReminderDate(hasTrackedToday);

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

    console.log('Mood Reminder geplant:', notificationId);
    console.log('Reminder Datum:', reminderDate.toString());

    return notificationId;
  },

  rescheduleAfterMoodTracked: async () => {
    await NotificationService.scheduleMoodReminder(true);
    console.log('Mood heute getrackt. Reminder auf morgen verschoben.');
  },

  cancelMoodReminder: async () => {
    await cancelStoredMoodReminder();
    console.log('Mood Reminder deaktiviert.');
  },

  getScheduledNotifications: async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Scheduled notifications:', scheduled);
    return scheduled;
  },

  getTodayISO,
};
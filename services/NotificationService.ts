import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// 1. Der Handler: Jetzt mit allen Feldern, die TypeScript verlangt
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Diese beiden fehlten und haben den Fehler verursacht:
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  // 2. Berechtigungen anfragen
  requestPermissions: async () => {
    if (!Device.isDevice) {
      console.log('Notifications funktionieren nur auf echten Geräten.');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  },

  // 3. Täglich um 18:00 Uhr planen
  scheduleDailyReminder: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Stabiler Trigger für tägliche Reminders
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "How was your day? 🌿",
        body: "Don't forget to log your mood for today.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 18,
        minute: 0,
      },
    });

    console.log("Reminder für 18:00 Uhr geplant.");
  },

  // 4. Alles löschen
  cancelAll: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
};
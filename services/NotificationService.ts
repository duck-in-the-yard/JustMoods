import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Konfiguration: Wie reagiert die App, wenn sie offen ist?
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  // 1. Berechtigungen anfragen
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

  // 2. Täglich um 18:00 Uhr planen
  scheduleDailyReminder: async () => {
    // Zuerst alle alten löschen
    await Notifications.cancelAllScheduledNotificationsAsync();

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

  // 3. Nur löschen (für heute erledigt)
  cancelForToday: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("Reminder für heute deaktiviert.");
  },

  // Alles löschen
  cancelAll: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
};
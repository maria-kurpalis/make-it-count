import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Use a valid 24-hour time such as 08:30.');
  }
  return { hour, minute };
}

export async function configureNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily encouragement',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }
  return true;
}

async function scheduleDaily(title: string, body: string, time: string, data: Record<string, unknown>) {
  const { hour, minute } = parseTime(time);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'daily',
    },
  });
}

export async function rescheduleNotifications(planningTime: string, reviewTime: string, diaryEnabled: boolean, diaryTime: string) {
  const granted = await configureNotifications();
  if (!granted) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await scheduleDaily('Plan your day', 'What promises do you want to keep today?', planningTime, { screen: 'today' });
  await scheduleDaily('Check in with yourself', 'Celebrate what worked and reflect on what got in the way.', reviewTime, { screen: 'today' });
  if (diaryEnabled) {
    await scheduleDaily('A few words for today', 'Even two lines are enough. This space is yours.', diaryTime, { screen: 'diary' });
  }
  return true;
}

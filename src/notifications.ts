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
    if (requested.status !== 'granted') return false;
  }
  await Notifications.setNotificationCategoryAsync('DAILY_REMINDER', [
    { identifier: 'SNOOZE_15', buttonTitle: 'In 15 minutes', options: { opensAppToForeground: false } },
    { identifier: 'SKIP_TODAY', buttonTitle: 'Skip today', options: { opensAppToForeground: false } },
  ]);
  return true;
}

async function scheduleDaily(title: string, body: string, time: string, data: Record<string, unknown>) {
  const { hour, minute } = parseTime(time);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true, categoryIdentifier: 'DAILY_REMINDER' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'daily',
    },
  });
}

export async function snoozeForFifteenMinutes() {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'A gentle reminder', body: 'Your goals are waiting when you are ready.', sound: true, categoryIdentifier: 'DAILY_REMINDER' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 15 * 60 },
  });
}

export async function scheduleGoalReminder(goalId: string, goalTitle: string, kind: 'do' | 'dont', intervalMinutes: number) {
  const granted = await configureNotifications();
  if (!granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: kind === 'do' ? 'A promise is waiting' : 'Stay true to your intention',
      body: goalTitle,
      data: { screen: 'today', reminderType: 'goal', goalId },
      sound: true,
      categoryIdentifier: 'DAILY_REMINDER',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: intervalMinutes * 60,
      repeats: true,
      channelId: 'daily',
    },
  });
}

export async function cancelGoalReminder(notificationId?: string) {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function rescheduleNotifications(planningTime: string, reviewTime: string, diaryEnabled: boolean, diaryTime: string) {
  const granted = await configureNotifications();
  if (!granted) return false;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((notification) => notification.content.data?.reminderType !== 'goal')
    .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  await scheduleDaily('Plan your day', 'What promises do you want to keep today?', planningTime, { screen: 'today', reminderType: 'routine' });
  await scheduleDaily('Check in with yourself', 'Celebrate what worked and reflect on what got in the way.', reviewTime, { screen: 'today', reminderType: 'routine' });
  if (diaryEnabled) {
    await scheduleDaily('A few words for today', 'Even two lines are enough. This space is yours.', diaryTime, { screen: 'diary', reminderType: 'routine' });
  }
  return true;
}

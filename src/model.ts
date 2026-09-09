export type GoalKind = 'do' | 'dont';
export type GoalStatus = 'pending' | 'achieved' | 'failed';

export type Goal = {
  id: string;
  title: string;
  kind: GoalKind;
  status: GoalStatus;
  failureReason?: string;
  reminderIntervalMinutes?: number;
  notificationId?: string;
  reminderStartedAt?: string;
};

export type DayRecord = {
  date: string;
  motivation: string;
  goals: Goal[];
  diary?: string;
  diaryEntries?: DiaryEntry[];
  diaryDraft?: string;
};

export type DiaryEntry = { id: string; text: string; savedAt?: string };

// Older diary text has a known day, but no reliable time. Preserve it honestly.
export function diaryEntries(record: DayRecord): DiaryEntry[] {
  return record.diaryEntries ?? (record.diary?.trim() ? [{ id: `legacy-${record.date}`, text: record.diary }] : []);
}

export type AppSettings = {
  onboarded: boolean;
  planningTime: string;
  reviewTime: string;
  diaryEnabled: boolean;
  diaryTime: string;
};

export type AppData = {
  settings: AppSettings;
  records: Record<string, DayRecord>;
};

export const initialData: AppData = {
  settings: {
    onboarded: false,
    planningTime: '08:00',
    reviewTime: '21:00',
    diaryEnabled: true,
    diaryTime: '21:15',
  },
  records: {},
};

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(key: string, amount: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function emptyRecord(date: string): DayRecord {
  return { date, motivation: '', goals: [], diary: '' };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, initialData } from './model';

const STORAGE_KEY = '@momentum-daily/data-v1';

export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      settings: { ...initialData.settings, ...parsed.settings },
      records: parsed.records ?? {},
    };
  } catch {
    return initialData;
  }
}

export async function saveData(data: AppData) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

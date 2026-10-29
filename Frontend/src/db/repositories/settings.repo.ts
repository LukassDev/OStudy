import { getDatabase } from '../client';
import { nowIso } from '../ids';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch (error) {
    console.error(`Invalid local setting "${key}"`, error);
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key, JSON.stringify(value), nowIso(),
  );
}

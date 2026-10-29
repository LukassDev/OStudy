import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './migrations';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await openDatabaseAsync('orenstudy.db');
      try {
        await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
        await migrateDatabase(database);
        return database;
      } catch (error) {
        await database.closeAsync();
        throw error;
      }
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  const current = databasePromise;
  databasePromise = null;
  if (current) await (await current).closeAsync();
}

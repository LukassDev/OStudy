import { backupDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './migrations';

const DATABASE_NAME = 'ostudy.db';
const LEGACY_DATABASE_NAME = 'orenstudy.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await openDatabaseAsync(DATABASE_NAME);
      try {
        const currentVersion = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if (!currentVersion?.user_version) {
          const legacyDatabase = await openDatabaseAsync(LEGACY_DATABASE_NAME);
          try {
            const legacyVersion = await legacyDatabase.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
            if (legacyVersion?.user_version) {
              await backupDatabaseAsync({ sourceDatabase: legacyDatabase, destDatabase: database });
            }
          } finally {
            await legacyDatabase.closeAsync();
          }
        }
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

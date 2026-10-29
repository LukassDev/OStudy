import type { SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_VERSION, INITIAL_SCHEMA } from './schema';

const REQUIRED_TABLES = [
  'profile', 'spaces', 'active_spaces', 'content_topics', 'chats', 'messages',
  'resources', 'calendar_events', 'grades', 'student_model', 'topic_knowledge',
  'episodic_memory', 'semantic_memory', 'safety_log', 'settings', 'timetable_classes',
];

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const { user_version: currentVersion } = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  ) ?? { user_version: 0 };

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `A base de dados está na versão ${currentVersion}, mais recente do que a versão suportada (${DATABASE_VERSION}). Atualize a aplicação.`,
    );
  }

  const existingTables = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const existingTableNames = new Set(existingTables.map(table => table.name));
  const missingTables = REQUIRED_TABLES.filter(table => !existingTableNames.has(table));

  if (currentVersion < DATABASE_VERSION || missingTables.length > 0) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(INITIAL_SCHEMA);
      await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  }

  const repairedTables = await database.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const repairedNames = new Set(repairedTables.map(table => table.name));
  const stillMissing = REQUIRED_TABLES.filter(table => !repairedNames.has(table));
  if (stillMissing.length > 0) {
    throw new Error(`A base local está incompleta. Tabelas em falta: ${stillMissing.join(', ')}.`);
  }
}

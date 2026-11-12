import type { SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_VERSION, INITIAL_SCHEMA } from './schema';

const REQUIRED_TABLES = [
  'profile', 'spaces', 'active_spaces', 'content_topics', 'chats', 'messages',
  'resources', 'calendar_events', 'classroom_ignored_events', 'grades', 'grade_modules', 'student_model', 'topic_knowledge',
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
      const spaceColumns = await database.getAllAsync<{ name: string }>(
        'PRAGMA table_info("spaces")',
      );
      if (!spaceColumns.some(column => column.name === 'google_classroom_course_id')) {
        await database.execAsync('ALTER TABLE spaces ADD COLUMN google_classroom_course_id TEXT');
      }
      const gradeColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info("grades")');
      if (!gradeColumns.some(column => column.name === 'module_id')) {
        await database.execAsync('ALTER TABLE grades ADD COLUMN module_id TEXT REFERENCES grade_modules(id) ON DELETE SET NULL');
      }
      if (!gradeColumns.some(column => column.name === 'category_id')) {
        await database.execAsync('ALTER TABLE grades ADD COLUMN category_id TEXT');
      }
      if (!gradeColumns.some(column => column.name === 'qualitative_value')) {
        await database.execAsync('ALTER TABLE grades ADD COLUMN qualitative_value TEXT');
      }
      const moduleColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info("grade_modules")');
      for (const column of ['behavior_qualitative', 'participation_qualitative']) {
        if (!moduleColumns.some(existing => existing.name === column)) {
          await database.execAsync(`ALTER TABLE grade_modules ADD COLUMN ${column} TEXT`);
        }
      }
      if (currentVersion < 5) {
        // Earlier estimates used a fixed conversion; align them with the midpoint defaults.
        const cases = "WHEN 'very_insufficient' THEN 2 WHEN 'insufficient' THEN 7 WHEN 'sufficient' THEN 12 WHEN 'good' THEN 16 WHEN 'very_good' THEN 19";
        await database.execAsync(`UPDATE grades SET score = (CASE qualitative_value ${cases} ELSE score / max_score * 20 END) / 20.0 * max_score WHERE qualitative_value IS NOT NULL`);
        for (const type of ['behavior', 'participation']) {
          await database.execAsync(`UPDATE grade_modules SET ${type}_score = CASE ${type}_qualitative ${cases} ELSE ${type}_score END WHERE ${type}_qualitative IS NOT NULL`);
        }
      }
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

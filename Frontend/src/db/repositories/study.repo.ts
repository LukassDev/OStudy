import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';
import { getSetting, setSetting } from './settings.repo';

export interface LocalLesson {
  id: string;
  space_id: string | null;
  title: string;
  room: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string;
}

export async function listLessons(): Promise<LocalLesson[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalLesson>(
    'SELECT * FROM timetable_classes ORDER BY weekday, start_time, id',
  );
}

export async function saveLessons(lessons: Omit<LocalLesson, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.withTransactionAsync(async () => {
    for (const lesson of lessons) {
      await database.runAsync(
        `INSERT INTO timetable_classes
          (id, space_id, title, room, weekday, start_time, end_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId(), lesson.space_id, lesson.title, lesson.room, lesson.weekday, lesson.start_time,
        lesson.end_time, timestamp, timestamp,
      );
    }
  });
}

export async function updateLesson(lesson: LocalLesson): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE timetable_classes SET space_id = ?, title = ?, room = ?, weekday = ?, start_time = ?,
     end_time = ?, updated_at = ? WHERE id = ?`,
    lesson.space_id, lesson.title, lesson.room, lesson.weekday, lesson.start_time, lesson.end_time,
    nowIso(), lesson.id,
  );
}

export async function deleteLesson(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM timetable_classes WHERE id = ?', id);
}

export async function getStudyPreferences<T>(fallback: T): Promise<T> {
  return getSetting('study.preferences', fallback);
}

export async function saveStudyPreferences(value: unknown): Promise<void> {
  await setSetting('study.preferences', value);
}

export async function getStudentGoal(spaceId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ goal: string | null }>(
    'SELECT goal FROM student_model WHERE space_id = ?', spaceId,
  );
  return row?.goal ?? null;
}

export async function saveStudentGoal(spaceId: string, goal: string | null): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO student_model (space_id, goal, model_json, created_at, updated_at)
     VALUES (?, ?, '{}', ?, ?)
     ON CONFLICT(space_id) DO UPDATE SET goal = excluded.goal, updated_at = excluded.updated_at`,
    spaceId, goal, timestamp, timestamp,
  );
}

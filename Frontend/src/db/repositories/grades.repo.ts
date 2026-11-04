import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface GradeRow {
  id: string;
  space_id: string;
  title: string;
  score: number;
  max_score: number;
  weight: number;
  topic_id: string | null;
  graded_at: string;
  created_at: string;
  updated_at: string;
}

export async function listGrades(spaceId: string): Promise<GradeRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<GradeRow>(
    'SELECT * FROM grades WHERE space_id = ? ORDER BY created_at, id',
    spaceId,
  );
}

export async function listAllGrades(): Promise<GradeRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<GradeRow>('SELECT * FROM grades ORDER BY created_at, id');
}

export async function createGrade(data: Omit<GradeRow, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO grades (id, space_id, title, score, max_score, weight, topic_id, graded_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId(), data.space_id, data.title, data.score, data.max_score, data.weight, data.topic_id, data.graded_at,
    timestamp, timestamp,
  );
}

export async function updateGrade(id: string, spaceId: string, changes: Partial<GradeRow>): Promise<void> {
  const fields: (keyof GradeRow)[] = ['title', 'score', 'max_score', 'weight', 'topic_id', 'graded_at'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const database = await getDatabase();
  const assignments = updates.map((field) => `${field} = ?`);
  const values = updates.map((field) => changes[field] ?? null);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id, spaceId);
  await database.runAsync(
    `UPDATE grades SET ${assignments.join(', ')} WHERE id = ? AND space_id = ?`,
    ...values,
  );
}

export async function deleteGrade(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM grades WHERE id = ? AND space_id = ?', id, spaceId);
}

import { getDatabase } from '../../db/client';
import { nowIso } from '../../db/ids';

export interface LocalStudentModel {
  goal: string | null;
  model_json: string;
}

export async function readStudentModel(spaceId: string): Promise<LocalStudentModel | null> {
  const database = await getDatabase();
  return database.getFirstAsync<LocalStudentModel>(
    'SELECT goal, model_json FROM student_model WHERE space_id = ?',
    spaceId,
  );
}

export async function rememberExplicitStudyGoal(spaceId: string, message: string): Promise<void> {
  const match = message.match(/(?:my goal is|my study goal is|o meu objetivo(?: de estudo)? é|minha meta(?: de estudo)? é)\s+(.{3,300})/i);
  if (!match) return;
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO student_model (space_id, goal, model_json, created_at, updated_at)
     VALUES (?, ?, '{}', ?, ?)
     ON CONFLICT(space_id) DO UPDATE SET goal = excluded.goal, updated_at = excluded.updated_at`,
    spaceId, match[1].trim(), timestamp, timestamp,
  );
}

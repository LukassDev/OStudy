import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface ContentTopicRow {
  id: string;
  space_id: string;
  parent_id: string | null;
  title: string;
  summary: string | null;
  importance: string;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listContentTopics(spaceId: string): Promise<ContentTopicRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<ContentTopicRow>(
    'SELECT * FROM content_topics WHERE space_id = ? ORDER BY created_at, id',
    spaceId,
  );
}

export async function listPlanModules(spaceId: string): Promise<ContentTopicRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<ContentTopicRow>(
    `SELECT * FROM content_topics
     WHERE space_id = ? AND importance = 'high' AND parent_id IS NULL
     ORDER BY created_at, id`,
    spaceId,
  );
}

export async function createContentTopic(data: Partial<ContentTopicRow> & { space_id: string; title: string }): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO content_topics (id, space_id, parent_id, title, summary, importance, last_reviewed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.id || createId(), data.space_id, data.parent_id ?? null, data.title, data.summary ?? null,
    data.importance ?? 'medium', data.last_reviewed_at ?? null, timestamp, timestamp,
  );
}

export async function updateContentTopic(id: string, spaceId: string, changes: Partial<ContentTopicRow>): Promise<void> {
  const fields: (keyof ContentTopicRow)[] = ['parent_id', 'title', 'summary', 'importance', 'last_reviewed_at'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const database = await getDatabase();
  const assignments = updates.map((field) => `${field} = ?`);
  const values = updates.map((field) => changes[field] ?? null);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id, spaceId);
  await database.runAsync(
    `UPDATE content_topics SET ${assignments.join(', ')} WHERE id = ? AND space_id = ?`,
    ...values,
  );
}

export async function toggleContentTopicReviewed(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  const topic = await database.getFirstAsync<{ last_reviewed_at: string | null }>(
    'SELECT last_reviewed_at FROM content_topics WHERE id = ? AND space_id = ?',
    id,
    spaceId,
  );
  if (!topic) throw new Error('O tópico não pertence a este Space.');
  const timestamp = nowIso();
  await database.runAsync(
    'UPDATE content_topics SET last_reviewed_at = ?, updated_at = ? WHERE id = ? AND space_id = ?',
    topic.last_reviewed_at ? null : timestamp,
    timestamp,
    id,
    spaceId,
  );
}

export async function updateTopicReviews(spaceId: string, changes: Map<string, string | null>): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.withTransactionAsync(async () => {
    for (const [id, reviewedAt] of changes) {
      await database.runAsync(
        'UPDATE content_topics SET last_reviewed_at = ?, updated_at = ? WHERE id = ? AND space_id = ?',
        reviewedAt, timestamp, id, spaceId,
      );
    }
  });
}

export async function deleteContentTopic(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM content_topics WHERE id = ? AND space_id = ?', id, spaceId);
}

import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface ResourceRow {
  id: string;
  space_id: string;
  title: string;
  type: 'pdf' | 'image' | 'link' | 'video' | 'document';
  kind: string | null;
  mime: string | null;
  size: number | null;
  file_uri: string | null;
  text_content: string | null;
  storage_path: string | null;
  original_size_bytes: number | null;
  stored_size_bytes: number | null;
  compression: string | null;
  original_name: string | null;
  url: string | null;
  topic_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export async function listResources(spaceId: string): Promise<ResourceRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<ResourceRow>(
    'SELECT * FROM resources WHERE space_id = ? ORDER BY position, created_at DESC',
    spaceId,
  );
}

export async function listAllResources(): Promise<ResourceRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<ResourceRow>('SELECT * FROM resources');
}

export async function getResource(id: string, spaceId: string): Promise<ResourceRow | null> {
  const database = await getDatabase();
  return database.getFirstAsync<ResourceRow>(
    'SELECT * FROM resources WHERE id = ? AND space_id = ?',
    id,
    spaceId,
  );
}

export async function createResource(data: {
  space_id: string;
  title: string;
  type: string;
  url?: string | null;
  topic_id?: string | null;
  file_uri?: string | null;
  text_content?: string | null;
  mime?: string | null;
  size?: number | null;
  original_name?: string | null;
}): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  const next = await database.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM resources WHERE space_id = ?',
    data.space_id,
  );
  await database.runAsync(
    `INSERT INTO resources
      (id, space_id, title, type, kind, mime, size, file_uri, text_content, storage_path,
       original_size_bytes, stored_size_bytes, original_name, url, topic_id, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId(), data.space_id, data.title, data.type, data.type, data.mime ?? null, data.size ?? null,
    data.file_uri ?? null, data.text_content ?? null, data.file_uri ?? null, data.size ?? null,
    data.size ?? null, data.original_name ?? null, data.url ?? null, data.topic_id ?? null,
    next?.next ?? 0, timestamp, timestamp,
  );
}

export async function updateResource(id: string, spaceId: string, changes: Partial<ResourceRow>): Promise<void> {
  const fields: (keyof ResourceRow)[] = ['title', 'topic_id', 'position'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const database = await getDatabase();
  const assignments = updates.map((field) => `${field} = ?`);
  const values = updates.map((field) => changes[field] ?? null);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id, spaceId);
  await database.runAsync(
    `UPDATE resources SET ${assignments.join(', ')} WHERE id = ? AND space_id = ?`,
    ...values,
  );
}

export async function reorderResources(spaceId: string, ids: string[]): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const [position, id] of ids.entries()) {
      await database.runAsync(
        'UPDATE resources SET position = ?, updated_at = ? WHERE id = ? AND space_id = ?',
        position, nowIso(), id, spaceId,
      );
    }
  });
}

export async function deleteResource(id: string, spaceId: string): Promise<ResourceRow | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ResourceRow>(
    'SELECT * FROM resources WHERE id = ? AND space_id = ?', id, spaceId,
  );
  if (row) await database.runAsync('DELETE FROM resources WHERE id = ? AND space_id = ?', id, spaceId);
  return row ?? null;
}

export async function deleteAllResources(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM resources');
}

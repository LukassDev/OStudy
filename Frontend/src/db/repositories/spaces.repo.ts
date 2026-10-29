import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface SpaceRow {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_favorite: number;
  position: number;
  created_at: string;
  updated_at: string;
}

export async function listSpaces(): Promise<SpaceRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<SpaceRow>('SELECT * FROM spaces ORDER BY position, id');
}

export async function createSpace(
  data: Partial<Omit<SpaceRow, 'is_favorite'>> & { name: string; is_favorite?: boolean | number },
): Promise<SpaceRow> {
  const database = await getDatabase();
  const timestamp = nowIso();
  const id = data.id || createId();
  let position = data.position;
  if (position === undefined) {
    const row = await database.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM spaces WHERE parent_id IS ?',
      data.parent_id ?? null,
    );
    position = row?.next ?? 0;
  }
  await database.runAsync(
    `INSERT INTO spaces (id, parent_id, name, icon, color, is_favorite, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.parent_id ?? null,
    data.name,
    data.icon ?? 'folder-outline',
    data.color ?? 'blue',
    Number(data.is_favorite ?? false),
    position,
    timestamp,
    timestamp,
  );
  return (await database.getFirstAsync<SpaceRow>('SELECT * FROM spaces WHERE id = ?', id))!;
}

export async function updateSpace(id: string, changes: Partial<SpaceRow>): Promise<void> {
  const fields: (keyof SpaceRow)[] = ['parent_id', 'name', 'icon', 'color', 'is_favorite', 'position'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const values = updates.map((field) => {
    const value = changes[field];
    if (field === 'is_favorite') return Number(value);
    return value == null ? null : value;
  });
  const assignments = updates.map((field) => `${field} = ?`);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id);
  const database = await getDatabase();
  await database.runAsync(`UPDATE spaces SET ${assignments.join(', ')} WHERE id = ?`, ...values);
}

export async function updateSpaceOrder(ids: string[], parentId: string | null): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    for (const [position, id] of ids.entries()) {
      await database.runAsync(
        'UPDATE spaces SET position = ?, updated_at = ? WHERE id = ? AND parent_id IS ?',
        position,
        nowIso(),
        id,
        parentId,
      );
    }
  });
}

export async function deleteSpace(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM spaces WHERE id = ?', id);
}

import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface CalendarEventRow {
  id: string;
  space_id: string;
  title: string;
  type: 'exam' | 'assignment' | 'session' | 'other';
  event_date: string;
  created_at: string;
  updated_at: string;
}

export async function listCalendarEvents(spaceId: string): Promise<CalendarEventRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<CalendarEventRow>(
    'SELECT * FROM calendar_events WHERE space_id = ? ORDER BY event_date, id',
    spaceId,
  );
}

export async function listAllCalendarEvents(): Promise<CalendarEventRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<CalendarEventRow>('SELECT * FROM calendar_events ORDER BY event_date, id');
}

export async function createCalendarEvent(data: Omit<CalendarEventRow, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    'INSERT INTO calendar_events (id, space_id, title, type, event_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    createId(), data.space_id, data.title, data.type, data.event_date, timestamp, timestamp,
  );
}

export async function updateCalendarEvent(id: string, spaceId: string, changes: Partial<CalendarEventRow>): Promise<void> {
  const fields: (keyof CalendarEventRow)[] = ['title', 'type', 'event_date'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const database = await getDatabase();
  const assignments = updates.map((field) => `${field} = ?`);
  const values = updates.map((field) => changes[field] ?? null);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id, spaceId);
  await database.runAsync(
    `UPDATE calendar_events SET ${assignments.join(', ')} WHERE id = ? AND space_id = ?`,
    ...values,
  );
}

export async function deleteCalendarEvent(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM calendar_events WHERE id = ? AND space_id = ?', id, spaceId);
}

import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';

export interface ChatRow {
  id: string;
  space_id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  space?: { name: string; icon: string; color: string } | null;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  role: 'user' | 'tutor';
  content: string;
  attachments: string;
  image_url: string | null;
  image_urls: string | null;
  quiz: string | null;
  sources: string | null;
  created_at: string;
}

export interface StoredChatAttachment {
  name: string;
  mimeType: string;
  uri: string;
  size: number;
}

export interface StoredQuiz {
  mode: 'quiz' | 'flashcards';
  title: string;
  items: {
    question?: string;
    options?: string[];
    correct_index?: number;
    explanation?: string;
    front?: string;
    back?: string;
  }[];
}

export interface StoredMessage extends Omit<MessageRow, 'attachments' | 'image_urls' | 'quiz' | 'sources'> {
  attachments: StoredChatAttachment[];
  image_urls: string[] | null;
  quiz: StoredQuiz | null;
  sources: { url: string; title?: string }[];
}

function decodeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Invalid JSON in local chat data', error);
    return fallback;
  }
}

function mapChat(row: ChatRow): ChatRow {
  return { ...row, user_id: 'local' };
}

export async function listChats(spaceId?: string, limit?: number): Promise<ChatRow[]> {
  const database = await getDatabase();
  const params: (string | number)[] = [];
  let sql = `SELECT chats.*, spaces.name AS space_name, spaces.icon AS space_icon, spaces.color AS space_color
    FROM chats LEFT JOIN spaces ON spaces.id = chats.space_id`;
  if (spaceId) {
    sql += ' WHERE chats.space_id = ?';
    params.push(spaceId);
  }
  sql += ' ORDER BY chats.updated_at DESC, chats.id';
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  const rows = await database.getAllAsync<ChatRow & {
    space_name: string | null;
    space_icon: string | null;
    space_color: string | null;
  }>(sql, ...params);
  return rows.map((row) => mapChat({
    ...row,
    space: row.space_name === null ? null : {
      name: row.space_name,
      icon: row.space_icon ?? 'folder-outline',
      color: row.space_color ?? 'blue',
    },
  }));
}

export async function getChat(chatId: string): Promise<ChatRow | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ChatRow & {
    space_name: string | null;
    space_icon: string | null;
    space_color: string | null;
  }>(
    `SELECT chats.*, spaces.name AS space_name, spaces.icon AS space_icon, spaces.color AS space_color
     FROM chats LEFT JOIN spaces ON spaces.id = chats.space_id WHERE chats.id = ?`,
    chatId,
  );
  return row ? mapChat({
    ...row,
    space: row.space_name === null ? null : {
      name: row.space_name,
      icon: row.space_icon ?? 'folder-outline',
      color: row.space_color ?? 'blue',
    },
  }) : null;
}

export async function searchChats(query: string, limit = 20): Promise<ChatRow[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ChatRow>(
    `SELECT * FROM chats WHERE title LIKE ? COLLATE NOCASE
     ORDER BY updated_at DESC LIMIT ?`,
    `%${query}%`, limit,
  );
  return rows.map(mapChat);
}

export async function createChat(spaceId: string, title: string): Promise<ChatRow> {
  const database = await getDatabase();
  const timestamp = nowIso();
  const id = createId();
  await database.runAsync(
    'INSERT INTO chats (id, space_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id, spaceId, title, timestamp, timestamp,
  );
  return (await getChat(id))!;
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE chats SET title = ?, updated_at = ? WHERE id = ?', title, nowIso(), chatId);
}

export async function deleteChat(chatId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM chats WHERE id = ?', chatId);
}

export async function listMessages(chatId: string): Promise<StoredMessage[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at, id',
    chatId,
  );
  return rows.map((row) => ({
    ...row,
    attachments: decodeJson<StoredChatAttachment[]>(row.attachments, []),
    image_urls: decodeJson<string[] | null>(row.image_urls, null),
    quiz: decodeJson<StoredQuiz | null>(row.quiz, null),
    sources: decodeJson<{ url: string; title?: string }[]>(row.sources, []),
  }));
}

export async function saveMessage(message: {
  id?: string;
  chat_id: string;
  role: 'user' | 'tutor';
  content: string;
  attachments?: unknown[];
  image_url?: string | null;
  image_urls?: string[] | null;
  quiz?: unknown;
  sources?: unknown[] | null;
  created_at?: string;
}): Promise<string> {
  const database = await getDatabase();
  const id = message.id || createId();
  const createdAt = message.created_at || nowIso();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO messages
        (id, chat_id, role, content, attachments, image_url, image_urls, quiz, sources, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        content = excluded.content, attachments = excluded.attachments, image_url = excluded.image_url,
        image_urls = excluded.image_urls, quiz = excluded.quiz, sources = excluded.sources`,
      id, message.chat_id, message.role, message.content, JSON.stringify(message.attachments ?? []),
      message.image_url ?? null, message.image_urls ? JSON.stringify(message.image_urls) : null,
      message.quiz === undefined || message.quiz === null ? null : JSON.stringify(message.quiz),
      message.sources ? JSON.stringify(message.sources) : null, createdAt,
    );
    const preview = message.content.replace(/\s+/g, ' ').trim().slice(0, 180);
    await database.runAsync(
      'UPDATE chats SET last_message_preview = ?, updated_at = ? WHERE id = ?',
      preview, createdAt, message.chat_id,
    );
  });
  return id;
}

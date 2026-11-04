import { getDatabase } from '../../db/client';
import { createId, nowIso } from '../../db/ids';
import { getSetting } from '../../db/repositories/settings.repo';
import { DEFAULT_TEXT_MODEL } from '../ai/config';
import { getApiKey } from '../ai/keyStore';
import { completeText } from '../ai/openrouter';

export interface LocalMemory {
  content: string;
  created_at: string;
}

interface MemoryCheckpoint {
  lastMessageAt: string;
  lastExtractionAt: string;
}

interface ExtractedMemory {
  type: 'episodic' | 'semantic';
  content: string;
}

const MEMORY_EXTRACTION_PROMPT = `Review the recent tutor-student exchange. Return only a JSON array of durable, study-relevant information the student revealed:
- Use type "semantic" for learning preferences, persistent strengths/difficulties, or relevant personal study facts.
- Use type "episodic" for notable short-term events such as an upcoming test or a study milestone.
- Write concise summaries in the third person, in the same language as the conversation.
- Return [] for ordinary questions, greetings, thanks, or facts already clearly present in the exchange that are not useful later.
Format: [{"type":"semantic"|"episodic","content":"..."}]`;

const extractionLocks = new Set<string>();

function parseExtractedMemories(raw: string): ExtractedMemory[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed: unknown = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error('Memory extraction did not return a JSON array.');
  return parsed.filter((item): item is ExtractedMemory =>
    !!item && typeof item === 'object'
    && ((item as ExtractedMemory).type === 'episodic' || (item as ExtractedMemory).type === 'semantic')
    && typeof (item as ExtractedMemory).content === 'string'
    && !!(item as ExtractedMemory).content.trim(),
  );
}

export async function readRelevantMemories(spaceId: string): Promise<LocalMemory[]> {
  const database = await getDatabase();
  const [semantic, episodic] = await Promise.all([
    database.getAllAsync<LocalMemory>(
      'SELECT content, created_at FROM semantic_memory WHERE space_id = ? ORDER BY updated_at DESC LIMIT 12',
      spaceId,
    ),
    database.getAllAsync<LocalMemory>(
      'SELECT content, created_at FROM episodic_memory WHERE space_id = ? ORDER BY created_at DESC LIMIT 8',
      spaceId,
    ),
  ]);
  return [...semantic, ...episodic].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 16);
}

export async function rememberExplicitFact(spaceId: string, content: string): Promise<void> {
  const fact = content.trim().slice(0, 1000);
  if (!fact) return;
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO semantic_memory (id, space_id, content, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, '{}', ?, ?)`,
    createId(), spaceId, fact, timestamp, timestamp,
  );
}

export async function rememberStudyEpisode(spaceId: string, content: string): Promise<void> {
  const episode = content.trim().slice(0, 1500);
  if (!episode) return;
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO episodic_memory (id, space_id, content, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)',
    createId(), spaceId, episode, '{}', nowIso(),
  );
}

export async function extractAndSaveMemory(chatId: string, spaceId: string): Promise<void> {
  if (extractionLocks.has(chatId)) return;
  extractionLocks.add(chatId);
  try {
    if (!(await getApiKey())) return;
    const database = await getDatabase();
    const settingKey = `memory.checkpoint.${chatId}`;
    const checkpoint = await getSetting<MemoryCheckpoint | null>(settingKey, null);
    const since = checkpoint?.lastMessageAt || '';
    const { count } = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM messages
       WHERE chat_id = ? AND role = 'user' AND (? = '' OR created_at > ?)`,
      chatId, since, since,
    ) ?? { count: 0 };
    const newMessages = Number(count);
    if (newMessages === 0) return;
    const intervalElapsed = !!checkpoint?.lastExtractionAt
      && Date.now() - Date.parse(checkpoint.lastExtractionAt) >= 5 * 60 * 1000;
    if (newMessages < 10 && !intervalElapsed) return;

    const messages = await database.getAllAsync<{ role: string; content: string; created_at: string }>(
      'SELECT role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at DESC, id DESC LIMIT 20',
      chatId,
    );
    const batch = messages.reverse();
    const latestMessage = batch[batch.length - 1];
    if (!latestMessage) return;
    const interaction = batch.map(message =>
      `${message.role === 'tutor' ? 'Tutor' : 'Student'}: ${message.content}`,
    ).join('\n').slice(-12000);
    const model = await getSetting('ai.textModel', DEFAULT_TEXT_MODEL);
    const raw = await completeText(model, MEMORY_EXTRACTION_PROMPT, [{ role: 'user', content: interaction }]);
    const memories = parseExtractedMemories(raw);
    const timestamp = nowIso();
    await database.withTransactionAsync(async () => {
      for (const memory of memories) {
        const content = memory.content.trim().slice(0, memory.type === 'semantic' ? 1000 : 1500);
        if (memory.type === 'semantic') {
          await database.runAsync(
            `INSERT INTO semantic_memory (id, space_id, content, metadata_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            createId(), spaceId, content, JSON.stringify({ chat_id: chatId, source: 'ai_extraction' }), timestamp, timestamp,
          );
        } else {
          await database.runAsync(
            `INSERT INTO episodic_memory (id, space_id, content, metadata_json, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            createId(), spaceId, content, JSON.stringify({ chat_id: chatId, source: 'ai_extraction' }), timestamp,
          );
        }
      }
      const nextCheckpoint: MemoryCheckpoint = {
        lastMessageAt: latestMessage.created_at,
        lastExtractionAt: timestamp,
      };
      await database.runAsync(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        settingKey, JSON.stringify(nextCheckpoint), timestamp,
      );
    });
  } catch (error) {
    console.error('Could not extract local tutor memory:', error);
  } finally {
    extractionLocks.delete(chatId);
  }
}

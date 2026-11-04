import i18n from '../../i18n';
import { getDatabase } from '../../db/client';
import { createId, nowIso } from '../../db/ids';
import { getChat, listMessages, saveMessage, type StoredQuiz } from '../../db/repositories/chats.repo';
import { createCalendarEvent, deleteCalendarEvent, listCalendarEvents } from '../../db/repositories/calendar.repo';
import { createContentTopic, deleteContentTopic, listContentTopics, updateContentTopic } from '../../db/repositories/content.repo';
import { createGrade, deleteGrade, listGrades } from '../../db/repositories/grades.repo';
import { getSetting } from '../../db/repositories/settings.repo';
import { DEFAULT_TEXT_MODEL, DEFAULT_TUTOR_PROMPT, DEFAULT_VISION_MODEL, normalizeEditableTutorPrompt, TUTOR_FIXED_SYSTEM_PROMPT } from '../ai/config';
import { completeText, completeWithAttachments, type AiTurn } from '../ai/openrouter';
import { getApiKey } from '../ai/keyStore';
import { getAppLimits } from '../appLimits';
import { parseTutorReply, type ParsedTutorAction } from './actionParser';
import { useStudyStore } from '../../stores/studyStore';

export type TutorResponseMode = 'flash' | 'deep';

type LocalContext = {
  spaceName: string;
  topics: Awaited<ReturnType<typeof listContentTopics>>;
  events: Awaited<ReturnType<typeof listCalendarEvents>>;
  grades: Awaited<ReturnType<typeof listGrades>>;
};

async function readContext(spaceId: string): Promise<LocalContext> {
  const database = await getDatabase();
  const [space, topics, events, grades] = await Promise.all([
    database.getFirstAsync<{ name: string }>('SELECT name FROM spaces WHERE id = ?', spaceId),
    listContentTopics(spaceId),
    listCalendarEvents(spaceId),
    listGrades(spaceId),
  ]);
  if (!space) throw new Error(i18n.t('chat.errors.spaceNotFound'));
  return { spaceName: space.name, topics, events, grades };
}

function formatContext(context: LocalContext, maxChars: number): string {
  const topics = context.topics.map(item =>
    `${'  '.repeat(depthOf(item.id, context.topics))}- ${item.title} [id:${item.id}]${item.summary ? `: ${item.summary}` : ''}`,
  ).join('\n');
  const grades = context.grades.slice(-15).map(item =>
    `- ${item.title}: ${item.score}/${item.max_score} [id:${item.id}]`,
  ).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = context.events.filter(event => event.event_date >= today).slice(0, 15);
  const eventText = upcomingEvents.map(item =>
    `- ${item.title} (${item.type}, ${item.event_date}) [id:${item.id}]`,
  ).join('\n');
  const formatted = [
    `Space: ${context.spaceName}`,
    `Topics:\n${topics || '(none)'}`,
    `Upcoming events:\n${eventText || '(none)'}`,
    `Grades:\n${grades || '(none)'}`,
  ].join('\n\n');
  if (formatted.length <= maxChars) return formatted;
  const notice = '\n\n[Context truncated for length. Omitted records may exist; do not claim the lists are complete.]';
  return `${formatted.slice(0, Math.max(0, maxChars - notice.length))}${notice.slice(0, maxChars)}`;
}

function depthOf(id: string, topics: LocalContext['topics']): number {
  let depth = 0;
  let current = topics.find(topic => topic.id === id);
  while (current?.parent_id && depth < 8) {
    current = topics.find(topic => topic.id === current?.parent_id);
    depth += 1;
  }
  return depth;
}

function isAffirmative(value: string): boolean {
  const normalized = value.trim();
  if (/\b(não|nao|no|cancel|wait|but|mas)\b/i.test(normalized)) return false;
  return /^(sim|yes|confirmo|confirm|pode ser|podes|ok|okay|certo|concordo|faz isso|prossiga|continue)(?:[.! ,]|$)/i.test(normalized);
}

function hasPendingConfirmation(previousAssistant: string): boolean {
  return /confirm|confirma|posso (?:criar|apagar|adicionar|remover)|shall i|should i|do you (?:confirm|want me to)/i.test(previousAssistant);
}

function arrayItems(data: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(data.items) ? data.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [data];
}

async function createTopicTree(spaceId: string, item: Record<string, unknown>, parentId: string | null = null): Promise<void> {
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) throw new Error('Uma nota ou tópico devolvido pelo tutor não tinha título.');
  const id = createId();
  if (parentId) {
    const database = await getDatabase();
    const parent = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM content_topics WHERE id = ? AND space_id = ?',
      parentId, spaceId,
    );
    if (!parent) throw new Error('O tópico pai não pertence a este Space.');
  }
  await createContentTopic({
    id, space_id: spaceId, parent_id: parentId, title,
    summary: typeof item.summary === 'string' ? item.summary : null,
    importance: item.importance === 'high' ? 'high' : 'medium',
  });
  if (Array.isArray(item.children)) {
    for (const child of item.children) {
      if (!child || typeof child !== 'object') continue;
      await createTopicTree(spaceId, child as Record<string, unknown>, id);
    }
  }
}

function validateTopicMoves(
  topics: Awaited<ReturnType<typeof listContentTopics>>,
  items: Record<string, unknown>[],
): void {
  const parents = new Map(topics.map(topic => [topic.id, topic.parent_id]));
  for (const item of items) {
    if (typeof item.id !== 'string' || !parents.has(item.id)) throw new Error('O tópico não pertence a este Space.');
    if (item.parent_id !== undefined) {
      if (item.parent_id !== null && (typeof item.parent_id !== 'string' || !parents.has(item.parent_id))) {
        throw new Error('O tópico pai não pertence a este Space.');
      }
      parents.set(item.id, item.parent_id as string | null);
    }
  }
  for (const item of items) {
    const seen = new Set<string>();
    let current: string | null = item.id as string;
    while (current) {
      if (seen.has(current)) throw new Error('Esta alteração criaria um ciclo na árvore de tópicos.');
      seen.add(current);
      current = parents.get(current) ?? null;
    }
  }
}

async function executeAction(spaceId: string, action: ParsedTutorAction): Promise<void> {
  const items = arrayItems(action.data);
  switch (action.type) {
    case 'create_calendar_event':
      for (const item of items) {
        if (typeof item.title !== 'string' || typeof item.event_date !== 'string') throw new Error('Evento incompleto recebido do tutor.');
        const requestedType = String(item.type);
        const type = requestedType === 'test' || requestedType === 'homework'
          ? 'assignment'
          : ['exam', 'assignment', 'session'].includes(requestedType) ? requestedType : 'other';
        await createCalendarEvent({ space_id: spaceId, title: item.title, event_date: item.event_date, type: type as 'exam' | 'assignment' | 'session' | 'other' });
      }
      await useStudyStore.getState().refreshLoaded(['events']);
      await useStudyStore.getState().load(false, ['lessons', 'events', 'preferences']);
      return;
    case 'create_grade':
      for (const item of items) {
        if (typeof item.title !== 'string' || typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0) throw new Error('Nota incompleta recebida do tutor.');
        const maxScore = typeof item.max_score === 'number' && item.max_score > 0 ? item.max_score : 20;
        await createGrade({
          space_id: spaceId, title: item.title, score: item.score, max_score: maxScore,
          weight: typeof item.weight === 'number' && item.weight > 0 ? item.weight : 1,
          topic_id: null, graded_at: new Date().toISOString().slice(0, 10),
        });
      }
      return;
    case 'create_content_topic':
      for (const item of items) await createTopicTree(spaceId, item, typeof item.parent_id === 'string' ? item.parent_id : null);
      return;
    case 'delete_calendar_event':
    case 'delete_grade':
    case 'delete_content_topic': {
      const ids = Array.isArray(action.data.ids) ? action.data.ids.filter((id): id is string => typeof id === 'string') : [];
      if (!ids.length) throw new Error('A ação de remoção não continha IDs válidos.');
      for (const id of ids) {
        if (action.type === 'delete_calendar_event') await deleteCalendarEvent(id, spaceId);
        else if (action.type === 'delete_grade') await deleteGrade(id, spaceId);
        else await deleteContentTopic(id, spaceId);
      }
      if (action.type === 'delete_calendar_event') {
        await useStudyStore.getState().refreshLoaded(['events']);
        await useStudyStore.getState().load(false, ['lessons', 'events', 'preferences']);
      }
      return;
    }
    case 'update_content_topic': {
      const topics = await listContentTopics(spaceId);
      validateTopicMoves(topics, items);
      for (const item of items) {
        if (typeof item.id !== 'string') throw new Error('Tópico sem ID.');
        await updateContentTopic(item.id, spaceId, {
          ...(typeof item.title === 'string' ? { title: item.title } : {}),
          ...(typeof item.summary === 'string' ? { summary: item.summary } : {}),
          ...(typeof item.parent_id === 'string' || item.parent_id === null ? { parent_id: item.parent_id as string | null } : {}),
          ...(typeof item.importance === 'string' ? { importance: item.importance } : {}),
        });
      }
      return;
    }
    default:
      throw new Error(`Ação do tutor não suportada: ${action.type}`);
  }
}

function safetyReply(content: string): { reply: string; category: 'emotional_crisis' | 'dangerous' } | null {
  if (/\b(suicid|kill myself|end my life|hurt myself|me matar|suic[ií]dio|tirar a minha vida|matar-me)\b/i.test(content)) {
    return {
      category: 'emotional_crisis',
      reply: i18n.language.startsWith('pt')
        ? 'Lamento que estejas a passar por isso. Fala agora com um adulto de confiança e, se estiveres em perigo imediato, contacta os serviços de emergência locais.'
        : 'I’m sorry you’re going through this. Please tell a trusted adult now, and contact local emergency services if you are in immediate danger.',
    };
  }
  if (/\b(make a bomb|build a weapon|how to poison|construir uma bomba|fazer uma arma|como envenenar)\b/i.test(content)) {
    return {
      category: 'dangerous',
      reply: i18n.language.startsWith('pt')
        ? 'Não posso ajudar com isso. Posso ajudar-te com uma questão de estudo segura.'
        : 'I can’t help with that. I can help with a safe study question instead.',
    };
  }
  return null;
}

function formatQuizForContext(quiz: StoredQuiz | null): string {
  if (!quiz || quiz.mode !== 'quiz' || !Array.isArray(quiz.items) || quiz.items.length === 0) return '';
  const letters = ['a', 'b', 'c', 'd', 'e'];
  const lines = [
    '(Referência interna do quiz anterior: usa as perguntas, opções e respostas corretas para corrigir as respostas do aluno; não repitas o quiz.)',
    `Título: ${quiz.title || 'Quiz'}`,
  ];
  quiz.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.question || '(sem enunciado)'}`);
    if (Array.isArray(item.options)) {
      lines.push(...item.options.map((option, optionIndex) => `   ${letters[optionIndex] ?? '?'}) ${option}`));
    }
    const correct = Number.isInteger(item.correct_index) && item.correct_index! >= 0 && item.correct_index! < letters.length
      ? letters[item.correct_index!]
      : '?';
    lines.push(`   [Resposta correta: ${correct}]`);
    if (item.explanation) lines.push(`   [Explicação: ${item.explanation}]`);
  });
  return lines.join('\n');
}

export async function tutorReply(input: {
  chatId: string;
  content: string;
  images: { mimeType: string; base64: string }[];
  documents: { mimeType: string; name: string; base64: string }[];
  mode?: TutorResponseMode;
  signal: AbortSignal;
}): Promise<{ reply: string; quiz: ReturnType<typeof parseTutorReply>['quiz'] }> {
  const chat = await getChat(input.chatId);
  if (!chat) throw new Error(i18n.t('chat.errors.spaceNotFound'));
  const safety = safetyReply(input.content);
  if (safety) {
    const database = await getDatabase();
    try {
      await database.runAsync(
        'INSERT INTO safety_log (id, space_id, category, details_json, created_at) VALUES (?, ?, ?, ?, ?)',
        createId(), chat.space_id, safety.category, JSON.stringify({ source: 'local_keyword_filter' }), nowIso(),
      );
    } catch (error) {
      console.error('Could not persist local tutor safety event:', error);
    }
    return { reply: safety.reply, quiz: null };
  }
  if (!(await getApiKey())) throw new Error('Para usar IA, defina a sua chave de API nas Definições');
  const limits = await getAppLimits();
  const priorMessages = await listMessages(input.chatId);
  const previousAssistant = [...priorMessages.slice(0, -1)].reverse().find(message => message.role === 'tutor')?.content ?? '';

  const context = await readContext(chat.space_id);
  const configuredPrompt = await getSetting('ai.systemPrompt', DEFAULT_TUTOR_PROMPT);
  const behaviorPrompt = normalizeEditableTutorPrompt(configuredPrompt).trim() || DEFAULT_TUTOR_PROMPT;
  const pdfs = input.documents.filter(document => document.mimeType.toLowerCase() === 'application/pdf'
    || document.name.toLowerCase().endsWith('.pdf'));
  const textDocuments = input.documents.filter(document => !pdfs.includes(document));
  const documentContext = textDocuments.map(document => {
    if (!/^text\/|application\/(json|xml)/i.test(document.mimeType)) {
      return `Anexo "${document.name}" (${document.mimeType}) foi anexado. Se o conteúdo não estiver visível, explica a limitação e pede que o utilizador partilhe texto ou imagem das páginas relevantes.`;
    }
    try {
      const decoded = atob(document.base64);
      const escaped = Array.from(decoded, character => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
      return `Documento ${document.name}:\n${decodeURIComponent(escaped).slice(0, limits.tutorAttachedDocumentChars)}`;
    } catch (error) {
      console.error('Could not decode local text document:', error);
      return `Documento "${document.name}" anexado; o texto não pôde ser extraído localmente.`;
    }
  }).join('\n\n');
  const responseModePrompt = input.mode === 'deep'
    ? '\n\n[Response depth: Deep]\nExplain the key steps and relevant assumptions clearly. Explore the important parts of the question without unnecessary filler, and do not reveal private chain-of-thought.'
    : '\n\n[Response depth: Flash]\nAnswer directly and concisely. Include only the explanation needed to make the answer useful and clear.';
  const systemPrompt = `${TUTOR_FIXED_SYSTEM_PROMPT}\n\n[Editable Tutor Behavior]\n${behaviorPrompt}${responseModePrompt}\n\n[Local study context]\n${formatContext(context, limits.tutorContextChars)}${documentContext ? `\n\n[Attached documents]\n${documentContext}` : ''}`;
  const history: AiTurn[] = priorMessages
    .slice(-limits.tutorHistoryMessages)
    .map(message => {
      const quizContext = message.role === 'tutor' ? formatQuizForContext(message.quiz) : '';
      return {
        role: message.role === 'tutor' ? 'assistant' : 'user',
        content: quizContext ? `${message.content}\n\n${quizContext}` : message.content,
      };
    });
  const textModel = await getSetting('ai.textModel', DEFAULT_TEXT_MODEL);
  const hasVisionAttachments = input.images.length > 0 || pdfs.length > 0;
  const visionModel = hasVisionAttachments
    ? (await getSetting('ai.visionModel', DEFAULT_VISION_MODEL)).trim()
    : '';
  if (hasVisionAttachments && !visionModel) {
    throw new Error(i18n.t('chat.attachMenu.visionModelRequiredMessage'));
  }
  const raw = hasVisionAttachments
    ? await completeWithAttachments(visionModel, systemPrompt, history, {
      images: input.images,
      pdfs: pdfs.map(document => ({ name: document.name, base64: document.base64 })),
    }, input.signal)
    : await completeText(textModel, systemPrompt, history, input.signal);
  const parsed = parseTutorReply(raw, limits.quizMaxItems);
  if (parsed.actions.length) {
    const confirmed = isAffirmative(input.content) && hasPendingConfirmation(previousAssistant);
    if (!confirmed) {
      return {
        reply: i18n.language.startsWith('pt')
          ? 'Posso preparar essa alteração. Confirma explicitamente o que pretendes que eu faça antes de a executar.'
          : 'I can prepare that change. Please explicitly confirm what you want me to do before I execute it.',
        quiz: null,
      };
    }
    const database = await getDatabase();
    await database.withTransactionAsync(async () => {
      for (const action of parsed.actions) await executeAction(chat.space_id, action);
    });
  }
  const reply = parsed.reply || (parsed.actions.length
    ? (i18n.language.startsWith('pt') ? 'Feito — as alterações confirmadas foram guardadas.' : 'Done — the confirmed changes were saved.')
    : '');
  if (!reply) throw new Error('O tutor devolveu uma resposta sem conteúdo.');
  return { reply, quiz: parsed.quiz };
}

export async function generateChatTitle(content: string): Promise<string> {
  const textModel = await getSetting('ai.textModel', DEFAULT_TEXT_MODEL);
  const raw = await completeText(
    textModel,
    'Create a concise title for this study conversation in the same language as the message. Return only the title, with no quotation marks or explanation.',
    [{ role: 'user', content: content.slice(0, 4000) }],
  );
  const title = raw
    .split(/\r?\n/, 1)[0]
    .replace(/^(?:title|título)\s*:\s*/i, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
    .slice(0, 80);
  if (!title) throw new Error('O modelo devolveu um título de conversa vazio.');
  return title;
}

export async function saveTutorReply(chatId: string, reply: string, quiz: ReturnType<typeof parseTutorReply>['quiz']): Promise<string> {
  const id = createId();
  await saveMessage({ id, chat_id: chatId, role: 'tutor', content: reply, quiz, created_at: nowIso() });
  return id;
}

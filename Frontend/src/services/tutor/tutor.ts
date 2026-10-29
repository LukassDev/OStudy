import i18n from '../../i18n';
import { getDatabase } from '../../db/client';
import { createId, nowIso } from '../../db/ids';
import { getChat, listChats, listMessages, saveMessage, type StoredQuiz } from '../../db/repositories/chats.repo';
import { createCalendarEvent, deleteCalendarEvent, listCalendarEvents } from '../../db/repositories/calendar.repo';
import { createContentTopic, deleteContentTopic, listContentTopics, toggleContentTopicReviewed, updateContentTopic } from '../../db/repositories/content.repo';
import { createGrade, deleteGrade, listGrades } from '../../db/repositories/grades.repo';
import { getSetting } from '../../db/repositories/settings.repo';
import { DEFAULT_TEXT_MODEL, DEFAULT_TUTOR_PROMPT, DEFAULT_VISION_MODEL, normalizeEditableTutorPrompt, TUTOR_FIXED_SYSTEM_PROMPT } from '../ai/config';
import { completeText, completeWithAttachments, type AiTurn } from '../ai/openrouter';
import { getApiKey } from '../ai/keyStore';
import { getAppLimits } from '../appLimits';
import { extractAndSaveMemory, readRelevantMemories, rememberExplicitFact } from '../memory/memory';
import { readStudentModel, rememberExplicitStudyGoal } from '../studentModel/studentModel';
import { parseTutorReply, type ParsedTutorAction } from './actionParser';
import { useContentStore } from '../../stores/contentStore';
import { usePlanStore } from '../../stores/planStore';

type LocalContext = {
  spaceName: string;
  topics: Awaited<ReturnType<typeof listContentTopics>>;
  events: Awaited<ReturnType<typeof listCalendarEvents>>;
  grades: Awaited<ReturnType<typeof listGrades>>;
  topicKnowledge: { title: string; knowledge: number }[];
  goal: string | null;
  memories: Awaited<ReturnType<typeof readRelevantMemories>>;
  otherChats: string;
};

async function readContext(spaceId: string, currentChatId: string, message: string): Promise<LocalContext> {
  const database = await getDatabase();
  const [space, topics, events, grades, studentModel, memories, topicKnowledge, recentChats] = await Promise.all([
    database.getFirstAsync<{ name: string }>('SELECT name FROM spaces WHERE id = ?', spaceId),
    listContentTopics(spaceId),
    listCalendarEvents(spaceId),
    listGrades(spaceId),
    readStudentModel(spaceId),
    readRelevantMemories(spaceId),
    database.getAllAsync<{ title: string; knowledge: number }>(
      `SELECT topics.title, knowledge.knowledge FROM topic_knowledge AS knowledge
       JOIN content_topics AS topics ON topics.id = knowledge.topic_id
       WHERE topics.space_id = ? ORDER BY knowledge.knowledge ASC LIMIT 5`,
      spaceId,
    ),
    listChats(spaceId, 7),
  ]);
  if (!space) throw new Error(i18n.t('chat.errors.spaceNotFound'));
  const otherChatsList = recentChats.filter(chat => chat.id !== currentChatId).slice(0, 6);
  const lowerMessage = message.toLocaleLowerCase();
  const referenceHints = [
    'tínhamos ficado', 'tinhamos ficado', 'onde ficámos', 'onde ficamos', 'outro chat',
    'conversa anterior', 'estávamos a falar', 'estavamos a falar', 'lembras-te', 'lembras te',
    'where did we leave off', 'previous chat', 'other conversation', 'what did we discuss',
    'dónde nos quedamos', 'conversation précédente', 'vorherigen chat', 'conversazione precedente',
  ];
  const referencesPast = referenceHints.some(hint => lowerMessage.includes(hint))
    || otherChatsList.some(chat => chat.title && lowerMessage.includes(chat.title.toLocaleLowerCase()));
  const otherChats = await Promise.all(otherChatsList.map(async chat => {
    const heading = `- "${chat.title || 'Sem título'}" — ${chat.last_message_preview || '(vazio)'}`;
    if (!referencesPast) return heading;
    const history = (await listMessages(chat.id)).slice(-6);
    const conversation = history.map(item =>
      `${item.role === 'tutor' ? 'Oren' : 'Aluno'}: ${item.content.slice(0, 1800)}`,
    ).join('\n');
    return `-- ${chat.title || 'Sem título'} --\n${conversation || heading}`;
  }));
  return {
    spaceName: space.name, topics, events, grades, topicKnowledge,
    goal: studentModel?.goal ?? null, memories, otherChats: otherChats.join('\n'),
  };
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
  const knowledgeText = context.topicKnowledge.map(item =>
    `- ${item.title}: ${Math.round(item.knowledge)}%`,
  ).join('\n');
  const memoryText = context.memories.map(memory => `- ${memory.content}`).join('\n');
  const formatted = [
    `Space: ${context.spaceName}`,
    `Study goal: ${context.goal || '(not set)'}`,
    `Topics:\n${topics || '(none)'}`,
    `Topic knowledge and review priorities:\n${knowledgeText || '(none recorded)'}`,
    `Upcoming events:\n${eventText || '(none)'}`,
    `Grades:\n${grades || '(none)'}`,
    `Other conversations in this Space:\n${context.otherChats || '(none)'}`,
    `Remembered study preferences and facts:\n${memoryText || '(none)'}`,
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
    case 'create_learning_plan': {
      if (typeof action.data.goal === 'string' && action.data.goal.trim()) {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO student_model (space_id, goal, model_json, created_at, updated_at)
           VALUES (?, ?, '{}', ?, ?) ON CONFLICT(space_id) DO UPDATE SET goal = excluded.goal, updated_at = excluded.updated_at`,
          spaceId, action.data.goal.trim(), nowIso(), nowIso(),
        );
      }
      const modules = Array.isArray(action.data.modules) ? action.data.modules : [];
      for (const module of modules) {
        if (module && typeof module === 'object') await createTopicTree(spaceId, module as Record<string, unknown>);
      }
      if (modules.length === 0) throw new Error('Plano de estudo sem módulos.');
      return;
    }
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
      return;
    }
    case 'toggle_module_reviewed':
      if (typeof action.data.id !== 'string' || !action.data.id) throw new Error('A ação de revisão não contém um tópico válido.');
      await toggleContentTopicReviewed(action.data.id, spaceId);
      await Promise.all([
        useContentStore.getState().loadedSpaceId === spaceId
          ? useContentStore.getState().fetchTopics(spaceId)
          : Promise.resolve(),
        usePlanStore.getState().loadedSpaceId === spaceId
          ? usePlanStore.getState().fetchPlan(spaceId)
          : Promise.resolve(),
      ]);
      return;
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

  await rememberExplicitStudyGoal(chat.space_id, input.content);
  if (/\bremember\b|lembra(?:-te)?|guarda esta informa(?:ç|c)[aã]o/i.test(input.content)) {
    await rememberExplicitFact(chat.space_id, input.content);
  }
  const context = await readContext(chat.space_id, chat.id, input.content);
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
  const configuredPrompt = await getSetting('ai.systemPrompt', DEFAULT_TUTOR_PROMPT);
  const behaviorPrompt = normalizeEditableTutorPrompt(configuredPrompt).trim() || DEFAULT_TUTOR_PROMPT;
  const systemPrompt = `${TUTOR_FIXED_SYSTEM_PROMPT}\n\n[Editable Tutor Behavior]\n${behaviorPrompt}\n\n[Local study context]\n${formatContext(context, limits.tutorContextChars)}${documentContext ? `\n\n[Attached documents]\n${documentContext}` : ''}`;
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
  const visionModel = await getSetting('ai.visionModel', DEFAULT_VISION_MODEL);
  const raw = input.images.length || pdfs.length
    ? await completeWithAttachments(input.images.length ? visionModel : textModel, systemPrompt, history, {
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

export async function saveTutorReply(chatId: string, reply: string, quiz: ReturnType<typeof parseTutorReply>['quiz']): Promise<string> {
  const id = createId();
  await saveMessage({ id, chat_id: chatId, role: 'tutor', content: reply, quiz, created_at: nowIso() });
  void getChat(chatId)
    .then(chat => chat ? extractAndSaveMemory(chatId, chat.space_id) : undefined)
    .catch(error => console.error('Could not load local chat for memory extraction:', error));
  return id;
}

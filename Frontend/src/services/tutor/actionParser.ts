import type { QuizFlashcardsPayload } from '../../stores/chatStore';
import { DEFAULT_APP_LIMITS } from '../appLimits';

export interface ParsedTutorAction {
  type: string;
  data: Record<string, unknown>;
}

export function parseTutorReply(raw: string, maxQuizItems = DEFAULT_APP_LIMITS.quizMaxItems): {
  reply: string;
  actions: ParsedTutorAction[];
  quiz: QuizFlashcardsPayload | null;
} {
  const actions: ParsedTutorAction[] = [];
  let quiz: QuizFlashcardsPayload | null = null;
  const reply = raw.replace(/```(?:json_action|json)\s*([\s\S]*?)```/gi, (block, body: string) => {
    try {
      const parsed = JSON.parse(body.trim()) as { type?: unknown; data?: unknown; mode?: unknown; items?: unknown };
      if (parsed.type === 'quiz_flashcards') {
        const data = (parsed.data ?? parsed) as Partial<QuizFlashcardsPayload>;
        if (isQuiz(data, maxQuizItems)) quiz = { mode: data.mode, title: data.title || '', items: data.items };
        else throw new Error('O tutor devolveu um quiz inválido.');
      } else if (typeof parsed.type === 'string' && parsed.data && typeof parsed.data === 'object') {
        actions.push({ type: parsed.type, data: parsed.data as Record<string, unknown> });
      } else {
        return block;
      }
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('O tutor devolveu uma ação estruturada inválida.');
      throw error;
    }
    return '';
  }).trim();
  return { reply, actions, quiz };
}

function isQuiz(data: Partial<QuizFlashcardsPayload>, maxItems: number): data is QuizFlashcardsPayload {
  if (!['quiz', 'flashcards'].includes(data.mode || '') || !Array.isArray(data.items)
    || data.items.length < 1 || data.items.length > maxItems) return false;
  return data.items.every(item => data.mode === 'quiz'
    ? typeof item.question === 'string' && Array.isArray(item.options) && item.options.length >= 2
      && item.options.every(option => typeof option === 'string')
      && Number.isInteger(item.correct_index) && item.correct_index! >= 0 && item.correct_index! < item.options.length
    : typeof item.front === 'string' && typeof item.back === 'string');
}

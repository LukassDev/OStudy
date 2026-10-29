import { getApiKey } from './keyStore';
import {
  AI_KEY_REQUIRED_MESSAGE,
  OPENROUTER_API_URL,
} from './config';
import { getAppLimits } from '../appLimits';

export interface AiTurn {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
}

type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } };

interface OpenRouterResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
}

async function requestCompletion(
  model: string,
  messages: AiTurn[],
  signal?: AbortSignal,
  maxTokens?: number,
  plugins?: { id: string; pdf?: { engine: string } }[],
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error(AI_KEY_REQUIRED_MESSAGE);
  const limits = await getAppLimits();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, limits.aiTimeoutSeconds * 1000);
  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Title': 'OStudy',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens ?? limits.tutorReplyTokens, ...(plugins ? { plugins } : {}) }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('A chave OpenRouter é inválida ou não tem permissão. Verifique-a nas Definições.');
    }
    if (response.status === 429) throw new Error('O OpenRouter atingiu um limite temporário. Tente novamente mais tarde.');
    throw new Error(`Falha na chamada OpenRouter (${response.status}).`);
  }
  const result = await response.json() as OpenRouterResponse;
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('O OpenRouter devolveu uma resposta vazia.');
  return content.trim();
}

export function completeText(
  model: string,
  systemPrompt: string,
  history: AiTurn[],
  signal?: AbortSignal,
): Promise<string> {
  return requestCompletion(model, [{ role: 'system', content: systemPrompt }, ...history], signal);
}

export function completeWithImages(
  model: string,
  systemPrompt: string,
  history: AiTurn[],
  images: { mimeType: string; base64: string }[],
  signal?: AbortSignal,
): Promise<string> {
  return completeWithAttachments(model, systemPrompt, history, { images }, signal);
}

export function completeWithAttachments(
  model: string,
  systemPrompt: string,
  history: AiTurn[],
  attachments: {
    images?: { mimeType: string; base64: string }[];
    pdfs?: { name: string; base64: string }[];
  },
  signal?: AbortSignal,
): Promise<string> {
  const messages = [{ role: 'system' as const, content: systemPrompt }, ...history.map(turn => ({ ...turn }))];
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') throw new Error('A mensagem com anexos não foi encontrada.');
  const previousText = typeof last.content === 'string' ? last.content : '';
  last.content = [
    { type: 'text', text: previousText || 'Analisa os anexos e ajuda-me a compreender o conteúdo.' },
    ...(attachments.images || []).map(image => ({
      type: 'image_url' as const,
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })),
    ...(attachments.pdfs || []).map(pdf => ({
      type: 'file' as const,
      file: { filename: pdf.name, file_data: `data:application/pdf;base64,${pdf.base64}` },
    })),
  ];
  const plugins = attachments.pdfs?.length
    ? [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }]
    : undefined;
  return requestCompletion(model, messages, signal, undefined, plugins);
}

export async function testOpenRouterKey(model: string): Promise<void> {
  await requestCompletion(model, [{ role: 'user', content: 'Responde apenas: OK' }], undefined, 1);
}

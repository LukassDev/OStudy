import { getSetting, setSetting } from '../db/repositories/settings.repo';

export interface AppLimits {
  tutorHistoryMessages: number;
  tutorReplyTokens: number;
  tutorContextChars: number;
  tutorAttachedDocumentChars: number;
  aiTimeoutSeconds: number;
  chatAttachmentMiB: number;
  webChatAttachmentMiB: number;
  resourceFileMiB: number;
  webResourceFileMiB: number;
  webResourceTextChars: number;
  quizMaxItems: number;
  officeArchiveEntries: number;
  officeUnpackedMiB: number;
  officeHtmlMiChars: number;
  officeSheets: number;
  officeRows: number;
  officeColumns: number;
  officeSlides: number;
}

export const APP_LIMITS_SETTING_KEY = 'app.limits';

export const DEFAULT_APP_LIMITS: AppLimits = {
  tutorHistoryMessages: 40,
  tutorReplyTokens: 4096,
  tutorContextChars: 18000,
  tutorAttachedDocumentChars: 15000,
  aiTimeoutSeconds: 90,
  chatAttachmentMiB: 15,
  webChatAttachmentMiB: 1,
  resourceFileMiB: 50,
  webResourceFileMiB: 1,
  webResourceTextChars: 15000,
  quizMaxItems: 30,
  officeArchiveEntries: 10000,
  officeUnpackedMiB: 120,
  officeHtmlMiChars: 24,
  officeSheets: 100,
  officeRows: 5000,
  officeColumns: 200,
  officeSlides: 300,
};

export const APP_LIMIT_FIELDS: {
  key: keyof AppLimits;
  label: string;
  group: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  { key: 'tutorHistoryMessages', label: 'Mensagens de histórico do tutor', group: 'Tutor IA', unit: 'mensagens', min: 1, max: 200 },
  { key: 'tutorContextChars', label: 'Contexto máximo', group: 'Tutor IA', unit: 'caracteres', min: 100, max: 1000000 },
  { key: 'tutorAttachedDocumentChars', label: 'Texto extraído de anexos', group: 'Tutor IA', unit: 'caracteres', min: 1, max: 1000000 },
  { key: 'tutorReplyTokens', label: 'Resposta máxima', group: 'Tutor IA', unit: 'tokens', min: 1, max: 32768 },
  { key: 'aiTimeoutSeconds', label: 'Timeout do pedido', group: 'Tutor IA', unit: 'segundos', min: 1, max: 600 },
  { key: 'chatAttachmentMiB', label: 'Anexo por mensagem', group: 'Anexos do chat', unit: 'MiB', min: 1, max: 100 },
  { key: 'webChatAttachmentMiB', label: 'Anexo guardado na Web', group: 'Anexos do chat', unit: 'MiB', min: 1, max: 50 },
  { key: 'resourceFileMiB', label: 'Ficheiro de recurso', group: 'Recursos', unit: 'MiB', min: 1, max: 500 },
  { key: 'webResourceFileMiB', label: 'Ficheiro de texto na Web', group: 'Recursos', unit: 'MiB', min: 1, max: 50 },
  { key: 'webResourceTextChars', label: 'Texto de recurso na Web', group: 'Recursos', unit: 'caracteres', min: 1, max: 1000000 },
  { key: 'quizMaxItems', label: 'Máximo de itens por quiz/flashcards', group: 'Quizzes e flashcards', unit: 'itens', min: 1, max: 100 },
  { key: 'officeArchiveEntries', label: 'Entradas no arquivo', group: 'Pré-visualização de documentos', unit: 'entradas', min: 1, max: 50000 },
  { key: 'officeUnpackedMiB', label: 'Tamanho descomprimido', group: 'Pré-visualização de documentos', unit: 'MiB', min: 1, max: 1024 },
  { key: 'officeHtmlMiChars', label: 'Tamanho máximo do HTML', group: 'Pré-visualização de documentos', unit: 'Mi caracteres', min: 1, max: 256 },
  { key: 'officeSheets', label: 'Folhas de cálculo', group: 'Pré-visualização de documentos', unit: 'folhas', min: 1, max: 5000 },
  { key: 'officeRows', label: 'Linhas por folha', group: 'Pré-visualização de documentos', unit: 'linhas', min: 1, max: 100000 },
  { key: 'officeColumns', label: 'Colunas por folha', group: 'Pré-visualização de documentos', unit: 'colunas', min: 1, max: 10000 },
  { key: 'officeSlides', label: 'Slides por apresentação', group: 'Pré-visualização de documentos', unit: 'slides', min: 1, max: 5000 },
];

export function validateAppLimits(value: unknown): AppLimits {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('As definições dos limites têm um formato inválido.');
  }
  const saved = value as Partial<Record<keyof AppLimits, unknown>>;
  const limits = { ...DEFAULT_APP_LIMITS };
  for (const field of APP_LIMIT_FIELDS) {
    const candidate = saved[field.key] ?? DEFAULT_APP_LIMITS[field.key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate)
      || candidate < field.min || candidate > field.max) {
      throw new Error(`${field.label}: indica um número inteiro entre ${field.min} e ${field.max}.`);
    }
    limits[field.key] = candidate;
  }
  return limits;
}

export function parseAppLimitDraft(draft: Record<keyof AppLimits, string>): AppLimits {
  const values: Record<string, unknown> = {};
  for (const field of APP_LIMIT_FIELDS) {
    const raw = draft[field.key].trim();
    if (!/^\d+$/.test(raw)) {
      throw new Error(`${field.label}: indica um número inteiro.`);
    }
    values[field.key] = Number(raw);
  }
  return validateAppLimits(values);
}

export async function getAppLimits(): Promise<AppLimits> {
  const value = await getSetting<unknown>(APP_LIMITS_SETTING_KEY, DEFAULT_APP_LIMITS);
  return validateAppLimits(value);
}

export async function saveAppLimits(limits: AppLimits): Promise<void> {
  await setSetting(APP_LIMITS_SETTING_KEY, validateAppLimits(limits));
}

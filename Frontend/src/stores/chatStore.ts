import { create } from 'zustand';
import {
  createChat as insertChat,
  deleteChat as removeChat,
  getChat,
  listChats,
  listMessages,
  saveMessage,
  searchChats as searchLocalChats,
  updateChatTitle,
} from '../db/repositories/chats.repo';
import { createId } from '../db/ids';
import { deleteLocalFile } from '../services/localFiles';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { tutorReply, saveTutorReply } from '../services/tutor/tutor';
import { getAppLimits } from '../services/appLimits';

export class ChatAttachmentTooLargeError extends Error {
  readonly code = 'CHAT_ATTACHMENT_TOO_LARGE';

  constructor(
    readonly kind: 'image' | 'document',
    readonly maxBytes: number,
  ) {
    super(`${kind} exceeds ${maxBytes} bytes`);
    this.name = 'ChatAttachmentTooLargeError';
  }
}


export function base64ByteLength(base64: string): number {
  const clean = base64
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s/g, '');
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

// Images are compressed on-device; the server counts their actual stored bytes.
export async function prepareChatImageForUpload(
  base64: string,
  mimeType: string,
): Promise<{ base64: string; mimeType: string }> {
  const maxBytes = (await getAppLimits()).chatAttachmentMiB * 1024 * 1024;
  let prepared = { base64, mimeType };
  try {
    const uri = `data:${mimeType};base64,${base64}`;
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (result.base64) {
      prepared = { base64: result.base64, mimeType: 'image/jpeg' };
    }
  } catch (err) {
    // Se a compressão falhar por algum motivo, seguimos com a imagem
    // original em vez de bloquear o envio da mensagem.
    console.error('Erro ao comprimir imagem, a usar original:', err);
  }

  // O limite por anexo do chat é 15 MB. Validamos os bytes da imagem
  // final, depois da compressão, para não rejeitar desnecessariamente uma
  // fotografia original grande que ficaria pequena o suficiente.
  if (base64ByteLength(prepared.base64) > maxBytes) {
    throw new ChatAttachmentTooLargeError('image', maxBytes);
  }
  return prepared;
}

export interface Chat {
  id: string;
  space_id: string;
  user_id: string;
  title: string;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  space?: { name: string; icon: string; color: string } | null;
}

export interface QuizFlashcardItem {
  question?: string;
  options?: string[];
  correct_index?: number;
  explanation?: string;
  front?: string;
  back?: string;
}

export interface QuizFlashcardsPayload {
  mode: 'quiz' | 'flashcards';
  title: string;
  items: QuizFlashcardItem[];
}

export interface WebSource {
  url: string;
  title?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'tutor';
  content: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  attachments?: { name: string; mimeType: string; uri: string; size: number }[];
  quiz?: QuizFlashcardsPayload | null;
  sources?: WebSource[] | null;
  created_at: string;
}

function visibleStoredMessageContent(content: string): string {
  return (content || '')
    .replace(
      /<oren_attachment_context\b[^>]*>[\s\S]*?<\/oren_attachment_context>/gi,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function messageImageUrls(message: Message): string[] {
  if (Array.isArray(message.image_urls) && message.image_urls.length > 0) {
    return message.image_urls.filter(Boolean);
  }
  return message.image_url ? [message.image_url] : [];
}

function savedMessageReplacesOptimistic(saved: Message, optimistic: Message): boolean {
  if (saved.role !== optimistic.role) return false;
  if (
    visibleStoredMessageContent(saved.content) !==
    visibleStoredMessageContent(optimistic.content)
  ) {
    return false;
  }

  const savedImages = messageImageUrls(saved);
  const optimisticImages = messageImageUrls(optimistic);
  if (savedImages.length === 0 && optimisticImages.length === 0) return true;
  if (savedImages.length === 0 || optimisticImages.length === 0) return false;

  // O backend reutiliza as mesmas URLs enviadas pelo frontend. Comparar por
  // interseção também mantém compatibilidade com a coluna legada image_url,
  // que conserva apenas a primeira imagem do lote.
  return savedImages.some((url) => optimisticImages.includes(url));
}

export interface ChatImageInput {
  base64: string;
  mimeType: string;
}

export interface ChatDocumentInput {
  base64: string;
  mimeType: string;
  name: string;
}

interface LocalChatAttachment {
  name: string;
  mimeType: string;
  uri: string;
  size: number;
}

async function persistChatAttachments(
  chatId: string,
  images: ChatImageInput[],
  documents: ChatDocumentInput[],
): Promise<LocalChatAttachment[]> {
  const attachments: LocalChatAttachment[] = [];
  const inputs = [
    ...images.map((image, index) => ({
      name: `image-${index + 1}.${image.mimeType.split('/')[1] || 'bin'}`,
      mimeType: image.mimeType,
      base64: image.base64,
    })),
    ...documents.map((document) => ({
      name: document.name,
      mimeType: document.mimeType,
      base64: document.base64,
    })),
  ];
  const limits = await getAppLimits();
  const webLimit = limits.webChatAttachmentMiB * 1024 * 1024;
  const attachmentLimit = limits.chatAttachmentMiB * 1024 * 1024;
  for (const [index, input] of inputs.entries()) {
    const size = base64ByteLength(input.base64);
    if (size > attachmentLimit) throw new ChatAttachmentTooLargeError('document', attachmentLimit);
    if (Platform.OS === 'web') {
      if (size > webLimit) throw new ChatAttachmentTooLargeError('document', webLimit);
      attachments.push({
        name: input.name,
        mimeType: input.mimeType,
        uri: `data:${input.mimeType};base64,${input.base64}`,
        size,
      });
      continue;
    }
    if (!FileSystem.documentDirectory) throw new Error('O armazenamento local de ficheiros não está disponível.');
    const directory = `${FileSystem.documentDirectory}chat-attachments/${chatId}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const safeName = input.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
    const uri = `${directory}${createId()}-${index}-${safeName}`;
    await FileSystem.writeAsStringAsync(uri, input.base64, { encoding: FileSystem.EncodingType.Base64 });
    attachments.push({ name: input.name, mimeType: input.mimeType, uri, size });
  }
  return attachments;
}

let activeAbortController: AbortController | null = null;
let activeRequestId = 0;
let chatFetchVersion = 0;
let messagesFetchVersion = 0;

interface ChatState {
  loadedSpaceId: string | null;
  chats: Chat[];
  recentChats: Chat[];
  allChats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  canStop: boolean;
  recentLoading: boolean;
  error: string | null;
  fetchChats: (spaceId: string) => Promise<void>;
  fetchRecentChats: (limit?: number) => Promise<void>;
  fetchAllChats: () => Promise<void>;
  searchChats: (query: string) => Promise<Chat[]>;
  fetchChatById: (chatId: string) => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  createChat: (spaceId: string, title?: string) => Promise<Chat>;
  sendMessage: (chatId: string, content: string, images?: ChatImageInput[], document?: ChatDocumentInput | ChatDocumentInput[]) => Promise<void>;
  stopGeneration: () => void;
  renameChat: (chatId: string, title: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  clearCurrentChat: () => void;
  clearError: () => void;
  reset: () => void;
}

let chatsFetchVersion = 0;
let allChatsFetchVersion = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  loadedSpaceId: null,
  chats: [],
  recentChats: [],
  allChats: [],
  currentChat: null,
  messages: [],
  loading: false,
  sending: false,
  canStop: false,
  recentLoading: false,
  error: null,
  clearError: () => set({ error: null }),

  reset: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    activeRequestId += 1;
    chatFetchVersion += 1;
    allChatsFetchVersion += 1;
    messagesFetchVersion += 1;
    set({
      chats: [],
      recentChats: [],
      allChats: [],
      currentChat: null,
      messages: [],
      loading: false,
      sending: false,
      canStop: false,
      recentLoading: false,
      error: null,
    });
  },

  fetchChats: async (spaceId: string) => {
    const version = ++chatsFetchVersion;
    if (get().loadedSpaceId !== spaceId) set({ chats: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const data = await listChats(spaceId);
      if (version === chatsFetchVersion) set({ chats: data, loadedSpaceId: spaceId, loading: false });
    } catch (error) {
      console.error('Could not load local chats:', error);
      if (version === chatsFetchVersion) set({ loading: false });
      throw error;
    }
  },

  fetchAllChats: async () => {
    const version = ++allChatsFetchVersion;
    try {
      const rows = await listChats();
      if (version === allChatsFetchVersion) set({ allChats: rows });
    } catch (error) {
      console.error('Could not load all local chats:', error);
    }
  },

  fetchRecentChats: async (limit = 5) => {
    set({ recentLoading: true });
    try {
      const recentChats = await listChats(undefined, limit);
      set({ recentChats, recentLoading: false });
    } catch (error) {
      console.error('Could not load recent local chats:', error);
      set({ recentLoading: false });
      throw error;
    }
  },

  searchChats: async (query: string) => {
    if (!query.trim()) return [];
    return searchLocalChats(query.trim());
  },

  fetchChatById: async (chatId: string) => {
    const requestVersion = ++chatFetchVersion;
    const data = await getChat(chatId);
    if (!data) throw new Error(i18n.t('chat.errors.spaceNotFound'));
    if (requestVersion === chatFetchVersion) set({ currentChat: data });
  },

  fetchMessages: async (chatId: string) => {
    const requestVersion = ++messagesFetchVersion;
    set({ loading: true });
    let data: Awaited<ReturnType<typeof listMessages>>;
    try {
      data = await listMessages(chatId);
    } catch (error) {
      console.error('Could not load local messages:', error);
      if (requestVersion === messagesFetchVersion) set({ loading: false });
      throw error;
    }

    // Preservar quiz de mensagens temporárias que ainda estão no state:
    // quando o realtime dispara fetchMessages, a mensagem tutor real (da DB)
    // não tem o campo quiz (não é persistido na DB), mas a versão temporária
    // criada localmente em sendMessage() pode tê-lo. Fazemos merge por
    // conteúdo — se a msg da DB for tutor e o conteúdo bater com uma msg
    // em memória que tem quiz, copiamos o quiz para não o perder.
    if (requestVersion !== messagesFetchVersion) return;

    const currentMessages = get().messages.filter((message) => message.chat_id === chatId);
    const extrasByContent = new Map<
      string,
      { quiz?: QuizFlashcardsPayload | null; sources?: WebSource[] | null }
    >();
    for (const m of currentMessages) {
      if (m.role === 'tutor' && m.content && (m.quiz || m.sources?.length)) {
        extrasByContent.set(m.content.trim(), { quiz: m.quiz, sources: m.sources });
      }
    }

    const merged = (data || []).map((m) => {
      if (m.role === 'tutor' && m.content) {
        const preserved = extrasByContent.get(m.content.trim());
        if (preserved) {
          return {
            ...m,
            quiz: m.quiz ?? preserved.quiz,
            sources: Array.isArray(m.sources) ? m.sources : preserved.sources,
          };
        }
      }
      return m;
    });

    const optimisticMessages = currentMessages.filter(
      (message) => message.id.startsWith('temp-') && !merged.some(
        (saved) => savedMessageReplacesOptimistic(saved, message)
      )
    );
    set({ messages: [...merged, ...optimisticMessages], loading: false });
  },

  createChat: async (spaceId: string, title?: string) => {
    const data = await insertChat(spaceId, title || i18n.t('chat.defaultTitle'));

    set((state) => ({
      chats: [data, ...state.chats],
      recentChats: [data, ...state.recentChats],
      allChats: [data, ...state.allChats],
      currentChat: data,
    }));

    return data;
  },

  sendMessage: async (chatId: string, content: string, images: ChatImageInput[] = [], document?: ChatDocumentInput | ChatDocumentInput[]) => {
    const documents = Array.isArray(document) ? document : document ? [document] : [];
    if (!content.trim() && images.length === 0 && documents.length === 0) return;
    if (images.length + documents.length > 5) { set({ error: i18n.language.startsWith('pt') ? 'Máximo de 5 ficheiros por mensagem.' : 'Maximum 5 files per message.' }); return; }

    let spaceId = get().currentChat?.id === chatId ? get().currentChat?.space_id : undefined;
    if (!spaceId) {
      const data = await getChat(chatId);
      if (data) spaceId = data.space_id;
      else throw new Error(i18n.t('chat.errors.spaceNotFound'));
    }

    const tempUserId = createId();

    // Preview while attachment files are copied to the local app directory.
    const uploadedImageUrls = images.map(image => 'data:' + image.mimeType + ';base64,' + image.base64);

    const userMessage: Message = {
      id: tempUserId,
      chat_id: chatId,
      role: 'user',
      // O marcador do documento tem de estar aqui também — não só no que o
      // backend grava — para o card aparecer de imediato (otimista), antes
      // do fetchMessages trazer a versão real da DB.
      content: [content.trim(), ...documents.map(item => '📄 [Documento: ' + item.name + ']')].filter(Boolean).join('\n\n'),
      image_url: uploadedImageUrls[0] || null,
      image_urls: uploadedImageUrls,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      sending: true,
      error: null,
    }));

    const controller = new AbortController();
    const requestId = ++activeRequestId;
    activeAbortController = controller;
    set({ canStop: false });
    const stopDelay = setTimeout(() => {
      if (activeRequestId === requestId && get().sending) set({ canStop: true });
    }, 700);

    try {
      try {
        const attachments = await persistChatAttachments(chatId, images, documents);
        const localMessage: Message = {
          ...userMessage,
          image_url: attachments.find((item) => item.mimeType.startsWith('image/'))?.uri || null,
          image_urls: attachments.filter((item) => item.mimeType.startsWith('image/')).map((item) => item.uri),
          attachments,
        };
        await saveMessage(localMessage);
        if (requestId !== activeRequestId || controller.signal.aborted) return;
        set((state) => ({
          messages: state.messages.map((message) => message.id === tempUserId ? localMessage : message),
          recentChats: state.recentChats.map((chat) => chat.id === chatId
            ? { ...chat, last_message_preview: localMessage.content.slice(0, 180), updated_at: localMessage.created_at }
            : chat),
          allChats: state.allChats.map((chat) => chat.id === chatId
            ? { ...chat, last_message_preview: localMessage.content.slice(0, 180), updated_at: localMessage.created_at }
            : chat),
        }));

        const result = await tutorReply({
          chatId,
          content,
          images,
          documents,
          signal: controller.signal,
        });
        if (requestId !== activeRequestId || controller.signal.aborted) return;
        const assistantId = await saveTutorReply(chatId, result.reply, result.quiz);
        const assistantMessage: Message = {
          id: assistantId,
          chat_id: chatId,
          role: 'tutor',
          content: result.reply,
          quiz: result.quiz,
          created_at: new Date().toISOString(),
        };
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          recentChats: state.recentChats.map((chat) => chat.id === chatId
            ? { ...chat, last_message_preview: result.reply.slice(0, 180), updated_at: assistantMessage.created_at }
            : chat),
          allChats: state.allChats.map((chat) => chat.id === chatId
            ? { ...chat, last_message_preview: result.reply.slice(0, 180), updated_at: assistantMessage.created_at }
            : chat),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: message });
        throw error;
      }

    } finally {
      clearTimeout(stopDelay);
      if (activeRequestId === requestId) {
        activeAbortController = null;
        set({ sending: false, canStop: false });
      }
    }
  },

  stopGeneration: () => {
    if (activeAbortController && get().canStop) {
      activeAbortController.abort();
      activeAbortController = null;
      activeRequestId += 1;
      set({ sending: false, canStop: false });
    }
  },

  renameChat: async (chatId: string, title: string) => {
    await updateChatTitle(chatId, title);
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, title } : c)),
      recentChats: state.recentChats.map((c) => (c.id === chatId ? { ...c, title } : c)),
      allChats: state.allChats.map((c) => (c.id === chatId ? { ...c, title } : c)),
      currentChat:
        state.currentChat?.id === chatId
          ? { ...state.currentChat, title }
          : state.currentChat,
    }));
  },

  deleteChat: async (chatId: string) => {
    const messages = await listMessages(chatId);
    for (const message of messages) {
      for (const attachment of message.attachments) await deleteLocalFile(attachment.uri);
    }
    await removeChat(chatId);

    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      recentChats: state.recentChats.filter((c) => c.id !== chatId),
      allChats: state.allChats.filter((c) => c.id !== chatId),
      currentChat: state.currentChat?.id === chatId ? null : state.currentChat,
      messages: state.currentChat?.id === chatId ? [] : state.messages,
    }));
  },

  clearCurrentChat: () => set({ currentChat: null, messages: [] }),
}));

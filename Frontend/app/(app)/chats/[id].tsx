import { AttachmentViewer } from "../../../src/components/chat/AttachmentViewer";
import { readAttachmentBase64 } from '../../../src/utils/readAttachmentBase64';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import MathText from "../../../src/components/chat/Mathtext";
import { MessageActions } from "../../../src/components/chat/MessageActions";
import { QuizFlashcards } from "../../../src/components/chat/QuizFlashcards";
import { TypingIndicator } from "../../../src/components/chat/TypingIndicator";
import { OrenAvatar } from "../../../src/components/common/OrenAvatar";
import { showAppDialog } from "../../../src/components/ui/AppDialog";
import { getApiKey } from "../../../src/services/ai/keyStore";
import { DEFAULT_APP_LIMITS, getAppLimits } from "../../../src/services/appLimits";
import { useThemeColors } from "../../../src/constants/theme";
import { useDateFnsLocale } from "../../../src/i18n/dateFnsLocale";
import {
  base64ByteLength,
  ChatAttachmentTooLargeError,
  prepareChatImageForUpload,
  useChatStore,
} from "../../../src/stores/chatStore";
import type { WebSource } from "../../../src/stores/chatStore";

const BUBBLE_COLORS = ["#3B82F6", "#F97316", "#10B981", "#8B5CF6", "#EC4899"];

function useFeatureChips(): {
  icon: "camera-outline" | "calendar-outline" | "map-outline" | "bulb-outline";
  label: string;
  prompt: string;
  desc: string;
}[] {
  const { t } = useTranslation();
  return [
    {
      icon: "camera-outline",
      label: t("chat.featureChips.solveExercise.label"),
      prompt: t("chat.featureChips.solveExercise.prompt"),
      desc: t("chat.featureChips.solveExercise.desc"),
    },
    {
      icon: "calendar-outline",
      label: t("chat.featureChips.scheduleTest.label"),
      prompt: t("chat.featureChips.scheduleTest.prompt"),
      desc: t("chat.featureChips.scheduleTest.desc"),
    },
    {
      icon: "map-outline",
      label: t("chat.featureChips.studyPlan.label"),
      prompt: t("chat.featureChips.studyPlan.prompt"),
      desc: t("chat.featureChips.studyPlan.desc"),
    },
    {
      icon: "bulb-outline",
      label: t("chat.featureChips.explainTopic.label"),
      prompt: t("chat.featureChips.explainTopic.prompt"),
      desc: t("chat.featureChips.explainTopic.desc"),
    },
  ];
}

function AnimatedMessage({
  children,
  animate,
  onAnimationStart,
}: {
  children: React.ReactNode;
  animate: boolean;
  onAnimationStart?: () => void;
}) {
  // Mensagens do histórico inicial (animate=false) não pagam o custo de
  // montar/agendar uma animação Animated cada uma — aparecem já no valor
  // final. Só mensagens realmente novas (recebidas depois do chat já estar
  // carregado) usam o fade+slide de entrada, e só na primeira vez que são
  // montadas (onAnimationStart marca o ID como "já visto" no chamador).
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 8 : 0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!animate || started.current) return;
    started.current = true;
    onAnimationStart?.();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  if (!animate) {
    // Nem sequer precisa de Animated.View — View simples evita qualquer
    // overhead de driver de animação para o caso comum (histórico).
    return <View>{children}</View>;
  }

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function WebSourcesPanel({ sources }: { sources?: WebSource[] | null }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!sources?.length) return null;

  return (
    <View
      style={[styles.sourcesPanel, { borderColor: colors.border }]}
    >
      <TouchableOpacity
        style={styles.sourcesHeader}
        onPress={() => setExpanded((value) => !value)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text
          style={[styles.sourcesTitle, { color: colors.textSecondary }]}
        >
          {t("chat.webSources.title", { count: sources.length })}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sourcesList}>
          {sources.map((source, index) => {
            let domain = source.url;
            try {
              domain = new URL(source.url).hostname.replace(/^www\./, "");
            } catch {}
            const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
            return (
              <TouchableOpacity
                key={`${source.url}-${index}`}
                style={styles.sourceRow}
                onPress={() => Linking.openURL(source.url)}
                activeOpacity={0.7}
                accessibilityRole="link"
              >
                <Image source={{ uri: favicon }} style={styles.sourceLogo} />
                <View style={styles.sourceTextWrap}>
                  <Text
                    style={[styles.sourceName, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {source.title || domain}
                  </Text>
                  <Text
                    style={[styles.sourceDomain, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {domain}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function ChatThread() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const FEATURE_CHIPS = useFeatureChips();
  const { id, autoMessage, messageId } = useLocalSearchParams<{
    id: string;
    autoMessage?: string;
    messageId?: string;
  }>();

  const {
    messages,
    loading,
    sending,
    canStop,
    error,
    currentChat,
    fetchMessages,
    fetchChatById,
    sendMessage,
    stopGeneration,
    clearError,
    renameChat,
    deleteChat,
  } = useChatStore();

  const returnToSpace = () => {
    const state = useChatStore.getState();
    // The store may still hold the previous chat while this route is loading.
    const chat = state.currentChat?.id === id ? state.currentChat
      : state.chats.find(item => item.id === id) ?? state.recentChats.find(item => item.id === id);
    router.dismissTo(chat?.space_id ? `/(app)/spaces/${chat.space_id}` : '/(app)/dashboard');
  };
  const [previewAttachment, setPreviewAttachment] = useState<{ uri: string; name?: never } | { name: string; uri?: never } | null>(null);
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<{
    id: string;
    base64: string;
    mimeType: string;
    previewUri: string;
    processing: boolean;
  }[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<{
    base64: string;
    mimeType: string;
    name: string;
  }[]>([]);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const pasteInProgress = useRef(false);
  const [isPreparingDocument, setIsPreparingDocument] = useState(false);
  const [chatAttachmentLimitMiB, setChatAttachmentLimitMiB] = useState(DEFAULT_APP_LIMITS.chatAttachmentMiB);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hasAiKey, setHasAiKey] = useState<boolean | null>(null);

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [chatTitleInput, setChatTitleInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para a cor da bolha do utilizador (padrão: Azul). A escolha é
  // persistida localmente no dispositivo via AsyncStorage, para que ao sair
  // e voltar ao app (ou ao chat) a cor preferida continue a mesma.
  const bubbleColorStorageKey = "user-bubble-color";
  const [userBubbleColor, setUserBubbleColor] = useState(BUBBLE_COLORS[0]);

  const flatListRef = useRef<FlatList>(null);
  const hasAutoSent = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const initialScrollDoneForId = useRef<string | null>(null);
  const wasSending = useRef(false);
  const inputFocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollMessageId = useRef<string | null>(null);
  const isAtBottom = useRef(true);
  const awaitingWebReply = useRef(false);
  const webReplyBaseline = useRef<string | null>(null);
  const holdWebReplyStart = useRef(false);
  const pendingWebReply = useRef<string | null>(null);
  const webMessageNodes = useRef(new Map<string, any>());

  const revealWebReply = useCallback(() => {
    if (Platform.OS !== "web" || !pendingWebReply.current) return;
    const node = webMessageNodes.current.get(pendingWebReply.current);
    const viewport = flatListRef.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node?.getBoundingClientRect || !viewport?.getBoundingClientRect) return;
    const offset = viewport.scrollTop + node.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12;
    pendingWebReply.current = null;
    flatListRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true });
  }, []);

  // IDs de mensagens já presentes no momento em que o histórico deste chat
  // terminou de carregar. Usado só para decidir se uma mensagem deve entrar
  // com animação (nova, chegada depois) ou aparecer já no estado final
  // (histórico antigo) — ver AnimatedMessage/renderMessageWithLayout.
  const initialMessageIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (id) {
      useChatStore.getState().clearCurrentChat();
      initialScrollDoneForId.current = null;
      awaitingWebReply.current = false;
      holdWebReplyStart.current = false;
      pendingWebReply.current = null;
      webMessageNodes.current.clear();
      pendingScrollMessageId.current = messageId || null;
      hasAutoSent.current = false;
      // Ainda não sabemos o histórico deste chat — enquanto for null,
      // renderMessageWithLayout trata tudo como "histórico" (sem animar),
      // o que é o comportamento seguro por defeito até o fetch resolver.
      initialMessageIdsRef.current = null;
      if (inputFocusTimer.current) clearTimeout(inputFocusTimer.current);
      inputFocusTimer.current = setTimeout(
        () => inputRef.current?.focus(),
        250,
      );
      Promise.all([
        fetchMessages(id),
        fetchChatById(id),
      ]).catch(console.error);
    }return () => {
      if (inputFocusTimer.current) clearTimeout(inputFocusTimer.current);
    };
  }, [id, messageId, fetchMessages, fetchChatById]);

  // Assim que as mensagens chegam pela primeira vez depois de trocar de
  // chat, guardamos o conjunto de IDs como "histórico" — tudo o que já
  // está aqui não deve animar a entrada. Só corre uma vez por chat
  // (enquanto initialMessageIdsRef for null); depois disso, qualquer
  // mensagem com um ID que não esteja neste Set é tratada como nova.
  useEffect(() => {
    if (initialMessageIdsRef.current === null && messages.length > 0) {
      initialMessageIdsRef.current = new Set(messages.map((m: any) => m.id));
    }
  }, [messages]);

  // ─── RASCUNHO PERSISTENTE ────────────────────────────────────────────────
  // Guarda o texto que o utilizador está a escrever por chat (id), para que
  // ao sair e voltar ao mesmo chat o texto ainda lá esteja.
  const draftStorageKey = id ? `chat-draft:${id}` : null;
  const draftLoadedForId = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !draftStorageKey) return;
    // Evita voltar a carregar o rascunho se o id não mudou (ex: re-renders).
    if (draftLoadedForId.current === id) return;
    draftLoadedForId.current = id;

    AsyncStorage.getItem(draftStorageKey)
      .then((saved) => {
        if (saved) setInput(saved);
      })
      .catch(() => {});
  }, [id, draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    // Debounce simples para não escrever no storage a cada tecla.
    const t = setTimeout(() => {
      if (input.trim()) {
        AsyncStorage.setItem(draftStorageKey, input).catch(() => {});
      } else {
        AsyncStorage.removeItem(draftStorageKey).catch(() => {});
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, draftStorageKey]);

  // ─── COR DA BOLHA PERSISTENTE ────────────────────────────────────────────
  // Carrega a cor guardada no arranque (uma única vez) e grava sempre que o
  // utilizador a altera, para que fique guardada no cache do telemóvel.
  useEffect(() => {
    AsyncStorage.getItem(bubbleColorStorageKey)
      .then((saved) => {
        if (saved && BUBBLE_COLORS.includes(saved)) {
          setUserBubbleColor(saved);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(bubbleColorStorageKey, userBubbleColor).catch(
      () => {},
    );
  }, [userBubbleColor]);

  useEffect(() => {
    if (currentChat?.title) {
      setChatTitleInput(currentChat.title);
    }
  }, [currentChat?.title]);

  useEffect(() => {
    if (autoMessage && !hasAutoSent.current && !loading && id) {
      hasAutoSent.current = true;
      sendMessage(id, autoMessage).catch(console.error);
    }
  }, [autoMessage, loading, id, sendMessage]);

  useEffect(() => {
    let active = true;
    void getApiKey().then(key => { if (active) setHasAiKey(!!key); })
      .catch(error => {
        console.error('Could not check local OpenRouter key:', error);
        if (active) setHasAiKey(false);
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const startedSending = sending && !wasSending.current;
    wasSending.current = sending;
    if (!startedSending || !flatListRef.current) return;
    if (Platform.OS === "web") {
      awaitingWebReply.current = true;
      webReplyBaseline.current = [...useChatStore.getState().messages].reverse().find(message => message.role === "tutor")?.id ?? null;
      holdWebReplyStart.current = false;
      pendingWebReply.current = null;
    }
    requestAnimationFrame(() => {
      if (!holdWebReplyStart.current) flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, [sending]);

  useEffect(() => {
    if (!messages.length || initialScrollDoneForId.current !== id) return;
    const lastMessage = messages[messages.length - 1];
    if (Platform.OS === "web") {
      if (awaitingWebReply.current && lastMessage?.role === "tutor" && lastMessage.id !== webReplyBaseline.current) {
        awaitingWebReply.current = false;
        holdWebReplyStart.current = true;
        isAtBottom.current = false;
        pendingWebReply.current = lastMessage.id;
        // Mount the last virtualized cell if needed, then align its actual DOM position.
        if (!webMessageNodes.current.has(lastMessage.id)) flatListRef.current?.scrollToEnd({ animated: false });
        requestAnimationFrame(revealWebReply);
      }
      if (holdWebReplyStart.current) return;
    }
    if (!isAtBottom.current) {
      return;
    }
    if (lastMessage)
      requestAnimationFrame(() => {
        if (!holdWebReplyStart.current) flatListRef.current?.scrollToEnd({ animated: true });
      });
  }, [messages, id, revealWebReply]);

  const scrollToMessage = useCallback(
    (targetId: string, items: typeof messages) => {
      const index = items.findIndex((message) => message.id === targetId);
      if (index < 0) return;
      pendingScrollMessageId.current = targetId;
      flatListRef.current?.scrollToIndex({
        index,
        animated: false,
        viewPosition: 0.15,
      });
    },
    [],
  );

  const scrollToInitialEnd = useCallback(() => {
    if (!id || !messages.length || initialScrollDoneForId.current === id)
      return;
    initialScrollDoneForId.current = id;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (messageId) scrollToMessage(messageId, messages);
        else flatListRef.current?.scrollToEnd({ animated: false });
      });
    });
  }, [id, messageId, messages, scrollToMessage]);

  const handleContentSizeChange = useCallback(() => {
    if (!id || !messages.length) return;
    if (Platform.OS === "web" && holdWebReplyStart.current) {
      requestAnimationFrame(revealWebReply);
      return;
    }
    if (initialScrollDoneForId.current !== id) {
      scrollToInitialEnd();
    } else if (isAtBottom.current) {
      requestAnimationFrame(() => {
        if (!holdWebReplyStart.current) flatListRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [id, messages.length, scrollToInitialEnd, revealWebReply]);



  const requestCameraAccess = async (): Promise<boolean> => {
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) return true;

    if (!current.canAskAgain) {
      showAppDialog(
        t("chat.permissions.cameraTitle"),
        t("chat.permissions.cameraDeniedMessage"),
      );
      return false;
    }

    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (!requested.granted) {
      showAppDialog(
        t("chat.permissions.cameraTitle"),
        t("chat.permissions.cameraRejectedMessage"),
      );
      return false;
    }
    return true;
  };

  const showAttachmentSizeLimit = (kind: "image" | "document") => {
    showAppDialog(
      t(`chat.attachMenu.${kind === "image" ? "imageTooBigTitle" : "docTooBigTitle"}`),
      t(`chat.attachMenu.${kind === "image" ? "imageTooBigMessage" : "docTooBigMessage"}`, { limit: chatAttachmentLimitMiB }),
      undefined,
      { variant: "warning", icon: kind === "image" ? "image-outline" : "document-outline" },
    );
  };

  useEffect(() => {
    let active = true;
    void getAppLimits().then(limits => {
      if (active) setChatAttachmentLimitMiB(
        Platform.OS === "web"
          ? Math.min(limits.chatAttachmentMiB, limits.webChatAttachmentMiB)
          : limits.chatAttachmentMiB,
      );
    }).catch(error => showAppDialog('Erro ao carregar limites', String(error), undefined, { variant: 'danger' }));
    return () => { active = false; };
  }, []);

  const remainingAttachmentSlots = Math.max(
    0,
    5 - attachedImages.length - attachedDocuments.length,
  );

  const attachPreparedImages = async (
    assets: ImagePicker.ImagePickerAsset[],
  ) => {
    const availableAssets = assets.slice(0, remainingAttachmentSlots);
    if (availableAssets.length === 0) {
      showAppDialog(t('chat.attachMenu.title'), t('chat.pasteImageLimit', { defaultValue: 'Máximo de 5 ficheiros por mensagem.' }));
      return;
    }

    // Mostra as miniaturas assim que o picker devolve os assets. Compressão
    // e validação acontecem depois, em paralelo, com o envio bloqueado.
    const pendingImages = availableAssets.map((asset, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        base64: "",
        mimeType: asset.mimeType || "image/jpeg",
        previewUri: asset.uri,
        processing: true,
        sourceBase64: asset.base64 || undefined,
      }));

    if (pendingImages.length === 0) return;
    setAttachedImages(current => [
      ...current,
      ...pendingImages.map(({ sourceBase64: _sourceBase64, ...image }) => image),
    ]);

    const results = await Promise.all(
      pendingImages.map(async (image) => {
        try {
          const sourceBase64 =
            image.sourceBase64 ||
            (await readAttachmentBase64(image.previewUri));
          const prepared = await prepareChatImageForUpload(
            sourceBase64,
            image.mimeType,
          );
          return {
            id: image.id,
            prepared: {
              base64: prepared.base64,
              mimeType: prepared.mimeType,
              processing: false,
            },
          };
        } catch (error) {
          if (!(error instanceof ChatAttachmentTooLargeError)) {
            console.error("Erro ao preparar imagem:", error);
          }
          return {
            id: image.id,
            prepared: null,
            tooLarge: error instanceof ChatAttachmentTooLargeError,
          };
        }
      }),
    );

    const resultById = new Map(results.map((result) => [result.id, result]));
    setAttachedImages((current) =>
      current.flatMap((image) => {
        const result = resultById.get(image.id);
        if (!result) return [image];
        return result.prepared ? [{ ...image, ...result.prepared }] : [];
      }),
    );
    if (results.some((result) => result.tooLarge)) {
      showAttachmentSizeLimit("image");
    }
  };

  // Listen only on the composer: pasting elsewhere must keep browser behavior.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const textarea = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (!textarea) return;
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
      if (!files.length) return; // Plain text keeps native selection/caret behavior.
      event.preventDefault();
      if (pasteInProgress.current || isPreparingImage || isPreparingDocument || sending) return;
      if (remainingAttachmentSlots <= 0) {
        if (attachedImages.length + attachedDocuments.length >= 5) {
          showAppDialog(t('chat.attachMenu.title'), t('chat.pasteImageLimit', { defaultValue: 'Máximo de 5 ficheiros por mensagem.' }));
        } else void attachPreparedImages([]);
        return;
      }
      const text = event.clipboardData?.getData('text/plain');
      if (text) {
        const start = textarea.selectionStart, end = textarea.selectionEnd;
        setInput(value => (value.slice(0, start) + text + value.slice(end)).slice(0, 5000));
      }
      pasteInProgress.current = true;
      setIsPreparingImage(true);
      void (async () => {
        try {
          const assets = await Promise.all(files.slice(0, remainingAttachmentSlots).map(async file => {
            const uri = URL.createObjectURL(file);
            try {
              const base64 = await readAttachmentBase64(uri);
              return { uri: 'data:' + file.type + ';base64,' + base64, base64, mimeType: file.type, width: 0, height: 0, fileName: file.name };
            } finally { URL.revokeObjectURL(uri); }
          }));
          await attachPreparedImages(assets);
        } catch (error) {
          console.error('Could not paste image:', error);
          showAppDialog(t('chat.attachMenu.title'), t('chat.pasteImageError', { defaultValue: 'Não foi possível colar a imagem. Tenta carregar o ficheiro.' }));
        } finally {
          pasteInProgress.current = false;
          setIsPreparingImage(false);
        }
      })();
    };
    textarea.addEventListener('paste', paste);
    return () => textarea.removeEventListener('paste', paste);
  }, [attachPreparedImages, attachedImages.length, attachedDocuments.length, isPreparingImage, isPreparingDocument, remainingAttachmentSlots, sending, t]);

  const handlePickFromGallery = async () => {
    setShowAttachMenu(false);
    if (isPreparingImage || isPreparingDocument || pasteInProgress.current) return;
    if (remainingAttachmentSlots <= 0) {
      await attachPreparedImages([]);
      return;
    }
    setIsPreparingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // A leitura/conversão é feita depois de os URIs já aparecerem no
        // compositor; pedir base64 aqui bloquearia o retorno do picker.
        base64: Platform.OS === "web",
        quality: 0.3,
        allowsMultipleSelection: true,
        selectionLimit: remainingAttachmentSlots,
      });
      if (!result.canceled && result.assets?.length) {
        await attachPreparedImages(result.assets);
      }
    } finally {
      setIsPreparingImage(false);
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachMenu(false);
    if (isPreparingImage) return;
    if (remainingAttachmentSlots <= 0) {
      await attachPreparedImages([]);
      return;
    }
    const granted = await requestCameraAccess();
    if (!granted) return;

    setIsPreparingImage(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        base64: false,
        quality: 0.3,
      });
      if (!result.canceled && result.assets?.[0]) {
        await attachPreparedImages([result.assets[0]]);
      }
    } finally {
      setIsPreparingImage(false);
    }
  };

  const handleSend = async () => {
    if (
      (!input.trim() && attachedImages.length === 0 && attachedDocuments.length === 0) ||
      sending ||
      isPreparingImage || isPreparingDocument ||
      attachedImages.some((image) => image.processing) ||
      !id
    )
      return;
    const toSend = input.trim();
    const originalImages = attachedImages;
    const originalDocument = attachedDocuments;
    const messageBeingEdited = editingMessageId;
    const images = attachedImages.map(({ base64, mimeType }) => ({
      base64,
      mimeType,
    }));
    const documents = attachedDocuments;
    setInput("");
    setEditingMessageId(null);
    setAttachedImages([]);
    setAttachedDocuments([]);
    clearError();
    if (draftStorageKey) {
      AsyncStorage.removeItem(draftStorageKey).catch(() => {});
    }
    try {
      if (messageBeingEdited) {
        useChatStore.setState((state) => ({
          messages: state.messages.map((message) =>
            message.id === messageBeingEdited
              ? { ...message, content: toSend }
              : message,
          ),
        }));
      }
      await sendMessage(id, toSend, images, documents);
      const sendError = useChatStore.getState().error;
      if (sendError) {
        // Falha de comunicação: devolve tudo ao compositor para o
        // aluno poder tentar novamente sem perder texto nem anexos.
        setInput(toSend);
        setAttachedImages(originalImages);
        setAttachedDocuments(originalDocument);
        if (draftStorageKey && toSend) {
          AsyncStorage.setItem(draftStorageKey, toSend).catch(() => {});
        }
        return;
      }
      if (messageBeingEdited) {
        useChatStore.setState((state) => ({
          messages: state.messages.filter(
            (message) => message.id !== messageBeingEdited,
          ),
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickDocument = async () => {
    if (isPreparingDocument || isPreparingImage || pasteInProgress.current) return;
    setShowAttachMenu(false);
    if (remainingAttachmentSlots <= 0) { await attachPreparedImages([]); return; }
    setIsPreparingDocument(true);
    try {
      const limits = await getAppLimits();
      const maxMiB = Platform.OS === "web"
        ? Math.min(limits.chatAttachmentMiB, limits.webChatAttachmentMiB)
        : limits.chatAttachmentMiB;
      setChatAttachmentLimitMiB(maxMiB);
      const maxAttachmentBytes = maxMiB * 1024 * 1024;
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (!result.canceled) {
        const imageAssets: ImagePicker.ImagePickerAsset[] = [];
        const documents: typeof attachedDocuments = [];
        for (const asset of result.assets.slice(0, remainingAttachmentSlots)) {
          if (asset.mimeType?.toLowerCase().startsWith('video/') || /\.(3g2|3gp|avi|divx|f4v|flv|m2ts|m4v|mkv|mov|mp4|mpe?g|mts|ogv|qt|rm|rmvb|ts|vob|webm|wmv)$/i.test(asset.name || '')) {
            showAppDialog(t('chat.errors.unsupportedVideoTitle'), t('chat.errors.unsupportedVideoMessage'));
            continue;
          }
          const isImage = asset.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(asset.name);
          if (!isImage && asset.size && asset.size > maxAttachmentBytes) { showAttachmentSizeLimit('document'); continue; }
          const base64 = await readAttachmentBase64(asset.uri);
          if (isImage) {
            imageAssets.push({ uri: asset.uri, base64, mimeType: asset.mimeType?.startsWith('image/') ? asset.mimeType : 'image/jpeg', width: 0, height: 0 });
          } else if (base64ByteLength(base64) > maxAttachmentBytes) {
            showAttachmentSizeLimit('document');
          } else documents.push({ base64, mimeType: asset.mimeType || 'application/octet-stream', name: asset.name || 'document' });
        }
        if (imageAssets.length) await attachPreparedImages(imageAssets);
        setAttachedDocuments(current => [...current, ...documents]);
      }
    } catch (error) { console.error('Could not attach files:', error); }
    finally { setIsPreparingDocument(false); }
  };

  const handleChipPress = useCallback((prompt: string) => {
    setInput(prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleRenameChat = async () => {
    if (!chatTitleInput.trim() || !id) return;
    setIsRenaming(true);
    try {
      await renameChat(id, chatTitleInput.trim());
      setShowOptionsModal(false);
    } catch (e: any) {
      showAppDialog(
        t("chat.errors.renameFailedTitle"),
        t("chat.errors.renameFailedMessage"),
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteChat = () => {
    showAppDialog(
      t("chat.deleteChatConfirm.title"),
      t("chat.deleteChatConfirm.message"),
      [
        { text: t("chat.deleteChatConfirm.cancel"), style: "cancel" },
        {
          text: t("chat.deleteChatConfirm.confirm"),
          style: "destructive",
          onPress: async () => {
            if (!id) return;
            setIsDeleting(true);
            const spaceId = currentChat?.space_id;
            try {
              await deleteChat(id);
              setShowOptionsModal(false);
              if (spaceId) {
                router.replace(`/(app)/spaces/${spaceId}`);
              } else {
                router.replace("/(app)/dashboard");
              }
            } catch (e: any) {
              showAppDialog(
                t("chat.errors.deleteFailedTitle"),
                t("chat.errors.deleteFailedMessage"),
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const renderFormattedText = useCallback(
    (content: string, isUser: boolean) => {
      if (!content) return null;

      return (
        <MathText
          content={content}
          isUser={isUser}
          textStyle={[
            styles.messageText,
            isUser
              ? { color: "#FFFFFF" }
              : {
                  fontFamily: "Inter_400Regular",
                  color: colors.textPrimary,
                  fontSize: Platform.OS === "web" ? 17 : 16.5,
                  lineHeight: Platform.OS === "web" ? 29 : 26,
                },
          ]}
          boldColor={isUser ? "#FFFFFF" : colors.textPrimary}
          formulaColor={isUser ? "#FFFFFF" : colors.textPrimary}
        />
      );
    },
    [colors],
  );

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      const isUser = item.role === "user";

      const imageUrls: string[] =
        Array.isArray(item.image_urls) && item.image_urls.length > 0
          ? item.image_urls
          : item.image_url
            ? [item.image_url]
            : [];
      const hasImage = imageUrls.length > 0;

      // Nota: esta deteção continua a assentar em texto em português porque
      // as mensagens antigas gravadas na base de dados (e as instruções do
      // backend) usam esses padrões. Isto é seguro porque só afeta a limpeza
      // visual do texto de fallback — não é texto visível ao utilizador.
      const hadImageButUrlMissing =
        !hasImage &&
        (/imagem anexada/i.test(item.content || "") ||
          /conte[úu]do extra[íi]do/i.test(item.content || "") ||
          /Conte[úu]do da [Ff]oto/i.test(item.content || "") ||
          /<oren_attachment_context\b[^>]*type="image"/i.test(
            item.content || "",
          ));

      // Deteção de documento anexado: o backend agora grava só o rótulo limpo
      // "📄 [Documento: nome.pdf]" no content (o texto extraído nunca chega à
      // mensagem visível — fica só no prompt enviado ao LLM). Extraímos o nome
      // para mostrar um card com ícone, como já fazemos com imagens.
      const attachmentLabels = (item.content || '').replace(/<oren_attachment_context\b[^>]*>[\s\S]*?<\/oren_attachment_context>/gi, '');
      const documentNames = Array.from(attachmentLabels.matchAll(/📄\s*\[Documento:\s*([^\]]+)\]/gi), match => String((match as RegExpMatchArray)[1]).trim());
      if (!documentNames.length && /📄\s*\[documento anexado\]/i.test(attachmentLabels)) documentNames.push(t('chat.attachMenu.docReady'));

      const textWithoutTags = (item.content || "")
        .replace(
          /<oren_attachment_context\b[^>]*>[\s\S]*?<\/oren_attachment_context>/gi,
          "",
        )
        .replace(
          /📎?\s*\[?Imagem anexada[\s\S]*?conte[úu]do extra[íi]do[\s\S]*$/gi,
          "",
        )
        .replace(
          /\[?\s*(Conte[úu]do da [Ff]oto|Conte[úu]do da [Ii]magem)\s*:[\s\S]*?(\]|$)/gi,
          "",
        )
        .replace(/📎?\s*\[imagem anexada\]/gi, "")
        .replace(/📄\s*\[Documento:[^\]]+\]/gi, "")
        .replace(/📄\s*\[documento anexado\]/gi, "")
        .replace(/\s*\[id:[^\]]+\]/gi, "")
        .replace(
          /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi,
          "",
        )
        .trim();

      // Uma mensagem só com imagens não ganha um balão de texto artificial.
      // O fallback visual abaixo continua disponível apenas para mensagens
      // antigas cuja URL já expirou ou não chegou a ser persistida.
      const cleanContent = textWithoutTags;

      if (isUser) {
        return (
          <View style={styles.userMessageRow}>
            {hasImage && (
              <ScrollView
                horizontal
                nestedScrollEnabled
                style={styles.sentImagesScrollUser}
                contentContainerStyle={styles.sentImagesRow}
              >
                {imageUrls.map((imageUrl, index) => (
                  <View
                    key={`${item.id}-image-${index}`}
                    style={[
                      styles.standaloneImageWrapUser,
                      { borderColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('attachmentViewer.openImage')} onPress={() => setPreviewAttachment({ uri: imageUrl })}><Image source={{ uri: imageUrl }} style={styles.messageImageSmall} resizeMode="cover" /></TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {!hasImage && hadImageButUrlMissing && (
              <View
                style={[
                  styles.fallbackImageWrap,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.fallbackImageText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("chat.analyzedImageLabel")}
                </Text>
              </View>
            )}
            {documentNames.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginBottom: 8 }}>
              {documentNames.map((name, index) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("attachmentViewer.openDocument", { name })} onPress={() => setPreviewAttachment({ name })} key={index} style={{ width: 80, height: 80, padding: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 10, textAlign: 'center' }}>{name}</Text>
              </TouchableOpacity>)}
            </View>}
            {!!cleanContent && (
              <View
                style={[
                  styles.userBubble,
                  { backgroundColor: userBubbleColor },
                ]}
              >
                {renderFormattedText(cleanContent, true)}
                <Text style={styles.timeUser}>
                  {format(new Date(item.created_at || Date.now()), "HH:mm", {
                    locale: dateLocale,
                  })}
                </Text>
              </View>
            )}
            {!!cleanContent && (
              <View style={styles.userActionsRow}>
                <MessageActions
                  content={cleanContent}
                  role="user"
                  align="flex-end"
                />
                <TouchableOpacity
                  style={styles.editMessageBtn}
                  onPress={() => {
                    setEditingMessageId(item.id);
                    setInput(cleanContent);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={t("chat.editMessage")}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="create-outline"
                    size={16}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }

      return (
        <View style={styles.tutorMessageRow}>
          <View style={styles.tutorHeader}>
            <OrenAvatar size={26} />
            <Text style={[styles.tutorName, { color: colors.textPrimary }]}>
              {t("chat.orenName")}
            </Text>
          </View>
          {hasImage && (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.sentImagesScrollTutor}
              contentContainerStyle={styles.sentImagesRow}
            >
              {imageUrls.map((imageUrl, index) => (
                <View
                  key={`${item.id}-image-${index}`}
                  style={[
                    styles.standaloneImageWrapTutor,
                    { borderColor: colors.border },
                  ]}
                >
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('attachmentViewer.openImage')} onPress={() => setPreviewAttachment({ uri: imageUrl })}><Image source={{ uri: imageUrl }} style={styles.messageImageSmall} resizeMode="cover" /></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <View
            style={[
              styles.tutorCard,
              {
                backgroundColor: "transparent",
                borderColor: "transparent",
                borderWidth: 0,
                paddingHorizontal: 4,
              },
            ]}
          >
            {renderFormattedText(cleanContent, false)}
            <WebSourcesPanel sources={item.sources} />
            <Text
              style={[styles.timeTutor, { color: colors.textSecondary }]}
            >
              {format(new Date(item.created_at || Date.now()), "HH:mm", {
                locale: dateLocale,
              })}
            </Text>
            {/* Quiz/flashcards interativos — vêm no mesmo pedido de
              tutor_reply que gerou o texto (ver backend/tutorEngine),
              zero pedidos extra de rede/IA para renderizar isto. */}
            {item.quiz && (
              <QuizFlashcards
                data={item.quiz}
                messageId={`${id}-${item.quiz.title || "quiz"}-${item.quiz.items?.length ?? 0}`}
                chatId={id as string}
              />
            )}
            <MessageActions
              content={cleanContent}
              role="tutor"
              align="flex-start"
            />
          </View>
        </View>
      );
    },
    [colors, dateLocale, id, renderFormattedText, t, userBubbleColor],
  );

  const renderMessageWithLayout = useCallback(
    ({ item }: { item: any }) => {
      // Uma mensagem anima a entrada só se: (a) já sabemos o histórico
      // inicial deste chat (Set já populado) e (b) o ID dela não estava
      // nesse snapshot — ou seja, chegou depois do carregamento inicial
      // (mensagem enviada agora, ou resposta do tutor a chegar).
      const isNew =
        initialMessageIdsRef.current !== null &&
        !initialMessageIdsRef.current.has(item.id);
      return (
        <View
          style={{ width: "100%" }}
          ref={Platform.OS === "web" ? (node) => {
            if (node) {
              webMessageNodes.current.set(item.id, node);
              if (pendingWebReply.current === item.id) requestAnimationFrame(revealWebReply);
            } else webMessageNodes.current.delete(item.id);
          } : undefined}
          onLayout={(event) => {
            if (pendingWebReply.current === item.id) requestAnimationFrame(revealWebReply);
            if (pendingScrollMessageId.current !== item.id) return;
            pendingScrollMessageId.current = null;
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToOffset({
                offset: Math.max(0, event.nativeEvent.layout.y - 12),
                animated: false,
              });
            });
          }}
        >
          <AnimatedMessage
            animate={isNew}
            onAnimationStart={() => {
              if (initialMessageIdsRef.current) {
                initialMessageIdsRef.current.add(item.id);
              }
            }}
          >
            {renderMessage({ item })}
          </AnimatedMessage>
        </View>
      );
    },
    [renderMessage, revealWebReply],
  );

  const handleScrollToIndexFailed = useCallback(
    ({ index }: { index: number }) => {
      setTimeout(
        () =>
          flatListRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0.15,
          }),
        80,
      );
    },
    [],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <View
          style={[
            styles.header,
            Platform.OS === "web" && styles.webHeader,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <TouchableOpacity
            onPress={returnToSpace}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text
              style={[styles.headerTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {currentChat?.title || t("chat.defaultTitle")}
            </Text>
            {currentChat?.space?.name ? (
              <View style={styles.spaceBadge}>
                <Ionicons
                  name="book-outline"
                  size={11}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[styles.headerSubtitle, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {currentChat.space.name}
                </Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => setShowOptionsModal(true)}
            style={[
              styles.iconBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={18}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>


        {/* MUDANÇA AQUI: SÓ MOSTRA O SPINNER DE LOADING SE FOR O PRIMEIRO CARREGAMENTO (SEM MENSAGENS) */}
        {loading && messages.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageWithLayout}
              contentContainerStyle={[styles.listContent, { width: '100%', maxWidth: 960, alignSelf: 'center' }, Platform.OS === "web" && styles.webListContent]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={10}
              maxToRenderPerBatch={6}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              onLayout={scrollToInitialEnd}
              onContentSizeChange={handleContentSizeChange}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } =
                  event.nativeEvent;
                const distanceFromBottom =
                  contentSize.height -
                  (contentOffset.y + layoutMeasurement.height);
                const atBottom = distanceFromBottom <= 32;
                isAtBottom.current = atBottom;
              }}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              scrollEventThrottle={100}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.avatarRing}>
                    <OrenAvatar size={52} />
                  </View>
                  <Text
                    style={[styles.emptyTitle, { color: colors.textPrimary }, Platform.OS === "web" && { fontSize: 32, lineHeight: 40, textAlign: "center" }]}
                  >
                    {t("chat.emptyState.title")}
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("chat.emptyState.subtitle")}
                  </Text>
                  <View style={[styles.promptGrid, Platform.OS === "web" && styles.webPromptGrid]}>
                    {FEATURE_CHIPS.map((chip) => (
                      <TouchableOpacity
                        key={chip.label}
                        style={[
                          styles.promptCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.surfaceElevated
                          },
                        ]}
                        onPress={() => handleChipPress(chip.prompt)}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.promptIconBox,
                            { backgroundColor: colors.primarySoft },
                          ]}
                        >
                          <Ionicons
                            name={chip.icon}
                            size={18}
                            color={colors.primary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.promptTitle,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {chip.label}
                        </Text>
                        <Text
                          style={[
                            styles.promptDesc,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {chip.desc}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
              ListFooterComponent={sending ? <TypingIndicator /> : null}
            />
          </>
        )}

        {hasAiKey === false && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/(app)/profile')}
            style={{ marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}>
              Para usar IA, defina a sua chave de API no Perfil
            </Text>
            <Ionicons name="chevron-forward" size={17} color={colors.primary} />
          </TouchableOpacity>
        )}
        {!!error && (
          <View
            style={[styles.errorBanner, { backgroundColor: colors.errorSoft }]}
          >
            <Text style={[styles.errorBannerText, { color: colors.error }]}>
              {error}
            </Text>
            <TouchableOpacity onPress={clearError} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <View style={Platform.OS === "web" ? styles.webAttachmentArea : undefined}>
      {(attachedImages.length > 0 || attachedDocuments.length > 0) && (
        <View style={styles.imagePreviewCarousel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.imagePreviewScroll}
          contentContainerStyle={[styles.imagePreviewList, Platform.OS === "web" && { paddingLeft: 0 }]}
          keyboardShouldPersistTaps="handled"
        >
          {attachedImages.map((attachedImage) => (
            <View
              key={attachedImage.id}
              style={[styles.imagePreviewThumb, { borderColor: colors.border }]}
            >
              <TouchableOpacity
                style={styles.imagePreviewOpen}
                accessibilityRole="button"
                accessibilityLabel={t('attachmentViewer.openImage')}
                onPress={() => setPreviewAttachment({ uri: attachedImage.previewUri })}
              >
                <Image source={{ uri: attachedImage.previewUri }} style={styles.imagePreviewThumbImage} resizeMode="cover" />
              </TouchableOpacity>
              {attachedImage.processing && (
                <View pointerEvents="none" style={styles.imagePreviewProcessing}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
              <TouchableOpacity
                style={[styles.imagePreviewRemove, { backgroundColor: colors.surface }]}
                onPress={() =>
                  setAttachedImages((current) =>
                    current.filter((image) => image.id !== attachedImage.id),
                  )
                }
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t("common.remove")}
              >
                <Ionicons name="close" size={14} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          ))}
          {attachedDocuments.map((file, index) => (
            <View key={index + '-' + file.name} style={[styles.imagePreviewThumb, { borderColor: colors.border, backgroundColor: colors.surface, padding: 6, alignItems: 'center', justifyContent: 'center' }]}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('attachmentViewer.openDocument', { name: file.name })} onPress={() => setPreviewAttachment({ name: file.name })} style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="document-text-outline" size={24} color={colors.primary} /><Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 10, textAlign: 'center' }}>{file.name}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.imagePreviewRemove, { backgroundColor: colors.surface }]} onPress={() => setAttachedDocuments(current => current.filter((_, i) => i !== index))} accessibilityLabel={t('common.remove')} hitSlop={6}>
                <Ionicons name="close" size={14} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        <Text pointerEvents="none" style={[styles.imagePreviewCount, { color: colors.textSecondary }]}>{attachedImages.length + attachedDocuments.length}/5</Text>
        </View>
      )}

      </View>

      <View
        style={[
          styles.inputContainer,
          { width: '100%', maxWidth: 960, alignSelf: 'center' },
          Platform.OS === "web" && styles.webInputContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom:
              Platform.OS === "android" ? 4 : Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View
          style={[
            styles.floatingInputCard,
            Platform.OS === "web" && styles.webInputCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => Platform.OS === "web" ? void handlePickDocument() : setShowAttachMenu(true)}
            accessibilityLabel={Platform.OS === "web" ? "Uploads" : t("chat.attachMenu.title")}
            hitSlop={6}
            style={[styles.attachBtn, { backgroundColor: colors.primarySoft }]}
            disabled={isPreparingImage || isPreparingDocument}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: colors.textPrimary }, Platform.OS === "web" && styles.webTextInput]}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onKeyPress={Platform.OS === "web" ? (event) => {
              const key = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number; repeat?: boolean };
              if (key.key === "Enter" && !key.shiftKey && !key.isComposing && key.keyCode !== 229) {
                event.preventDefault();
                if (!key.repeat) void handleSend();
              }
            } : undefined}
            autoFocus
            multiline
            numberOfLines={Platform.OS === "web" ? 3 : undefined}
            returnKeyType={Platform.OS === 'web' ? undefined : 'send'}
            submitBehavior={Platform.OS === 'web' ? 'newline' : 'submit'}
            onSubmitEditing={Platform.OS === 'web' ? undefined : () => { void handleSend(); }}
            maxLength={5000}
            autoComplete="off"
            textContentType="none"
          />

          <Text
            style={[
              styles.characterCounter,
              Platform.OS === "web" && styles.webCharacterCounter,
              {
                color:
                  input.length >= 5000 ? colors.error : colors.textTertiary,
              },
            ]}
          >
            {input.length}/5000
          </Text>

          {sending ? (
            <TouchableOpacity
              style={[
                styles.stopBtn,
                { backgroundColor: colors.error, opacity: canStop ? 1 : 0.45 },
              ]}
              onPress={stopGeneration}
              disabled={!canStop}
              activeOpacity={0.8}
            >
              <Ionicons name="stop" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (input.trim() || attachedImages.length > 0 || attachedDocuments.length > 0) &&
                !isPreparingImage &&
                !attachedImages.some((image) => image.processing)
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.border },
              ]}
              onPress={handleSend}
              disabled={
                isPreparingImage ||
                attachedImages.some((image) => image.processing) ||
                (!input.trim() && attachedImages.length === 0 && attachedDocuments.length === 0)
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={
                  (input.trim() || attachedImages.length > 0 || attachedDocuments.length > 0) &&
                  !isPreparingImage &&
                  !attachedImages.some((image) => image.processing)
                    ? "#FFFFFF"
                    : colors.textSecondary
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <AttachmentViewer attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />

      {/* Menu de escolha: Câmara / Galeria */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View
            style={[
              styles.attachMenuContent,
              Platform.OS === 'web' && { maxWidth: 480 },
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: colors.textPrimary, marginBottom: 16 },
              ]}
            >
              {t("chat.attachMenu.title")}
            </Text>

            {Platform.OS !== "web" && (
            <TouchableOpacity
              style={styles.attachMenuOption}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.attachMenuIconBox,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.attachMenuLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  {t("chat.attachMenu.takePhoto")}
                </Text>
                <Text
                  style={[
                    styles.attachMenuDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("chat.attachMenu.takePhotoDesc")}
                </Text>
              </View>
            </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.attachMenuOption}
              onPress={handlePickFromGallery}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.attachMenuIconBox,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.attachMenuLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  {t("chat.attachMenu.chooseGallery")}
                </Text>
                <Text
                  style={[
                    styles.attachMenuDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("chat.attachMenu.chooseGalleryDesc")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachMenuOption}
              onPress={handlePickDocument}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.attachMenuIconBox,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.attachMenuLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  {t("chat.attachMenu.chooseDocument")}
                </Text>
                <Text
                  style={[
                    styles.attachMenuDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("chat.attachMenu.chooseDocumentDesc", { limit: chatAttachmentLimitMiB })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardLayer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowOptionsModal(false)}
          >
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {t("chat.optionsModal.title")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowOptionsModal(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t("chat.optionsModal.nameLabel")}
            </Text>
            <View
              style={[
                styles.modalInputWrapper,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.modalTextInput, { color: colors.textPrimary }]}
                value={chatTitleInput}
                onChangeText={setChatTitleInput}
                placeholder={t("chat.optionsModal.namePlaceholder")}
                placeholderTextColor={colors.textTertiary}
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleRenameChat}
              disabled={isRenaming}
              activeOpacity={0.8}
            >
              {isRenaming ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {t("chat.optionsModal.saveNameButton")}
                </Text>
              )}
            </TouchableOpacity>

            <View
              style={[
                styles.modalDivider,
                { backgroundColor: colors.border, marginTop: 24 },
              ]}
            />

            {/* SELETOR DE COR DA BOLHA DO UTILIZADOR */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t("chat.optionsModal.bubbleColorLabel")}
            </Text>
            <View style={styles.colorPickerContainer}>
              {BUBBLE_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    userBubbleColor === c && {
                      borderWidth: 2,
                      borderColor: colors.textPrimary,
                    },
                  ]}
                  onPress={() => setUserBubbleColor(c)}
                  activeOpacity={0.7}
                />
              ))}
            </View>

            <View
              style={[
                styles.modalDivider,
                { backgroundColor: colors.border, marginTop: 14 },
              ]}
            />

            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: colors.errorSoft }]}
              onPress={handleDeleteChat}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={colors.error}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.deleteBtnText, { color: colors.error }]}>
                    {t("chat.optionsModal.deleteButton")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  webHeader: {
    paddingLeft: 72,
    paddingRight: 24,
    minHeight: 64,
    borderBottomWidth: 0,
  },
  webListContent: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
  },
  webAttachmentArea: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  webInputContainer: {
    width: "100%",
    maxWidth: 960,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 12,
    borderTopWidth: 0,
  },
  webInputCard: {
    minHeight: 104,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "flex-end",
  },
  webTextInput: {
    // Three complete lines plus the inherited 6px top/bottom padding.
    // A 72px box scrolled internally before the third line could fit.
    minHeight: 84,
    maxHeight: 180,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    // Let the browser grow the textarea without resetting its height/caret
    // on each keystroke. Older browsers retain the three-row scrollable box.
    ...({ fieldSizing: "content", resize: "none" } as const),
  },
  webCharacterCounter: {
    // Changing digits must never steal width from the adjacent textarea.
    width: 64,
    flexShrink: 0,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  webPromptGrid: {
    maxWidth: 680,
    alignSelf: "center",
  },
  safeArea: { flex: 1 },
  header: {
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: { flex: 1, marginHorizontal: 12 },
  headerTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  spaceBadge: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  headerSubtitle: { fontFamily: "DMSans_500Medium", fontSize: 12 },
  loadingWrapper: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingVertical: 20, paddingHorizontal: 16, flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    paddingTop: 30,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 290,
  },
  promptGrid: { width: "100%", marginTop: 28, gap: 10 },
  promptCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  promptIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  promptTitle: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  promptDesc: { fontFamily: "DMSans_400Regular", fontSize: 12, marginTop: 2 },
  userMessageRow: { width: "100%", alignItems: "flex-end", marginVertical: 8 },
  userActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  editMessageBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  userBubble: {
    maxWidth: "82%",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tutorMessageRow: { width: "100%", marginVertical: 10 },
  tutorHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  tutorName: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    letterSpacing: -0.2,
    marginLeft: 8,
    marginRight: 6,
  },
  tutorCard: {
    borderWidth: 1,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  standaloneImageWrapUser: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fallbackImageWrap: {
    width: 140,
    height: 100,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fallbackImageText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    marginTop: 4,
  },
  standaloneImageWrapTutor: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  messageImage: { width: 240, height: 160 },
  messageImageSmall: { width: 140, height: 100 },
  sentImagesRow: { paddingRight: 8 },
  sentImagesScrollUser: {
    maxWidth: "88%",
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  sentImagesScrollTutor: {
    maxWidth: "88%",
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  messageText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 25,
  },
  timeUser: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    textAlign: "right",
  },
  timeTutor: { fontFamily: "DMSans_400Regular", fontSize: 10, marginTop: 4 },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBannerText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  previewContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  previewImage: { width: 40, height: 40, borderRadius: 8 },
  previewImageLoading: { alignItems: "center", justifyContent: "center" },
  previewTextWrap: { flex: 1, marginLeft: 10 },
  imagePreviewCarousel: { height: 78, marginBottom: 8 },
  imagePreviewScroll: { flexGrow: 0, maxHeight: 78 },
  imagePreviewList: { paddingLeft: 16, paddingRight: 52, paddingTop: 6, gap: 8 },
  imagePreviewCount: { position: "absolute", right: 16, bottom: 0, fontFamily: "DMSans_500Medium", fontSize: 12 },
  imagePreviewThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
  },
  imagePreviewOpen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    overflow: "hidden",
  },
  imagePreviewThumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 11,
  },
  imagePreviewProcessing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: { fontFamily: "DMSans_700Bold", fontSize: 12 },
  previewSubtitle: { fontFamily: "DMSans_400Regular", fontSize: 11 },
  inputContainer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  usageBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  usageBannerText: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    marginLeft: 8,
    marginRight: 8,
  },
  characterCounter: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    alignSelf: "flex-end",
    marginRight: 4,
    marginBottom: 2,
  },
  floatingInputCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  modeToggleRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeChipText: { fontFamily: "DMSans_600SemiBold", fontSize: 12 },
  textInput: {
    flex: 1,
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    paddingVertical: 6,
    paddingHorizontal: 4,
    maxHeight: 120,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  sourcesPanel: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  sourcesHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourcesTitle: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
  },
  sourcesList: { gap: 4, paddingBottom: 4 },
  sourceRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  sourceLogo: { width: 22, height: 22, borderRadius: 5 },
  sourceTextWrap: { flex: 1, minWidth: 0 },
  sourceName: { fontFamily: "DMSans_500Medium", fontSize: 13 },
  sourceDomain: { fontFamily: "DMSans_400Regular", fontSize: 11, marginTop: 1 },
  modalKeyboardLayer: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  attachMenuContent: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  attachMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  attachMenuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  attachMenuLabel: { fontFamily: "DMSans_700Bold", fontSize: 14 },
  attachMenuDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    marginTop: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontFamily: "DMSans_700Bold", fontSize: 17 },
  fieldLabel: { fontFamily: "DMSans_500Medium", fontSize: 12, marginBottom: 6 },
  modalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalTextInput: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 14 },
  saveBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14, color: "#FFFFFF" },
  modalDivider: { height: 1, marginVertical: 14 },
  colorPickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 4,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    height: 48,
  },
  deleteBtnText: { fontFamily: "DMSans_700Bold", fontSize: 14 },
});

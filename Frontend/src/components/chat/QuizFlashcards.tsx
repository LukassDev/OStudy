import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextStyle } from 'react-native';
import MathText from './Mathtext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors, radius } from '../../constants/theme';
import { QuizFlashcardsPayload, useChatStore } from '../../stores/chatStore';

// Preserve option/card presses when native math uses a WebView.
function QuizText({ children, style }: { children?: string; style: TextStyle }) {
  if (!children) return null;
  if (!/\$|\\(?:[a-zA-Z]+|[([])/.test(children)) return <Text style={style}>{children}</Text>;
  return <View pointerEvents="none" style={{ width: '100%', marginBottom: style.marginBottom }}>
    <MathText content={children} isUser={false} textStyle={style}
      boldColor={String(style.color)} formulaColor={String(style.color)} />
  </View>;
}

interface QuizFlashcardsProps {
  data: QuizFlashcardsPayload;
  messageId: string;
  chatId: string;
}

/**
 * Renderiza o quiz/flashcards devolvido pelo backend dentro do bloco
 * json_action "quiz_flashcards". Toda a interação é local — mas:
 * 1. O estado (índice, score, respostas) é persistido em AsyncStorage para
 *    sobreviver a sair/entrar no chat.
 * 2. Ao terminar o quiz, envia automaticamente uma mensagem ao Oren com o
 *    resultado, para ele poder comentar/corrigir.
 */
export const QuizFlashcards: React.FC<QuizFlashcardsProps> = ({ data, messageId, chatId }) => {
  const colors = useThemeColors();
  const { t } = useTranslation();

  if (data.mode === 'flashcards') {
    return <FlashcardsView data={data} colors={colors} t={t} messageId={messageId} />;
  }
  return <QuizView data={data} colors={colors} t={t} messageId={messageId} chatId={chatId} />;
};

const CardShell: React.FC<{ children: React.ReactNode; colors: any; title: string; icon: string }> = ({
  children, colors, title, icon,
}) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginVertical: 8,
      maxWidth: 420,
      width: '100%',
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Ionicons name={icon as any} size={16} color={colors.primary} style={{ marginRight: 6 }} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
    </View>
    {children}
  </View>
);

// ─── ESTADO PERSISTIDO ───────────────────────────────────────────────────────
interface QuizPersistedState {
  index: number;
  score: number;
  finished: boolean;
  // respostas dadas: índice da resposta escolhida por pergunta (-1 = não respondida)
  answers: number[];
  // se já enviou o resultado ao Oren
  resultSent: boolean;
}

function quizStorageKey(messageId: string) {
  return `quiz-state:${messageId}`;
}

async function loadQuizState(messageId: string): Promise<QuizPersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(quizStorageKey(messageId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveQuizState(messageId: string, state: QuizPersistedState) {
  try {
    await AsyncStorage.setItem(quizStorageKey(messageId), JSON.stringify(state));
  } catch { /* silencioso */ }
}

// ─── QUIZ VIEW ───────────────────────────────────────────────────────────────
const QuizView: React.FC<{
  data: QuizFlashcardsPayload;
  colors: any;
  t: any;
  messageId: string;
  chatId: string;
}> = ({ data, colors, t, messageId, chatId }) => {
  const { sendMessage, currentChat } = useChatStore();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<number[]>(() => new Array(data.items.length).fill(-1));
  const [resultSent, setResultSent] = useState(false);
  const sentRef = useRef(false);

  // Carregar estado persistido
  useEffect(() => {
    loadQuizState(messageId).then((saved) => {
      if (saved) {
        setIndex(saved.index);
        setScore(saved.score);
        setFinished(saved.finished);
        setAnswers(saved.answers);
        setResultSent(saved.resultSent);
        sentRef.current = saved.resultSent;
        // Se estava a meio de uma pergunta já verificada, restaurar checked
        if (saved.answers[saved.index] !== -1) {
          setSelected(saved.answers[saved.index]);
          setChecked(true);
        }
      }
      setLoaded(true);
    });
  }, [messageId]);

  // Persistir sempre que o estado muda
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveQuizState(messageId, { index, score, finished, answers, resultSent });
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [index, score, finished, answers, resultSent, loaded, messageId]);

  // Enviar resultado ao Oren quando o quiz termina (só uma vez)
  useEffect(() => {
    if (!finished || sentRef.current) return;
    sentRef.current = true;
    setResultSent(true);

    const spaceId = currentChat?.space_id;
    if (!chatId || !spaceId) return;

    // Resposta compacta no formato "Resposta: 1: a; 2:b; 3:c" — apenas a letra
    // escolhida por pergunta (minúscula, pela ordem das opções), e "-" se não
    // respondeu. O Oren tem o contexto completo do quiz (perguntas/opções/
    // corretas) reinjetado pelo backend a partir de messages.quiz, por isso
    // basta enviar as letras escolhidas.
    const letters = ['a', 'b', 'c', 'd', 'e'];
    const parts = data.items.map((item, i) => {
      const chosen = answers[i];
      const chosenLetter = chosen >= 0 ? (letters[chosen] ?? '?') : '-';
      return `${i + 1}: ${chosenLetter}`;
    });

    const msg = `Resposta: ${parts.join('; ')}`;
    sendMessage(chatId, msg).catch(console.error);
  }, [finished]);

  const item = data.items[index];
  const isLast = index === data.items.length - 1;

  function handleCheck() {
    if (selected === null) return;
    const isCorrect = selected === item.correct_index;
    const newScore = isCorrect ? score + 1 : score;
    const newAnswers = [...answers];
    newAnswers[index] = selected;
    setChecked(true);
    setScore(newScore);
    setAnswers(newAnswers);
  }

  function handleNext() {
    if (isLast) {
      setFinished(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    // Se já tinha respondido esta pergunta antes (restart parcial), restaurar
    const prevAnswer = answers[nextIndex];
    if (prevAnswer !== -1) {
      setSelected(prevAnswer);
      setChecked(true);
    } else {
      setSelected(null);
      setChecked(false);
    }
  }

  function handleRestart() {
    const fresh = new Array(data.items.length).fill(-1);
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setScore(0);
    setFinished(false);
    setAnswers(fresh);
    setResultSent(false);
    sentRef.current = false;
    saveQuizState(messageId, { index: 0, score: 0, finished: false, answers: fresh, resultSent: false });
  }

  if (!loaded) return null;

  if (finished) {
    return (
      <CardShell colors={colors} title={data.title || t('chat.quiz.quizTitle')} icon="help-circle-outline">
        <Text style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
          {t('chat.quiz.quizFinished', { score, total: data.items.length })}
        </Text>
        {resultSent && (
          <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 12, fontStyle: 'italic' }}>
            {t('chat.quiz.quizResultSent', { score, total: data.items.length })}
          </Text>
        )}
        <TouchableOpacity
          onPress={handleRestart}
          style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('chat.quiz.restart')}</Text>
        </TouchableOpacity>
      </CardShell>
    );
  }

  return (
    <CardShell colors={colors} title={data.title || t('chat.quiz.quizTitle')} icon="help-circle-outline">
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 6 }}>
        {t('chat.quiz.cardProgress', { current: index + 1, total: data.items.length })}
      </Text>
      <QuizText style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 }}>
        {item.question}
      </QuizText>

      {(item.options || []).map((opt, i) => {
        const isSelected = selected === i;
        const isCorrectOpt = i === item.correct_index;
        let borderColor = colors.border;
        let bgColor = 'transparent';
        if (checked && isCorrectOpt) {
          borderColor = '#22C55E'; bgColor = '#22C55E1A';
        } else if (checked && isSelected && !isCorrectOpt) {
          borderColor = '#EF4444'; bgColor = '#EF44441A';
        } else if (isSelected) {
          borderColor = colors.primary;
        }
        return (
          <TouchableOpacity
            key={i}
            disabled={checked}
            onPress={() => setSelected(i)}
            style={{ borderWidth: 1.5, borderColor, backgroundColor: bgColor, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 }}
          >
            <QuizText style={{ fontSize: 13, color: colors.textPrimary }}>{opt}</QuizText>
          </TouchableOpacity>
        );
      })}

      {checked && item.explanation && (
        <QuizText style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, fontStyle: 'italic' }}>
          {item.explanation}
        </QuizText>
      )}

      <TouchableOpacity
        onPress={checked ? handleNext : handleCheck}
        disabled={selected === null}
        style={{ backgroundColor: selected === null ? colors.border : colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
          {checked ? (isLast ? t('chat.quiz.finish') : t('chat.quiz.nextQuestion')) : t('chat.quiz.checkAnswer')}
        </Text>
      </TouchableOpacity>
    </CardShell>
  );
};

// ─── FLASHCARDS VIEW ─────────────────────────────────────────────────────────
const FlashcardsView: React.FC<{
  data: QuizFlashcardsPayload;
  colors: any;
  t: any;
  messageId: string;
}> = ({ data, colors, t, messageId }) => {
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`flashcard-state:${messageId}`).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        setIndex(saved.index ?? 0);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [messageId]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(`flashcard-state:${messageId}`, JSON.stringify({ index })).catch(() => {});
  }, [index, loaded, messageId]);

  const item = data.items[index];
  const isLast = index === data.items.length - 1;

  function handleNext() {
    setIndex((i) => (isLast ? 0 : i + 1));
    setFlipped(false);
  }

  if (!loaded) return null;

  return (
    <CardShell colors={colors} title={data.title || t('chat.quiz.flashcardsTitle')} icon="albums-outline">
      <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 6 }}>
        {t('chat.quiz.cardProgress', { current: index + 1, total: data.items.length })}
      </Text>

      <TouchableOpacity
        onPress={() => setFlipped((f) => !f)}
        activeOpacity={0.85}
        style={{ minHeight: 90, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 }}
      >
        <QuizText style={{ fontSize: 14, color: colors.textPrimary, textAlign: 'center', fontWeight: flipped ? '400' : '600' }}>
          {flipped ? item.back : item.front}
        </QuizText>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => setFlipped((f) => !f)}
          style={{ flex: 1, marginRight: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 9, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}>{t('chat.quiz.flipCard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleNext}
          style={{ flex: 1, borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: 9, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>{t('chat.quiz.nextQuestion')}</Text>
        </TouchableOpacity>
      </View>
    </CardShell>
  );
};

import type { TFunction } from 'i18next';
import type { Space } from '../stores/spaceStore';
import type { Chat } from '../stores/chatStore';

export interface TutorInsight {
  message: string;
  ctaLabel?: string;
  cta: 'continue_chat' | 'new_space' | 'open_space' | null;
  targetId?: string;
}

function countAllSpaces(spaces: Space[]): number {
  let count = 0;
  const walk = (nodes: Space[]) => {
    for (const node of nodes) {
      count += 1;
      if (node.children) walk(node.children);
    }
  };
  walk(spaces);
  return count;
}

// Muda sozinho ~3x por dia (manhã / tarde / noite), sempre com base em dados
// reais do utilizador — nunca inventa exames, notas ou tópicos inexistentes.
// Recebe `t` (i18next) do componente chamador, porque as mensagens têm
// interpolação de dados do próprio utilizador (nome do chat, nome do Space,
// contagem de Spaces) e por isso não podem viver como texto estático.
export function getTutorInsight(spaces: Space[], recentChats: Chat[], t: TFunction): TutorInsight {
  if (spaces.length === 0) {
    return {
      message: t('dashboard.insights.noSpaces'),
      ctaLabel: t('dashboard.insights.noSpacesCta'),
      cta: 'new_space',
    };
  }

  const now = new Date();
  const hour = now.getHours();
  const bucket = hour < 12 ? 0 : hour < 19 ? 1 : 2;
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const seed = dayOfYear * 3 + bucket;

  const candidates: TutorInsight[] = [];

  if (recentChats.length > 0) {
    const chat = recentChats[0];
    candidates.push({
      message: t('dashboard.insights.continueChat', {
        title: chat.title,
        space: chat.space?.name ?? t('dashboard.insights.defaultSpaceName'),
      }),
      ctaLabel: t('dashboard.insights.continueChatCta'),
      cta: 'continue_chat',
      targetId: chat.id,
    });
  }

  const recentSpaceIds = new Set(recentChats.map((c) => c.space_id));
  const neglected = spaces.find((s) => !recentSpaceIds.has(s.id));
  if (neglected) {
    candidates.push({
      message: t('dashboard.insights.neglectedSpace', { name: neglected.name }),
      ctaLabel: t('dashboard.insights.neglectedSpaceCta', { name: neglected.name }),
      cta: 'open_space',
      targetId: neglected.id,
    });
  }

  candidates.push({
    message: t('dashboard.insights.dailyRhythm'),
    cta: null,
  });

  const total = countAllSpaces(spaces);
  candidates.push({
    message: t('dashboard.insights.spaceCount', { count: total }),
    cta: null,
  });

  return candidates[seed % candidates.length];
}

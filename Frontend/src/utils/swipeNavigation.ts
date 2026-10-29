export const SPACE_TAB_ORDER = ['chats', 'plano', 'conteudo', 'calendario', 'avaliacoes', 'recursos'] as const;
export type SpaceTab = typeof SPACE_TAB_ORDER[number];
export function isHorizontalSwipe(dx: number, dy: number, touches = 1): boolean {
  return touches === 1 && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.8;
}
// Dragging the content left advances; dragging right returns to the previous tab.
export function getSwipedTab(current: SpaceTab, dx: number): SpaceTab {
  if (Math.abs(dx) < 48) return current;
  const index = SPACE_TAB_ORDER.indexOf(current);
  return SPACE_TAB_ORDER[Math.max(0, Math.min(SPACE_TAB_ORDER.length - 1, index + (dx < 0 ? 1 : -1)))];
}

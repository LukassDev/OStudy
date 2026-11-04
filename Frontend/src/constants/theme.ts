// Sistema de tema dinâmico — dark / light com DM Sans.
// Os tokens visuais vivem em theme.tokens.ts (importável pelo tailwind.config).

import { useColorScheme } from 'nativewind';
import { useProfileStore } from '../stores/profileStore';
import {
  darkColors,
  lightColors,
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  interaction,
  SPACE_COLOR_MAP,
} from './theme.tokens';

export {
  darkColors,
  lightColors,
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  interaction,
  SPACE_COLOR_MAP,
};

export type ThemeColors = typeof darkColors;

// Adicionado para resolver o erro na aba Conteúdo
export const IMPORTANCE_COLOR: Record<string, string> = {
  baixa: '#868D94',
  media: '#E5A93C',
  alta: '#DB684C',
  vital: '#D93838',
  low: '#868D94',
  medium: '#E5A93C',
  high: '#DB684C',
  1: '#868D94',
  2: '#E5A93C',
  3: '#DB684C',
};

export const IMPORTANCE_COLORS = IMPORTANCE_COLOR;

// ─── HOOKS ───────────────────────────────────────────────────────────────────

/**
 * useThemeColors()
 * Devolve a paleta certa (dark / light) e re-renderiza quando o tema muda.
 * Usa em qualquer componente que precise de cores em JS:
 *   const colors = useThemeColors();
 *   <Ionicons color={colors.primary} />
 */
export function useThemeColors(): ThemeColors {
  try {
    const profileTheme = useProfileStore((state) => state.theme);
    return profileTheme === 'light' ? lightColors : darkColors;
  } catch {
    return darkColors;
  }
}

/**
 * useThemeMode()
 * Lê e alterna o modo de tema. O profileStore persiste a preferência.
 */
export function useThemeMode() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  return {
    mode: (colorScheme ?? 'light') as 'light' | 'dark',
    setMode: setColorScheme,
    toggleMode: toggleColorScheme,
  };
}

/**
 * useSpaceColorMap()
 * Devolve o mapa de cores de Space consoante o tema ativo.
 */
export function useSpaceColorMap(): Record<string, string> {
  const c = useThemeColors();
  return {
    blue:   c.space.blue,
    green:  c.space.green,
    orange: c.space.orange,
    purple: c.space.purple,
    pink:   c.space.pink,
    red:    c.space.red,
    gray:   c.space.gray,
  };
}

/**
 * getColors()
 * Para usar em StyleSheet.create() ou objetos a nível de módulo.
 * Retorna sempre a paleta escura (hooks não podem ser chamados aí).
 */
export function getColors(): ThemeColors {
  return darkColors;
}

// Exportação combinada — retrocompatibilidade
export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  interaction,
  SPACE_COLOR_MAP,
  IMPORTANCE_COLOR,
  IMPORTANCE_COLORS,
};
// src/constants/theme.tokens.ts
// Dados puros do tema — sem imports de React / React Native / NativeWind.
// Lido pelo tailwind.config.js em tempo de build (Node puro).

// ─── PALETA ESCURA ────────────────────────────────────────────────────────────
export const darkColors = {
  // Backgrounds — três camadas com contraste real entre elas
  background:      '#151515',
  surface:         '#1E1E1E',
  surfaceElevated: '#262626',

  border:          '#333333',
  borderStrong:    '#3D3D3D',
  iconSurface:     '#2E2E2E',

  // Texto — três níveis com contraste acessível
  textPrimary:   '#F5F5F5',
  textSecondary: '#A3A3A3',
  textTertiary:  '#737373',     // labels, timestamps, placeholders

  // Acento teal-menta e respetivos estados de interação.
  primary:        '#4FA98F',
  primaryStrong:  '#2F8F76',
  primaryHover:   '#63BBA1',
  primaryPressed: '#287B66',
  primarySoft:    'rgba(79, 169, 143, 0.10)',
  primaryBorder:  'rgba(79, 169, 143, 0.28)',
  primaryText:    '#F5F5F5',
  accent:         '#4FA98F',

  // Acento secundário — azul-ardósia frio.
  // Dá identidade própria à aplicação.
  secondary:      '#6E9EE8',    // azul académico / inteligente
  secondarySoft:  '#172030',    // background tint

  // Semânticas
  success:     '#22C55E',
  successSoft: '#162618',
  error:       '#F87171',
  errorSoft:   '#2E1616',
  warning:     '#F5B544',
  warningSoft: '#2A2010',
  info:        '#60A5FA',
  destructive: '#C25B5B',
  destructiveSoft: 'rgba(194, 91, 91, 0.08)',

  overlay: 'rgba(0,0,0,0.6)',
  ripple: 'rgba(255,255,255,0.16)',

  // Cores de Space — palette mais contida e coesa
  space: {
    blue:   '#6EA8F0',
    green:  '#3CC97A',
    orange: '#E07B50',
    purple: '#9B84F5',
    pink:   '#E86FAD',
    red:    '#E86060',
    gray:   '#82807A',
  },
};

// ─── PALETA CLARA ─────────────────────────────────────────────────────────────
export const lightColors = {
  background:      '#FFFFFF',
  surface:         '#F3F3F3',
  surfaceElevated: '#F3F3F3',

  border:          '#DADCE0',
  borderStrong:    '#BDC1C6',
  iconSurface:     '#E8E8E8',

  textPrimary:   '#202124',
  textSecondary: '#5F6368',
  textTertiary:  '#80868B',

  primary:        '#4FA98F',
  primaryStrong:  '#2F8F76',
  primaryHover:   '#63BBA1',
  primaryPressed: '#287B66',
  primarySoft:    'rgba(79, 169, 143, 0.10)',
  primaryBorder:  'rgba(79, 169, 143, 0.28)',
  primaryText:    '#F5F5F5',
  accent:         '#4FA98F',

  secondary:      '#34A853',
  secondarySoft:  '#E6F4EA',

  success:     '#188038',
  successSoft: '#E6F4EA',
  error:       '#D93025',
  errorSoft:   '#FCE8E6',
  warning:     '#F9AB00',
  warningSoft: '#FEF7E0',
  info:        '#60A5FA',
  destructive: '#C25B5B',
  destructiveSoft: 'rgba(194, 91, 91, 0.08)',

  overlay: 'rgba(32,33,36,0.4)',
  ripple: 'rgba(32,33,36,0.12)',

  space: {
    blue:   '#1A73E8',
    green:  '#188038',
    orange: '#E37400',
    purple: '#7E57C2',
    pink:   '#C2185B',
    red:    '#D93025',
    gray:   '#5F6368',
  },
};

// Compatibilidade retroativa
export const colors = {
  ...darkColors,
  dark: {
    background:      darkColors.background,
    surface:         darkColors.surface,
    surfaceElevated: darkColors.surfaceElevated,
    border:          darkColors.border,
    textPrimary:     darkColors.textPrimary,
    textSecondary:   darkColors.textSecondary,
    textTertiary:    darkColors.textTertiary,
  },
};

// ─── ESPAÇAMENTO ──────────────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  compact: 12,
};

// ─── RAIOS — INTENCIONAIS POR CONTEXTO ───────────────────────────────────────
// Regra de uso:
//   xs  → badges, tags, separadores
//   sm  → inputs, chips, botões pequenos
//   md  → cards secundários, items de lista
//   lg  → cards principais, modais, sheets
//   xl  → cards hero
//   full → botões CTA, avatares, toggles
export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  full: 9999,
};

// ─── TIPOGRAFIA — DM Sans ────────────────────────────────────────────────────
// Instalar: npx expo install @expo-google-fonts/dm-sans expo-font
// Usar o hook useFonts() no _layout.tsx raiz (ver comentário abaixo).
//
// DM Sans: geométrica, moderna, legível em ecrãs pequenos.
// Usada por Linear, Pitch e Vercel dashboard. Marcante sem ser fria.
export const typography = {
  fontFamily: {
    regular:  'DMSans_400Regular',
    medium:   'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold:     'DMSans_700Bold',
  },
  size: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    xxl:  24,
    xxxl: 30,
    display: 36,
  },
  lineHeight: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.7,
  },
  letterSpacing: {
    tight:  -0.5,
    normal:  0,
    wide:    0.4,
    widest:  1.0,
  },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 16 },
};

export const motion = {
  fast: 140,
  normal: 220,
  slow: 360,
  easing: [0.22, 1, 0.36, 1] as const,
};

export const interaction = {
  minTarget: 44,
  pressedOpacity: 0.72,
  hoverOpacity: 0.92,
  disabledOpacity: 0.48,
};

// ─── SOMBRAS (uso em StyleSheet, não em className) ───────────────────────────
export const shadows = {
  // Para cards principais no dark — substitui a borda genérica
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius:  8,
    elevation:     4,
  },
  // Para modais e sheets
  modal: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius:  20,
    elevation:     12,
  },
  // Para o botão CTA primário
  cta: {
    shadowColor:   '#4FA98F',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  },
};

// ─── SPACE COLOR MAP (compatibilidade) ───────────────────────────────────────
export const SPACE_COLOR_MAP: Record<string, string> = {
  blue:   darkColors.space.blue,
  green:  darkColors.space.green,
  orange: darkColors.space.orange,
  purple: darkColors.space.purple,
  pink:   darkColors.space.pink,
  red:    darkColors.space.red,
  gray:   darkColors.space.gray,
};

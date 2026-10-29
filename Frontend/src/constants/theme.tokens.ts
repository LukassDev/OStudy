// src/constants/theme.tokens.ts
// Dados puros do tema — sem imports de React / React Native / NativeWind.
// Lido pelo tailwind.config.js em tempo de build (Node puro).

// ─── PALETA ESCURA ────────────────────────────────────────────────────────────
export const darkColors = {
  // Backgrounds — três camadas com contraste real entre elas
  background:      '#141312',   // mais fundo que antes; quase preto-quente
  surface:         '#1D1C1A',   // cards base
  surfaceElevated: '#252320',   // cards sobre surface (modais, dropdowns)

  border:          '#2E2C29',   // linha sutil — só usada quando necessário
  borderStrong:    '#3D3A36',   // separadores com mais peso visual

  // Texto — três níveis com contraste acessível
  textPrimary:   '#F0EDE8',     // quente, não branco puro
  textSecondary: '#9B9590',     // conteúdo secundário
  textTertiary:  '#6A665F',     // labels, timestamps, placeholders

  // Acento principal — o laranja "Claude-inspired" com identidade própria
  // Ligeiramente mais saturado e quente que o original para ter mais presença
  primary:        '#E07B50',    // o acento — usado com moderação
  primaryPressed: '#C9623A',    // estado pressed
  primarySoft:    '#2C1E17',    // background tint (usar só em badges/chips)
  primaryText:    '#FFFFFF',

  // Acento secundário — azul-ardósia frio, contrasta com o laranja
  // Dá identidade própria ao Oren; não existe no Claude
  secondary:      '#6E9EE8',    // azul académico / inteligente
  secondarySoft:  '#172030',    // background tint

  // Semânticas
  success:     '#3DB060',
  successSoft: '#162618',
  error:       '#E85252',
  errorSoft:   '#2E1616',
  warning:     '#D49A2A',
  warningSoft: '#2A2010',

  overlay: 'rgba(0,0,0,0.6)',
  ripple: 'rgba(255,255,255,0.16)',

  // Cores de Space — palette mais contida e coesa
  space: {
    blue:   '#6EA8F0',
    green:  '#3CC97A',
    orange: '#E07B50',   // alinhado com o primary
    purple: '#9B84F5',
    pink:   '#E86FAD',
    red:    '#E86060',
    gray:   '#82807A',
  },
};

// ─── PALETA CLARA ─────────────────────────────────────────────────────────────
export const lightColors = {
  background:      '#F8FAFC',   // neutro frio, inspirado no Material 3
  surface:         '#FFFFFF',
  surfaceElevated: '#F1F3F4',

  border:          '#DADCE0',
  borderStrong:    '#BDC1C6',

  textPrimary:   '#202124',
  textSecondary: '#5F6368',
  textTertiary:  '#80868B',

  primary:        '#E07B50',
  primaryPressed: '#C9623A',
  primarySoft:    '#FCE9DF',
  primaryText:    '#FFFFFF',
  accent:         '#E07B50',

  secondary:      '#34A853',
  secondarySoft:  '#E6F4EA',

  success:     '#188038',
  successSoft: '#E6F4EA',
  error:       '#D93025',
  errorSoft:   '#FCE8E6',
  warning:     '#F9AB00',
  warningSoft: '#FEF7E0',

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
    shadowColor:   '#E07B50',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  10,
    elevation:     6,
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
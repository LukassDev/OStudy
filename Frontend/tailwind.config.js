/**
 * Cores mapeadas para variáveis CSS (ver global.css) — sem require() de
 * ficheiros TypeScript, porque o sucrase (que o Metro usa para processar
 * configs) não suporta importar .ts a partir de .js CommonJS.
 * Os valores de radius estão inline (iguais aos de src/constants/theme.ts).
 */
function withOpacity(variableName) {
  return `rgb(var(${variableName}) / <alpha-value>)`;
}

module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background:      withOpacity('--color-background'),
        surface:         withOpacity('--color-surface'),
        surfaceElevated: withOpacity('--color-surfaceElevated'),
        border:          withOpacity('--color-border'),
        textPrimary:     withOpacity('--color-textPrimary'),
        textSecondary:   withOpacity('--color-textSecondary'),
        textTertiary:    withOpacity('--color-textTertiary'),
        primary:         withOpacity('--color-primary'),
        primaryPressed:  withOpacity('--color-primaryPressed'),
        primarySoft:     withOpacity('--color-primarySoft'),
        primaryText:     withOpacity('--color-primaryText'),
        accent:          withOpacity('--color-accent'),
        success:         withOpacity('--color-success'),
        successSoft:     withOpacity('--color-successSoft'),
        error:           withOpacity('--color-error'),
        errorSoft:       withOpacity('--color-errorSoft'),
        warning:         withOpacity('--color-warning'),
        warningSoft:     withOpacity('--color-warningSoft'),
      },
      borderRadius: {
        // Valores inline — equivalentes a src/constants/theme.ts > radius
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

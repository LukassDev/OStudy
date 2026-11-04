// useLanguage()
// Lê e altera o idioma ativo da interface. Espelha o padrão de
// `useThemeMode()` em src/constants/theme.ts: o profileStore é a fonte de
// verdade e persiste a preferência na base de dados; este hook apenas
// aplica a mudança no i18next para a UI re-renderizar imediatamente.

import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, SupportedLanguage, DEFAULT_LANGUAGE } from './index';

export function useLanguage() {
  const { i18n, t } = useTranslation();

  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : DEFAULT_LANGUAGE;

  /**
   * Troca o idioma apenas na camada de UI (i18next). NÃO persiste na base
   * de dados — quem chama isto (onboarding / Perfil) é responsável por
   * também gravar `language` + `language_set_manually: true` via
   * `updateProfile()`, tal como já acontece com o tema.
   */
  const setLanguage = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  return { language: current, setLanguage, t };
}

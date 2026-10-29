// Mapeia o idioma ativo da UI (i18next) para o locale correspondente do
// date-fns, usado em formatDistanceToNow / format em toda a app (chats,
// calendário, notas, recursos, conteúdo, sidebar...).
//
// Antes: cada ficheiro importava `ptBR` diretamente de 'date-fns/locale' e
// fixava-o como único idioma possível. Agora centralizamos aqui — qualquer
// ficheiro que precise de formatar datas usa `useDateFnsLocale()` em vez de
// importar um locale fixo.

import { useTranslation } from 'react-i18next';
import { ptBR, enUS, es, fr, de, it, type Locale } from 'date-fns/locale';
import type { SupportedLanguage } from './index';

const DATE_FNS_LOCALES: Record<SupportedLanguage, Locale> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': es,
  'fr-FR': fr,
  'de-DE': de,
  'it-IT': it,
};

/** Hook: devolve o objeto Locale do date-fns correspondente ao idioma ativo. */
export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation();
  return DATE_FNS_LOCALES[i18n.language as SupportedLanguage] ?? enUS;
}

/**
 * Versão não-hook, para uso fora de componentes React (ex.: dentro de
 * funções utilitárias puras). Recebe o código de idioma explicitamente.
 */
export function getDateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALES[language as SupportedLanguage] ?? enUS;
}

/**
 * Mapeia o idioma ativo para o argumento aceite por
 * `Date.prototype.toLocaleDateString` (ex.: `new Date().toLocaleDateString(bcp47, {...})`).
 * Os códigos já estão no formato BCP-47 correto, por isso esta função existe
 * sobretudo para deixar explícito, no local de uso, que a intenção é essa
 * (e para um único ponto de mudança caso o mapeamento precise de ajuste).
 */
export function toIntlLocale(language: SupportedLanguage): string {
  return language;
}

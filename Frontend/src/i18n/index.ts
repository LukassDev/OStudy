// Sistema de internacionalização (i18n) da app.
//
// Responsável por:
//  1. Inicializar o i18next com os dicionários de tradução da UI.
//  2. Detetar e normalizar o idioma do dispositivo (mapeando variantes
//     regionais para o padrão suportado mais usado da indústria).
//  3. Resolver, numa única função, qual o idioma que a app deve usar no
//     arranque, respeitando a hierarquia:
//       escolha manual do utilizador > idioma detetado do telemóvel > fallback inglês
//
// IMPORTANTE: este ficheiro controla apenas o idioma da INTERFACE (UI).
// O idioma em que o Oren (IA) responde no chat é decidido dinamicamente
// pelo backend, com base no que o próprio aluno escreve (ver
// back/src/services/tutor/promptBuilder.service.ts — "Chameleon Rule").
// Este módulo não tem, e não deve ter, qualquer influência sobre isso.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';

/**
 * Lista fechada de idiomas suportados pela UI (Tier 1 + Tier 2 do plano de
 * lançamento). Tem de estar sincronizada com a check constraint
 * `profiles_language_check` na base de dados.
 */
export const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en-US';

/** Metadados para renderizar o seletor de idioma (onboarding e Perfil). */
/**
 * Metadados para renderizar o seletor de idioma (onboarding e Perfil).
 *
 * NOTA: os flags de emoji foram substituídos por ícones vetoriais (ver
 * `iconName`, usado com @expo/vector-icons/Ionicons — o sistema de ícones
 * já usado em toda a app). Emojis de bandeira renderizam de forma
 * inconsistente entre plataformas/fontes (ex.: Android sem suporte nativo
 * mostra códigos ISO em vez da bandeira) e associam idioma a país, o que é
 * impreciso para línguas faladas em várias regiões. `accentColor` dá uma
 * pista visual adicional (usada no fundo do ícone) sem depender de
 * bandeiras nacionais.
 */
export const LANGUAGE_OPTIONS: {
  code: SupportedLanguage;
  nativeName: string;
}[] = [
  { code: 'pt-BR', nativeName: 'Português (Brasil)' },
  { code: 'en-US', nativeName: 'English (USA)'},
  { code: 'es-ES', nativeName: 'Español' },
  { code: 'fr-FR', nativeName: 'Français' },
  { code: 'de-DE', nativeName: 'Deutsch' },
  { code: 'it-IT', nativeName: 'Italiano' },
];

/**
 * Mapa de normalização de variantes regionais para o padrão suportado.
 * Chaves em minúsculas (comparação é sempre feita em lowercase).
 *
 * Regra de negócio (Tier 3 / "Inglês como fallback"):
 * Países nórdicos, Países Baixos, e qualquer idioma do sistema que não
 * conste aqui nem em SUPPORTED_LANGUAGES caem automaticamente no
 * DEFAULT_LANGUAGE ('en-US') — não é preciso listá-los explicitamente.
 */
const LANGUAGE_VARIANT_MAP: Record<string, SupportedLanguage> = {
  // Português — qualquer variante cai no padrão pt-BR (maior mercado de volume)
  'pt': 'pt-BR',
  'pt-br': 'pt-BR',
  'pt-pt': 'pt-BR',
  'pt-ao': 'pt-BR',
  'pt-mz': 'pt-BR',

  // Inglês — qualquer variante cai no padrão en-US
  'en': 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-US',
  'en-au': 'en-US',
  'en-ca': 'en-US',
  'en-nz': 'en-US',
  'en-ie': 'en-US',

  // Espanhol
  'es': 'es-ES',
  'es-es': 'es-ES',
  'es-mx': 'es-ES',
  'es-ar': 'es-ES',
  'es-419': 'es-ES',

  // Francês
  'fr': 'fr-FR',
  'fr-fr': 'fr-FR',
  'fr-be': 'fr-FR',
  'fr-ch': 'fr-FR',
  'fr-ca': 'fr-FR',

  // Alemão
  'de': 'de-DE',
  'de-de': 'de-DE',
  'de-at': 'de-DE',
  'de-ch': 'de-DE',

  // Italiano
  'it': 'it-IT',
  'it-it': 'it-IT',
  'it-ch': 'it-IT',
};

const resources = {
  'pt-BR': { translation: ptBR },
  'en-US': { translation: en },
  'es-ES': { translation: es },
  'fr-FR': { translation: fr },
  'de-DE': { translation: de },
  'it-IT': { translation: it },
};

/**
 * Normaliza um código de idioma (ex.: vindo do SO) para um dos idiomas
 * suportados pela app. Devolve `null` se não houver correspondência
 * nenhuma (nem exata, nem por raiz do idioma) — nesse caso quem chama
 * deve aplicar o DEFAULT_LANGUAGE.
 */
export function normalizeLanguageTag(tag: string | null | undefined): SupportedLanguage | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();

  // Correspondência exata da variante (ex.: "pt-BR" -> "pt-br")
  if (LANGUAGE_VARIANT_MAP[lower]) return LANGUAGE_VARIANT_MAP[lower];

  // Já é um dos códigos suportados tal e qual
  const asSupported = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === lower);
  if (asSupported) return asSupported;

  // Fallback por raiz do idioma (ex.: "de-LU" desconhecido -> "de" -> "de-DE")
  const root = lower.split('-')[0];
  if (LANGUAGE_VARIANT_MAP[root]) return LANGUAGE_VARIANT_MAP[root];

  return null;
}

/**
 * Lê o(s) idioma(s) configurado(s) no sistema operativo do dispositivo e
 * devolve o primeiro que consiga ser normalizado para um idioma suportado.
 * Nunca lança erro — em caso de falha na deteção, devolve o fallback.
 */
export function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    for (const locale of locales) {
      const candidate = normalizeLanguageTag(locale.languageTag) ?? normalizeLanguageTag(locale.languageCode);
      if (candidate) return candidate;
    }
  } catch {
    // Deteção falhou (ex.: ambiente de teste/SSR) — segue para o fallback.
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Resolve qual o idioma a app deve usar, dado o estado atual do perfil.
 *
 * Hierarquia (ver especificação do produto):
 *  1. Se o utilizador já escolheu manualmente (`languageSetManually === true`),
 *     essa escolha é definitiva e nunca é substituída por deteção automática.
 *  2. Caso contrário (conta nova, ou utilizador antigo cujo valor ainda não
 *     foi escolhido ativamente), deteta-se o idioma atual do sistema
 *     operativo e usa-se esse, desde que suportado.
 *  3. Se o idioma do sistema não for suportado, cai-se no DEFAULT_LANGUAGE.
 */
export function resolveAppLanguage(params: {
  storedLanguage: string | null | undefined;
  languageSetManually: boolean;
}): SupportedLanguage {
  const { storedLanguage, languageSetManually } = params;

  if (languageSetManually) {
    // Escolha intencional do utilizador: nunca sobrepor.
    return normalizeLanguageTag(storedLanguage) ?? DEFAULT_LANGUAGE;
  }

  // Ainda não houve escolha explícita — segue a deteção do dispositivo,
  // mesmo que já exista um valor guardado (ex.: default de uma migração,
  // ou deteção de um login anterior). Isto cobre o caso de retroatividade:
  // utilizadores antigos, ou o utilizador ter mudado o idioma do telemóvel
  // entretanto, sem nunca ter escolhido nada manualmente na app.
  return detectDeviceLanguage();
}

let initialized = false;

/**
 * Inicializa o i18next uma única vez. Deve ser chamado o mais cedo possível
 * no arranque da app (ver app/_layout.tsx), antes de qualquer componente
 * usar `useTranslation()`.
 */
export function initI18n(initialLanguage: SupportedLanguage) {
  if (initialized) return i18n;
  initialized = true;

  i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    returnNull: false,
  });

  return i18n;
}

export default i18n;

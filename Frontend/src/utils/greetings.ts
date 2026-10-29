// Mensagens de boas-vindas variadas consoante o período do dia.
// 3 variações por período para o dashboard não repetir sempre a mesma frase.
// Traduzido via i18next: os textos vivem em locales/*.json sob
// "dashboard.greetings.<period>" como array de 3 strings.

import i18n from '../i18n';

export type DayPeriod = 'dawn' | 'morning' | 'afternoon' | 'night';

function pickRandom(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function getDayPeriod(hour: number): DayPeriod {
  if (hour >= 0 && hour < 6) return 'dawn';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'night';
}

/**
 * Devolve uma saudação aleatória, coerente com o período do dia atual e
 * traduzida para o idioma ativo da UI (i18next). Chamar apenas uma vez por
 * sessão de montagem do Dashboard (não em cada render), para a frase não
 * "saltar" enquanto o utilizador está a olhar.
 */
export function getGreeting(date: Date = new Date()): string {
  const period = getDayPeriod(date.getHours());
  // returnObjects devolve o array de 3 variações daquele período.
  const options = i18n.t(`dashboard.greetings.${period}`, { returnObjects: true }) as unknown as string[];
  if (Array.isArray(options) && options.length > 0) {
    return pickRandom(options);
  }
  // Fallback de segurança, nunca deve ocorrer com os dicionários completos.
  return i18n.t('dashboard.greetings.fallback');
}

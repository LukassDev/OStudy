import { router, type Href } from 'expo-router';

// ────────────────────────────────────────────────────────────────────────────
// Navegação protegida contra toques rápidos repetidos.
//
// Problema: quando o utilizador toca várias vezes em pouco tempo num item que
// faz `router.push`, a stack empilha a mesma tela várias vezes antes de a
// transição terminar (cada "voltar" revela outra cópia).
//
// Solução — duas travas complementares:
//   1. Janela GLOBAL curta: qualquer navegação que aconteça logo a seguir a
//      outra é ignorada (bloqueia double/triple tap em qualquer botão).
//   2. Janela por DESTINO mais longa: re-abrir o MESMO destino pouco depois
//      também é ignorado (bloqueia "ficar a carregar no mesmo item").
// Navegações reais (para outro destino após a janela global, ou após o
// cooldown por destino) continuam a funcionar normalmente.
// ────────────────────────────────────────────────────────────────────────────

const GLOBAL_COOLDOWN_MS = 250; // entre navegações distintas
const SAME_DEST_COOLDOWN_MS = 1000; // para reabrir o mesmo destino

let lastNavAt = 0;
let lastHref = '';

function hrefKey(href: Href): string {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

function allowNavigation(href: Href): boolean {
  const now = Date.now();
  const key = hrefKey(href);

  // Qualquer navegação demasiado próxima da anterior é um toque repetido.
  if (now - lastNavAt < GLOBAL_COOLDOWN_MS) return false;

  // Reabrir exatamente o mesmo destino pouco depois também é um toque
  // repetido (ex.: carregar várias vezes no mesmo Space / Perfil).
  if (lastHref === key && now - lastNavAt < SAME_DEST_COOLDOWN_MS) return false;

  lastNavAt = now;
  lastHref = key;
  return true;
}

/**
 * Igual a `router.push`, mas ignora navegações resultantes de toques rápidos
 * repetidos (protege contra empilhar a mesma tela várias vezes).
 */
export function guardedPush(href: Href) {
  if (!allowNavigation(href)) return;
  router.push(href);
}

/**
 * Igual a `router.replace`, mas com a mesma proteção contra toques repetidos.
 */
export function guardedReplace(href: Href) {
  if (!allowNavigation(href)) return;
  router.replace(href);
}

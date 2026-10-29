import { useState, useCallback, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';

/**
 * Hook simples para copiar texto para a área de transferência com feedback
 * visual breve (ex: trocar o ícone "copy" por um "check" durante ~1.5s).
 * Usado tanto nas mensagens do Oren como nas do utilizador (ver
 * MessageActions.tsx) — não faz nenhum pedido de rede nem chamada à IA.
 */
export function useCopyToClipboard(resetDelayMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), resetDelayMs);
      } catch (err) {
        console.warn('Falha ao copiar para a área de transferência:', err);
      }
    },
    [resetDelayMs]
  );

  return { copied, copy };
}

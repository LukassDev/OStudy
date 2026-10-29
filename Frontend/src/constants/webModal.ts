import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

/** A partir daqui o web é tratado como "desktop"; abaixo (web mobile) o modal ocupa o ecrã todo. */
export const WEB_DESKTOP_MIN_WIDTH = 900;

/**
 * Layout partilhado dos modais no web.
 * - Desktop: cartão centrado que ocupa ~96% da altura (cabe tudo sem scroll desnecessário).
 * - Web mobile: ecrã inteiro, sem margens nem cantos arredondados.
 * - Nativo (iOS/Android): devolve estilos vazios — não altera nada.
 */
export function useWebModalLayout(maxWidth = 720): { overlay: ViewStyle; card: ViewStyle } {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return { overlay: {}, card: {} };

  const desktop = width >= WEB_DESKTOP_MIN_WIDTH;
  return {
    overlay: {
      padding: desktop ? 16 : 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    card: {
      width: '100%',
      maxWidth: desktop ? maxWidth : undefined,
      height: desktop ? '96%' : '100%',
      borderRadius: desktop ? 20 : 0,
      overflow: 'hidden',
    },
  };
}

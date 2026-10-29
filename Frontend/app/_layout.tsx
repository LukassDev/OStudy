import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { AppState, View, Text, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useColorScheme, vars } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { 
  useFonts, 
  DMSans_400Regular, 
  DMSans_500Medium, 
  DMSans_600SemiBold, 
  DMSans_700Bold 
} from '@expo-google-fonts/dm-sans';
import {
  Inter_400Regular,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useProfileStore } from '../src/stores/profileStore';
import { darkColors, lightColors, useThemeColors } from '../src/constants/theme';
import { initI18n, detectDeviceLanguage, resolveAppLanguage } from '../src/i18n';
import { AppDialogHost } from '../src/components/ui/AppDialog';
import { useTranslation } from 'react-i18next';
import { startAutomaticBackupScheduler } from '../src/services/automaticBackup';
import '../global.css';

// Impede que a tela de splash feche automaticamente antes do carregamento das fontes
SplashScreen.preventAutoHideAsync();

// Initialize translations before components mount to avoid a flash of English.
initI18n(detectDeviceLanguage());

function ThemeSync() {
  const theme = useProfileStore((s) => s.theme);
  const { setColorScheme } = useColorScheme();

  const applyNavBar = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const current = useProfileStore.getState().theme;
    NavigationBar.setBackgroundColorAsync(
      current === 'light' ? '#F8F5F0' : '#141312'
    );
    NavigationBar.setButtonStyleAsync(current === 'light' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    setColorScheme(theme);
    applyNavBar();
  }, [theme, setColorScheme, applyNavBar]);

  // Reaplica a cor da barra quando a app volta ao primeiro plano. Com
  // edge-to-edge/transparência, o sistema (e alguns modais) podem repor a
  // barra para um fundo claro mesmo com o tema escuro; isto garante que a
  // barra acompanha sempre o tema do perfil.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') applyNavBar();
    });
    return () => sub.remove();
  }, [applyNavBar]);

  return null;
}

function LanguageSync() {
  const language = useProfileStore((s) => s.language);
  const languageSetManually = useProfileStore((s) => s.language_set_manually);
  const loading = useProfileStore((s) => s.loading);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!loading && language) {
      const resolved = resolveAppLanguage({
        storedLanguage: language,
        languageSetManually,
      });
      i18n.changeLanguage(resolved);
    }
  }, [language, languageSetManually, loading, i18n]);

  return null;
}

function LoadingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: 14 }}>{t('common.loading', 'A carregar...')}</Text>
    </View>
  );
}

function themeVariables(theme: typeof lightColors | (typeof darkColors & { accent?: string })) {
  const toRgb = (hex: string | undefined) => {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return '0 0 0';
    const value = hex.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `${red} ${green} ${blue}`;
  };

  return vars({
    '--color-background': toRgb(theme.background),
    '--color-surface': toRgb(theme.surface),
    '--color-surfaceElevated': toRgb(theme.surfaceElevated),
    '--color-border': toRgb(theme.border),
    '--color-textPrimary': toRgb(theme.textPrimary),
    '--color-textSecondary': toRgb(theme.textSecondary),
    '--color-textTertiary': toRgb(theme.textTertiary),
    '--color-primary': toRgb(theme.primary),
    '--color-primaryPressed': toRgb(theme.primaryPressed),
    '--color-primarySoft': toRgb(theme.primarySoft),
    '--color-primaryText': toRgb(theme.primaryText),
    '--color-accent': toRgb(theme.accent),
    '--color-success': toRgb(theme.success),
    '--color-successSoft': toRgb(theme.successSoft),
    '--color-error': toRgb(theme.error),
    '--color-errorSoft': toRgb(theme.errorSoft),
    '--color-warning': toRgb(theme.warning),
    '--color-warningSoft': toRgb(theme.warningSoft),
  });
}

export default function RootLayout() {
  // Carregamento das fontes DM Sans
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Inter_400Regular,
    Inter_700Bold,
  });

  const { fetchProfile, theme, loading: profileLoading } = useProfileStore();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const title = 'OStudy';
    document.title = title;

    // Expo Router updates document.title as routes change. Keep the product
    // name fixed in the browser tab instead of exposing the current route.
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void fetchProfile().catch((error) => {
      console.error('Could not load the local profile:', error);
    });
  }, [fetchProfile]);

  useEffect(() => startAutomaticBackupScheduler(), []);

  // Hide the splash after both fonts and local profile data have loaded.
  useEffect(() => {
    if (fontsLoaded && !profileLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, profileLoading]);

  // Se as fontes não carregaram, mantém o app suspenso (o splash continua visível)
  if (!fontsLoaded) {
    return null;
  }

  const statusBarStyle = theme === 'light' ? 'dark' : 'light';
  const activeColors = theme === 'light' ? lightColors : darkColors;

  return (
    <SafeAreaProvider>
      <View style={[{ flex: 1 }, themeVariables(activeColors)]}>
        <ThemeSync />
        {Platform.OS === 'web' && <style>{`
          * { scrollbar-width: none !important; }
          *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          *:focus { outline: none !important; }
          *:focus-visible { outline: 2px solid ${activeColors.primary} !important; outline-offset: 3px; }
          input:focus, textarea:focus { outline: none !important; }
        `}</style>}
        <LanguageSync />
        <StatusBar style={statusBarStyle} />
        {profileLoading ? (
          <LoadingScreen />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(app)" />
          </Stack>
        )}

        <AppDialogHost />
      </View>
    </SafeAreaProvider>
  );
}

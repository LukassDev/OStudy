import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AvatarPicker } from '../../src/components/common/AvatarPicker';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { useThemeColors, useThemeMode } from '../../src/constants/theme';
import { LANGUAGE_OPTIONS, type SupportedLanguage, resolveAppLanguage } from '../../src/i18n';
import { useProfileStore } from '../../src/stores/profileStore';
import { getSetting } from '../../src/db/repositories/settings.repo';
import { INITIALS_AVATAR_ID } from '../../src/utils/avatarPresets';

export default function Onboarding() {
  const { welcomeShown } = useLocalSearchParams<{ welcomeShown?: string }>();
  const { setMode } = useThemeMode();
  const {
    name: storedName,
    updateProfile,
    language: storedLanguage,
    language_set_manually,
    theme,
    onboarding_completed,
    loading: profileLoading,
  } = useProfileStore();
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(storedName || t('onboarding.defaultName'));
  const [avatarStyle, setAvatarStyle] = useState(INITIALS_AVATAR_ID);
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolveAppLanguage({ storedLanguage, languageSetManually: language_set_manually }),
  );
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>('dark');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(
    welcomeShown === '1' || Platform.OS !== 'web',
  );
  const colors = useThemeColors();

  useEffect(() => {
    if (storedName) setName(storedName);
    else setName((current) => current || t('onboarding.defaultName'));
  }, [storedName, t]);

  useEffect(() => {
    if (theme === 'dark') return;
    setMode('dark');
    useProfileStore.setState({ theme: 'dark' });
  }, [setMode, theme]);

  useEffect(() => {
    if (!profileLoading && onboarding_completed) router.replace('/(app)/dashboard');
  }, [onboarding_completed, profileLoading]);

  useEffect(() => {
    if (Platform.OS !== 'web' || profileLoading || welcomeChecked || onboarding_completed) return;
    let active = true;
    void getSetting('welcome.enabled', true)
      .then((enabled) => {
        if (!active) return;
        if (enabled) {
          router.replace('/welcome?next=onboarding');
        } else {
          setWelcomeChecked(true);
        }
      })
      .catch((cause) => {
        console.error('Could not load the welcome screen setting:', cause);
        if (active) {
          setError(t('welcome.loadError'));
          setWelcomeChecked(true);
        }
      });
    return () => {
      active = false;
    };
  }, [onboarding_completed, profileLoading, t, welcomeChecked]);

  const handleLanguageSelect = async (code: SupportedLanguage) => {
    const previousDefaultName = t('onboarding.defaultName');
    const nextDefaultName = i18n.getFixedT(code)('onboarding.defaultName');
    if (name === previousDefaultName) setName(nextDefaultName);
    setLanguage(code);
    setError('');
    try {
      await i18n.changeLanguage(code);
      await updateProfile({ language: code, language_set_manually: true });
    } catch {
      setError(i18n.getFixedT(code)('onboarding.errors.saveFailed'));
    }
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      setError(t('onboarding.errors.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateProfile({
        name: name.trim(),
        avatar_style: avatarStyle,
        theme: selectedTheme,
        language,
        language_set_manually: true,
        onboarding_completed: true,
      });
      setMode(selectedTheme);
      router.replace('/(app)/dashboard');
    } catch {
      setError(t('onboarding.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleThemeSelect = (theme: 'light' | 'dark') => {
    setSelectedTheme(theme);
    setMode(theme);
    useProfileStore.setState({ theme });
  };

  if (!welcomeChecked && !onboarding_completed) {
    return <View style={[styles.safeArea, { backgroundColor: colors.background }]} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image source={require('../../assets/images/ostudyNewIcon.png')} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.appName, { color: colors.textPrimary }]}>OStudy</Text>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.title')}</Text>

          {error ? <ErrorBanner message={error} /> : null}

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('onboarding.avatarLabel')}</Text>
          <AvatarPicker name={name} value={avatarStyle} onChange={setAvatarStyle} />

          <Text style={[styles.sectionLabel, styles.spacedSection, { color: colors.textSecondary }]}>
            {t('onboarding.nameLabel')}
          </Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: colors.textPrimary }]}
              placeholder={t('onboarding.defaultName')}
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          <Text style={[styles.sectionLabel, styles.spacedSection, { color: colors.textSecondary }]}>
            {t('onboarding.languageLabel')}
          </Text>
          <View style={styles.optionsWrap}>
            {LANGUAGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: language === option.code }}
                onPress={() => void handleLanguageSelect(option.code)}
                style={[
                  styles.languageOption,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  language === option.code && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Text style={[styles.languageText, { color: colors.textSecondary }, language === option.code && styles.selectedText]}>
                  {option.nativeName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, styles.spacedSection, { color: colors.textSecondary }]}>
            {t('onboarding.themeLabel')}
          </Text>
          <View style={styles.themeRow}>
            {(['dark', 'light'] as const).map((theme) => {
              const selected = selectedTheme === theme;
              return (
                <TouchableOpacity
                  key={theme}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => handleThemeSelect(theme)}
                  style={[
                    styles.themeOption,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    name={theme === 'dark' ? 'moon-outline' : 'sunny-outline'}
                    size={21}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.themeText, { color: selected ? colors.primary : colors.textPrimary }]}>
                    {theme === 'dark' ? t('onboarding.dark') : t('onboarding.light')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            title={t('onboarding.startLabel')}
            onPress={handleComplete}
            loading={loading}
            style={[styles.startButton, { backgroundColor: colors.primary }]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
  },
  brand: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 76, height: 76, borderRadius: 20 },
  appName: { fontFamily: 'DMSans_700Bold', fontSize: 22, marginTop: 8 },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 25,
    textAlign: 'center',
    marginBottom: 22,
  },
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  spacedSection: { marginTop: 20 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 16, height: '100%' },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageOption: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
  },
  languageText: { fontFamily: 'DMSans_500Medium', fontSize: 13 },
  selectedText: { color: '#FFFFFF', fontFamily: 'DMSans_600SemiBold' },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeOption: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  themeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14 },
  startButton: { height: 54, borderRadius: 16, marginTop: 28 },
});

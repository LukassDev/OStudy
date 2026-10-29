import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../src/stores/profileStore';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { GeneratedAvatar } from '../../src/components/common/GeneratedAvatar';
import { AvatarPicker } from '../../src/components/common/AvatarPicker';
import { INITIALS_AVATAR_ID } from '../../src/utils/avatarPresets';
import { darkColors, lightColors, useThemeMode } from '../../src/constants/theme';
import { LANGUAGE_OPTIONS, SupportedLanguage, resolveAppLanguage } from '../../src/i18n';

const TOTAL_STEPS = 6;

const OrenMascot = ({ size = 100 }) => (
  <Svg width={size} height={size} viewBox="0 0 512 512">
    <Path fill="#4B5258" d="M233.4 55.1094C241.975 54.4914 251.252 55.2485 259.82 55.7752C303.194 58.4418 344.712 73.5394 377.615 102.304C407.64 128.253 426.3 161.42 439.844 198.08C451.531 229.714 450.594 248.778 442.729 281.465C432.731 323.017 417.811 363.249 389.284 395.955C367.73 420.666 341.043 432.977 309.133 438.33C298.148 440.245 286.956 442.204 275.725 442.837C275.113 442.897 274.532 442.921 273.918 442.956C216.689 446.276 156.689 431.445 113.257 392.539C92.6839 374.111 75.4638 347.898 67.2124 321.473C64.0559 311.364 61.7448 295.907 61.2923 285.286C58.6156 222.465 84.7047 154.496 126.875 108.163C146.98 86.0743 174.123 67.117 203.189 59.475C213.779 56.6906 222.549 55.637 233.4 55.1094Z" />
    <Path fill="#DB684C" d="M229.488 72.3582C241.518 71.6639 253.938 72.369 265.88 73.9129C299.941 78.3162 332.039 90.7626 358.362 113.179C385.842 136.579 404.553 167.593 416.565 201.36C420.353 212.008 423.727 222.61 424.623 233.93C427.15 265.835 409.895 319.07 395.369 347.282C389.123 359.415 381.806 370.792 372.926 381.172C352.029 405.597 329.814 415.868 298.712 421.813C288.875 423.693 279.115 425.17 269.125 425.955C256.907 426.54 244.275 426.595 232.188 425.677C171.023 421.031 110.17 388.655 84.8788 330.524C83.1481 326.546 81.3 322.815 79.926 318.6C76.1449 307.002 74.311 294.864 73.5803 282.71C71.3764 225.651 93.4891 166.079 130.892 123.211C157.129 93.1417 189.361 74.3384 229.488 72.3582Z" />
    <Path fill="#FEFEFE" d="M207.891 104.948C208.229 105.056 208.37 105.093 208.676 105.219C214.67 107.69 229.875 127.988 233.789 134.011C236.442 138.093 238.952 142.421 240.774 146.938C244.428 146.847 251.57 148.17 255.065 149.197C274.775 154.994 292.565 170.068 299.001 189.903C301.361 198.406 301.586 205.561 307.627 212.447C314.243 219.99 320.255 220.985 329.121 224.299C330.555 224.836 330.406 227.63 329.647 228.844C326.889 233.253 321.325 235.716 316.581 237.35C305.773 240.948 294.273 240.843 283.36 237.794C281.534 237.282 275.653 235.987 275.036 234.081C276.659 233.182 284.251 235.272 286.484 235.569C288.5 235.837 290.572 236.119 292.655 236.285C297.816 236.712 303.009 236.564 308.138 235.843C321.095 233.955 316.66 227.72 307.709 224.197C306.128 223.574 304.054 222.518 302.572 221.691C297.663 218.947 293.286 215.346 289.649 211.058C282.468 202.652 280.671 196.907 270.159 190.914C248.163 178.373 221.788 186.88 204.294 203.181C201.104 206.153 198.008 208.154 195.771 212.12C201.788 212.855 210.211 213.027 215.087 216.083C212.103 218.434 208.084 220.187 204.834 222.602C187.809 235.354 176.365 257.313 184.271 278.374C188.979 292.126 198.093 294.22 211.082 296.973C229.979 300.977 242.794 308.686 254.486 324.499C256.45 319.706 258.98 313.72 261.615 309.274C272.189 291.435 287.074 279.059 305.688 270.366C318.432 264.516 331.764 262.202 343.805 255.278C345.655 254.214 347.463 252.463 349.003 250.911C350.81 249.438 355.836 239.536 358.121 239.652C365.858 240.046 373.167 264.368 374.162 269.14C378.964 292.188 374.24 315.706 361.673 335.296C344.83 361.553 315.965 377.375 286.027 383.696C250.175 391.098 210.596 385.588 179.552 365.608C153.478 348.827 133.81 321.467 127.186 291.243C116.704 243.417 138.319 194.784 178.71 167.969C180.933 166.493 182.064 165.821 184.45 164.699C188.658 162.72 197.017 161.108 199.533 157.22L199.275 156.871C195.099 155.839 186.498 159.919 182.865 156.994C181.901 155.205 181.88 153.15 182.287 151.223C185.025 138.266 197.375 112.294 207.891 104.948Z" />
    <Path fill="#DB684C" d="M359.182 249.693C359.893 250.431 361.564 253.565 362.033 254.602C367.929 267.644 370.062 284.061 364.901 297.683C361.876 305.669 356.307 312.895 348.393 316.418C348.128 313.619 348.889 299.588 343.375 302.597C336.346 306.431 329.932 308.278 322.217 310.205C320.435 310.585 318.684 311.03 316.884 310.607C314.146 307.989 321.337 298.432 319.938 295.407C318.692 292.716 307.93 295.776 304.993 294.774C304.213 293.389 306.36 288.808 306.998 287.276C315.546 266.765 339.57 271.414 353.413 257.773C355.909 255.314 357.38 252.695 359.182 249.693Z" />
    <Path fill="#DB684C" d="M152.977 305.417C155.001 305.934 159.939 308.735 162.091 309.651C167.884 312.118 173.698 313.796 179.82 315.211C195.055 318.732 211.581 317.47 226.278 322.822C236.932 326.703 247.576 333.506 253.975 342.999C255.954 345.936 257.121 348.416 258.618 351.57C261.509 345.53 264.679 339.81 269.398 335.002C277.676 326.585 288.633 320.952 300.188 318.678C303.307 318.064 310.171 316.293 312.662 318.762C312.819 320.212 309.989 320.974 308.828 321.16C291.663 323.901 278.668 328.158 268.414 342.893C280.622 332.247 288.662 329.016 304.183 325.101C322.27 321.616 329.923 322.041 343.928 309.27C344.355 317.274 341.756 320.674 335.205 325.023C320.153 335.015 301.133 330.692 285.287 338.724C277.49 342.676 269.643 347.436 264.232 354.446C261.771 357.648 260.186 361.55 258.106 365.041C255.822 359.282 253.4 353.922 249.493 349.041C240.276 337.523 226.601 331.665 212.257 329.71C206.117 328.873 199.772 328.678 193.589 327.853C176.165 325.529 163.847 319.208 152.977 305.417Z" />
    <Path fill="#FEFEFE" d="M253.313 237.3C253.681 237.467 254.382 237.767 254.559 238.092C256.24 241.17 257.472 245.816 258.853 249.069C262.759 258.275 268.873 259.825 277.595 263.01C278.69 263.409 279.742 263.683 280.2 264.728C279.556 265.57 268.356 268.695 265.026 271.51C258.117 277.352 258.42 285.661 253.851 291.461C251.948 289.263 250.316 282.291 248.525 278.909C245.873 273.158 241.733 269.768 235.707 267.913C233.818 267.332 227.675 266.085 226.865 264.371C227.508 263.367 233.59 261.617 234.805 261.244C244.604 258.238 247.676 253.496 250.721 244.042C251.286 242.289 252.461 238.993 253.313 237.3Z" />
    <Path fill="#FEFEFE" d="M282.192 124.312C283.239 124.618 284.091 125.215 284.414 126.309C287.059 135.283 286.5 151.339 283.27 159.749C279.357 156.302 274.469 153.134 269.875 150.74C265.516 148.457 260.955 146.967 256.637 144.666C261.367 135.859 272.308 126.502 282.192 124.312Z" />
    <Path fill="#FEFEFE" d="M260.383 201.341C263.466 201.15 266.111 201.803 268.787 203.364C270.733 204.498 275.478 208.541 273.972 210.957C272.565 211.272 268.973 208.946 267.603 208.178C264.146 206.695 261.801 206.042 258.007 206.736C256.042 207.096 253.172 207.962 251.604 206.519C251.278 202.933 257.719 201.634 260.383 201.341Z" />
  </Svg>
);

function ProgressDots({ step, colors }: { step: number; colors: any }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: colors.border },
            i + 1 <= step && { backgroundColor: colors.primary },
          ]}
        />
      ))}
    </View>
  );
}

export default function Onboarding() {
  const { setMode } = useThemeMode();
  const {
    theme: storedTheme,
    updateProfile,
    language: storedLanguage,
    language_set_manually,
    onboarding_completed,
    loading: profileLoading,
  } = useProfileStore();
  const { t, i18n } = useTranslation();

  const GOALS = [
    t('onboarding.step4.goals.improveGrades'),
    t('onboarding.step4.goals.prepareExams'),
    t('onboarding.step4.goals.learnSomethingNew'),
    t('onboarding.step4.goals.organizeStudies'),
    t('onboarding.step4.goals.other'),
  ];
  const OTHER_GOAL = t('onboarding.step4.goals.other');

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [avatarStyle, setAvatarStyle] = useState(INITIALS_AVATAR_ID);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(() => storedTheme);
  const colors = selectedTheme === 'light' ? lightColors : darkColors;

  // Guarda defensiva: se o perfil já indica onboarding concluído, nunca
  // devemos deixar o utilizador ficar (preso) aqui — segue para o dashboard.
  useEffect(() => {
    if (!profileLoading && onboarding_completed) {
      router.replace('/(app)/dashboard');
    }
  }, [onboarding_completed, profileLoading]);

  // Pré-seleciona o idioma resolvido (escolha manual anterior > deteção do
  // dispositivo > fallback inglês). O utilizador ainda pode alterá-lo aqui
  // antes de confirmar o onboarding.
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    resolveAppLanguage({ storedLanguage, languageSetManually: language_set_manually })
  );

  const handleLanguageSelect = async (code: SupportedLanguage) => {
    setLanguage(code);
    setError('');
    try {
      await i18n.changeLanguage(code);
      await updateProfile({ language: code, language_set_manually: true });
    } catch {
      setError(t('onboarding.errors.saveFailed'));
    }
  };

  const handleNext = () => {
    if (step === 3 && !name.trim()) {
      setError(t('onboarding.errors.nameRequired'));
      return;
    }
    if (step === 4 && !goal) {
      setError(t('onboarding.errors.goalRequired'));
      return;
    }
    if (step === 4 && goal === OTHER_GOAL && !customGoal.trim()) {
      setError(t('onboarding.errors.customGoalRequired'));
      return;
    }
    setError('');
    setStep((s) => s + 1);
  };

  const handleComplete = async () => {
    const finalGoal = goal === OTHER_GOAL ? customGoal : goal;
    setLoading(true);
    setError('');
    try {
      await updateProfile({
        name,
        goal: finalGoal,
        avatar_style: avatarStyle,
        theme: selectedTheme,
        // A escolha de idioma feita neste ecrã (mesmo que coincida com o
        // valor auto-detetado) conta como escolha explícita: o utilizador
        // viu o seletor e confirmou o onboarding com ele visível.
        language,
        language_set_manually: true,
        onboarding_completed: true,
      });
      router.replace('/(app)/dashboard');
    } catch {
      setError(t('onboarding.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const nextLabel = step === TOTAL_STEPS ? t('onboarding.startLabel') : t('onboarding.nextLabel');
  const onPrimaryPress = step === TOTAL_STEPS ? handleComplete : handleNext;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ProgressDots step={step} colors={colors} />

          {error ? <ErrorBanner message={error} /> : null}

          {step === 1 && (
            <View style={styles.centerBlock}>
              <View>
                <OrenMascot size={110} />
              </View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.step1.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('onboarding.step1.subtitle')}</Text>
            </View>
          )}

          {step === 2 && (
            <View style={styles.centerBlock}>
              <View style={[styles.introCard, { backgroundColor: colors.primarySoft }]}>
                <View style={[styles.introIconWrapper, { backgroundColor: colors.surface }]}>
                  <OrenMascot size={64} />
                </View>
                <Text style={[styles.introTitle, { color: colors.textPrimary }]}>{t('onboarding.step2.title')}</Text>
                <Text style={[styles.introText, { color: colors.textSecondary }]}>
                  {t('onboarding.step2.text')}
                </Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.step3.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('onboarding.step3.subtitle')}</Text>
              <View style={[styles.inputWrapper, styles.formSpacing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.textPrimary }]}
                  placeholder={t('onboarding.step3.namePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>

              {/* Seletor de idioma da app. Pré-selecionado a partir de
                  resolveAppLanguage(); cada escolha é aplicada e persistida
                  imediatamente como preferência manual. */}
              <Text style={[styles.languageLabel, styles.formSpacing, { color: colors.textSecondary }]}>
                {t('onboarding.step3.languageLabel')}
              </Text>
              <View style={styles.languageWrap}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    onPress={() => handleLanguageSelect(opt.code)}
                    style={[
                      styles.languageChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      language === opt.code && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageChipText,
                        { color: colors.textSecondary },
                        language === opt.code && { color: '#FFFFFF' },
                      ]}
                    >
                      {opt.nativeName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.languageHint, { color: colors.textTertiary }]}>
                {t('onboarding.step3.languageHint')}
              </Text>
            </View>
          )}

          {step === 4 && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.step4.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('onboarding.step4.subtitle')}</Text>
              <View style={[styles.goalsWrap, styles.formSpacing]}>
                {GOALS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      setGoal(g);
                      setError('');
                    }}
                    style={[
                      styles.goalChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      goal === g && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[styles.goalChipText, { color: colors.textSecondary }, goal === g && { color: '#FFFFFF' }]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {goal === OTHER_GOAL && (
                <View style={[styles.inputWrapper, styles.formSpacing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="telescope-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.textPrimary }]}
                    placeholder={t('onboarding.step4.customGoalPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    autoCapitalize="sentences"
                    returnKeyType="done"
                  />
                </View>
              )}
            </View>
          )}

          {step === 5 && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.step5.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('onboarding.step5.subtitle')}</Text>
              <AvatarPicker name={name} value={avatarStyle} onChange={setAvatarStyle} />
            </View>
          )}

          {step === 6 && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{t('onboarding.step6.title')}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('onboarding.step6.subtitle')}</Text>
              <View style={[styles.themeRow, styles.formSpacing]}>
                {(['light', 'dark'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => {
                      setSelectedTheme(m);
                      setMode(m);
                      useProfileStore.setState({ theme: m });
                    }}
                    style={[
                      styles.themeCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      selectedTheme === m && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    ]}
                  >
                    <Ionicons
                      name={m === 'light' ? 'sunny-outline' : 'moon-outline'}
                      size={26}
                      color={selectedTheme === m ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.themeCardLabel, { color: colors.textPrimary }]}>
                      {m === 'light' ? t('onboarding.step6.light') : t('onboarding.step6.dark')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.summaryCard, styles.formSpacing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <GeneratedAvatar name={name || '?'} size={48} avatarStyle={avatarStyle} />
                <Text style={[styles.summaryName, { color: colors.textPrimary }]}>{name}</Text>
                <Text style={[styles.summaryGoal, { color: colors.textSecondary }]}>{goal === OTHER_GOAL ? customGoal : goal}</Text>
              </View>
              <Text style={[styles.summaryHint, { color: colors.textSecondary }]}>
                {t('onboarding.step6.spaceHint')}
              </Text>
            </View>
          )}

          <View style={styles.footerRow}>
            <Button
              title={nextLabel}
              onPress={onPrimaryPress}
              loading={loading}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            />
          </View>

          {step > 1 && (
            <TouchableOpacity onPress={() => setStep((s) => s - 1)} style={styles.backTextBtn}>
              <Text style={[styles.backTextBtnLabel, { color: colors.textSecondary }]}>← {t('common.back')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 6,
    width: 28,
    marginHorizontal: 2,
    borderRadius: 999,
  },
  centerBlock: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'stretch',
  },
  mascotWrapper: {
    borderRadius: 100,
    padding: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 24,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  formSpacing: {
    marginTop: 24,
  },
  introCard: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  introIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 8,
  },
  introText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    height: '100%',
  },
  languageLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    gap: 6,
  },
  languageIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageChipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  languageHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginTop: 10,
  },
  goalsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  goalChipText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
  // Grid de avatares: 3 itens por linha (33.3% cada), então 5 avatares
  // ficam 3 em cima e 2 em baixo, em vez de 4+1 ou desalinhado.
  avatarsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  avatarItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 999,
    padding: 3,
  },
  avatarLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 20,
    alignItems: 'center',
  },
  themeCardLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    marginTop: 10,
  },
  summaryCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 24,
    alignItems: 'center',
  },
  summaryName: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
    marginTop: 12,
  },
  summaryGoal: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    marginTop: 4,
  },
  summaryHint: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 16,
  },
  footerRow: {
    marginTop: 28,
  },
  primaryButton: {
    height: 60,
    borderRadius: 20,
  },
  backTextBtn: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  backTextBtnLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },
});

import { useState, useEffect } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../src/stores/profileStore';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ui/ErrorBanner';
import { SuccessBanner } from '../../src/components/ui/SuccessBanner';
import { GeneratedAvatar } from '../../src/components/common/GeneratedAvatar';
import { AvatarPicker } from '../../src/components/common/AvatarPicker';
import { INITIALS_AVATAR_ID } from '../../src/utils/avatarPresets';
import { useThemeColors, useThemeMode } from '../../src/constants/theme';
import { LANGUAGE_OPTIONS, SupportedLanguage } from '../../src/i18n';
import { ProfileAppSettings } from '../../src/components/profile/ProfileAppSettings';

export default function Profile() {
  const colors = useThemeColors();
  const { setMode } = useThemeMode();
  const { name, goal, avatar_style, language, theme, updateProfile } = useProfileStore();
  const { t, i18n } = useTranslation();

  const [editName, setEditName] = useState(name || '');
  const [editGoal, setEditGoal] = useState(goal || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [selectedAvatar, setSelectedAvatar] = useState(avatar_style || INITIALS_AVATAR_ID);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  useEffect(() => {
    if (name) setEditName(name);
    if (goal !== undefined && goal !== null) setEditGoal(goal);
    if (avatar_style) setSelectedAvatar(avatar_style);
  }, [name, goal, avatar_style]);

  const handleSave = async () => {
    if (!editName.trim()) { setError(t('profile.nameRequired')); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      await updateProfile({ name: editName.trim(), goal: editGoal.trim() || null, avatar_style: selectedAvatar });
      setSuccess(true);
    } catch {
      setError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = async (newMode: 'light' | 'dark') => {
    useProfileStore.setState({ theme: newMode });
    setMode(newMode);
    try {
      await updateProfile({ theme: newMode });
    } catch {
      setError(t('profile.saveError'));
    }
  };

  // Troca de idioma editável a qualquer momento no Perfil. Qualquer escolha
  // feita aqui é sempre uma escolha explícita do utilizador, por isso
  // language_set_manually passa (ou mantém-se) a true — a partir daqui a
  // app nunca mais volta a auto-detetar o idioma do sistema para esta conta.
  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    i18n.changeLanguage(newLanguage);
    setShowLanguagePicker(false);
    try {
      await updateProfile({ language: newLanguage, language_set_manually: true });
    } catch {
      setError(t('profile.saveError'));
    }
  };

  const currentLanguageOption = LANGUAGE_OPTIONS.find((opt) => opt.code === language) ?? LANGUAGE_OPTIONS[1];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { width: '100%', maxWidth: 720, alignSelf: 'center' }]} showsVerticalScrollIndicator={false}>

          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/dashboard')} style={styles.backButton} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Header hero: o avatar já não vive dentro de um card com sombra
              genérica — é o elemento de maior peso do ecrã, com o nome logo
              a seguir num tamanho claramente acima de tudo o resto. */}
          <View style={styles.heroSection}>
            <TouchableOpacity
              onPress={() => setShowAvatarPicker((v) => !v)}
              activeOpacity={0.85}
              style={styles.avatarTouchable}
            >
              <GeneratedAvatar name={editName || '?'} size={98} avatarStyle={selectedAvatar} />
              <View style={[styles.editBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <Ionicons name="pencil" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <Text style={[styles.userName, { color: colors.textPrimary }]}>{name || t('profile.defaultName')}</Text>
          </View>

          {showAvatarPicker && (
            <View style={[styles.avatarPickerBox, { borderColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.textSecondary }]}>{t('profile.avatarPickerTitle')}</Text>
              <AvatarPicker name={editName} value={selectedAvatar} onChange={setSelectedAvatar} />
            </View>
          )}

          {error ? <ErrorBanner message={error} /> : null}
          {success ? <SuccessBanner message={t('profile.saveSuccess')} /> : null}

          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>{t('profile.sections.personalInfo')}</Text>

          <View style={styles.inputsGroup}>
            <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={19} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder={t('profile.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={editName}
                onChangeText={setEditName}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
              <Ionicons name="telescope-outline" size={19} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.textPrimary }]}
                placeholder={t('profile.goalPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={editGoal}
                onChangeText={setEditGoal}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <Button
              title={t('profile.saveChanges')}
              onPress={handleSave}
              loading={saving}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            />
          </View>

          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>{t('profile.sections.appearance')}</Text>

          <View style={styles.themeRow}>
            <TouchableOpacity
              onPress={() => handleThemeChange('light')}
              style={[
                styles.themeOption,
                { borderColor: colors.border },
                theme === 'light' && { borderColor: colors.primary },
              ]}
            >
              <Ionicons name="sunny-outline" size={18} color={theme === 'light' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.themeOptionLabel, { color: theme === 'light' ? colors.primary : colors.textSecondary }]}>
                {t('profile.theme.light')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleThemeChange('dark')}
              style={[
                styles.themeOption,
                { borderColor: colors.border },
                theme === 'dark' && { borderColor: colors.primary },
              ]}
            >
              <Ionicons name="moon-outline" size={18} color={theme === 'dark' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.themeOptionLabel, { color: theme === 'dark' ? colors.primary : colors.textSecondary }]}>
                {t('profile.theme.dark')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>{t('profile.sections.language')}</Text>

          <View style={styles.languageBlock}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setShowLanguagePicker((v) => !v)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.languageFlag}></Text>
                <Text style={[styles.settingsText, { color: colors.textPrimary }]}>{currentLanguageOption.nativeName}</Text>
              </View>
              <Ionicons name={showLanguagePicker ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textTertiary} />
            </TouchableOpacity>

            {showLanguagePicker && (
              <View style={[styles.languageList, { borderColor: colors.border }]}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    onPress={() => handleLanguageChange(opt.code)}
                    style={styles.languageListItem}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.languageFlag}></Text>
                      <Text
                        style={[
                          styles.settingsText,
                          { color: opt.code === language ? colors.primary : colors.textPrimary },
                        ]}
                      >
                        {opt.nativeName}
                      </Text>
                    </View>
                    {opt.code === language && <Ionicons name="checkmark" size={17} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={[styles.languageHint, { color: colors.textTertiary }]}>{t('profile.language.hint')}</Text>
          </View>

          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>{t('profile.sections.privacySettings')}</Text>
          <ProfileAppSettings />

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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },

  // Hero: sem card, sem sombra decorativa — o próprio avatar e o nome
  // carregam o peso visual do topo do ecrã.
  heroSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  avatarTouchable: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  userName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
    marginTop: 16,
  },
  avatarPickerBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  pickerTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    marginBottom: 12,
  },

  // Section headers: sem tracking exagerado de "eyebrow label", peso normal
  // de subtítulo — servem para orientar, não para decorar.
  sectionHeader: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    marginBottom: 12,
    marginTop: 4,
  },

  inputsGroup: {
    gap: 10,
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
  },
  saveButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 8,
  },

  themeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  themeOptionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
  },

  languageBlock: {
    marginBottom: 32,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  settingsText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    marginLeft: 12,
  },
  languageFlag: {
    fontSize: 19,
  },
  languageList: {
    borderTopWidth: 1,
    paddingTop: 4,
  },
  languageListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  languageHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },

  accountBlock: {
    marginBottom: 8,
  },
});

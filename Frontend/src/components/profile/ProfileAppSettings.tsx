import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { showAppDialog } from '../ui/AppDialog';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useThemeColors } from '../../constants/theme';
import { getSetting, setSetting } from '../../db/repositories/settings.repo';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { DEFAULT_TEXT_MODEL, DEFAULT_TUTOR_PROMPT, DEFAULT_VISION_MODEL, normalizeEditableTutorPrompt, SUGGESTED_MODEL_ID } from '../../services/ai/config';
import {
  AUTO_BACKUP_INTERVALS,
  chooseBackupFolderAndEnable,
  createAutomaticBackupNow,
  disableAutomaticBackups,
  enableDeviceAutomaticBackups,
  getAutomaticBackupSettings,
  updateAutomaticBackupInterval,
  type AutoBackupIntervalHours,
} from '../../services/automaticBackup';
import { getApiKey, removeApiKey, setApiKey } from '../../services/ai/keyStore';
import { testOpenRouterKey } from '../../services/ai/openrouter';
import { connectClassroom, disconnectClassroom, getClassroomAccountEmail, getClassroomClientId, hasClassroomConnection, prepareClassroomWebAuth, setClassroomClientId } from '../../services/classroom/auth';
import { clearLocalDatabase, exportLocalDatabase, pickAndImportLocalDatabase } from '../../services/localDataTransfer';
import { useChatStore } from '../../stores/chatStore';
import { useProfileStore } from '../../stores/profileStore';
import { useSpaceStore } from '../../stores/spaceStore';

function confirmDialog(title: string, message: string, cancelLabel: string, continueLabel: string): Promise<boolean> {
  return new Promise(resolve => showAppDialog(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
    { text: continueLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { variant: 'warning', dismissible: false }));
}

function SettingsSection({ title, expanded, onToggle, children }: React.PropsWithChildren<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const colors = useThemeColors();
  return <View style={{ marginBottom: 12, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}
      style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{title}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
    </Pressable>
    {expanded && <View style={{ gap: 12, paddingBottom: 16 }}>{children}</View>}
  </View>;
}

function SettingsDisclosure({ title, expanded, onToggle, children }: React.PropsWithChildren<{
  title: string;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const colors = useThemeColors();
  return <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{title}</Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
    </Pressable>
    {expanded && <View style={{ gap: 8, paddingBottom: 12 }}>{children}</View>}
  </View>;
}

function DataActionButton({ title, description, icon, onPress, disabled, destructive = false }: {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  const colors = useThemeColors();
  const tint = destructive ? colors.destructive : colors.textPrimary;
  return <Pressable
    cssInterop={false}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint={description}
    accessibilityState={{ disabled }}
    style={({ pressed }) => ({
      width: '100%',
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: destructive ? colors.destructive : colors.border,
      backgroundColor: destructive ? colors.destructiveSoft : colors.surfaceElevated,
      opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
    })}
  >
    <View style={{ width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={destructive ? colors.destructive : colors.textSecondary} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={{ color: tint, fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 }}>{title}</Text>
      {description && <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, flexShrink: 1 }}>{description}</Text>}
    </View>
  </Pressable>;
}

function formatBackupTime(timestamp: string, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const dateKey = date.toLocaleDateString(locale);
  const day = dateKey === today.toLocaleDateString(locale)
    ? todayLabel
    : dateKey === yesterday.toLocaleDateString(locale)
      ? yesterdayLabel
      : dateKey;
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

export function ProfileAppSettings() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const { copied: classroomSha1Copied, copy: copyClassroomSha1 } = useCopyToClipboard();
  const [apiKey, setApiKeyDraft] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [textModel, setTextModel] = useState<string>(DEFAULT_TEXT_MODEL);
  const [visionModel, setVisionModel] = useState<string>(DEFAULT_VISION_MODEL);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_TUTOR_PROMPT);
  const [busy, setBusy] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState<AutoBackupIntervalHours>(24);
  const [autoBackupLastAt, setAutoBackupLastAt] = useState<string | null>(null);
  const [autoBackupError, setAutoBackupError] = useState('');
  const [autoBackupFolderName, setAutoBackupFolderName] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [classroomClientId, setClassroomClientIdDraft] = useState('');
  const [classroomExpanded, setClassroomExpanded] = useState(false);
  const [classroomWebGuideExpanded, setClassroomWebGuideExpanded] = useState(false);
  const [classroomAndroidGuideExpanded, setClassroomAndroidGuideExpanded] = useState(false);
  const [classroomConnected, setClassroomConnected] = useState(false);
  const [classroomAccountEmail, setClassroomAccountEmail] = useState<string | null>(null);
  const [classroomExpired, setClassroomExpired] = useState(false);
  const [classroomAuthReady, setClassroomAuthReady] = useState(Platform.OS !== 'web');
  const [classroomError, setClassroomError] = useState('');
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [welcomeBusy, setWelcomeBusy] = useState(true);
  const [welcomeExpanded, setWelcomeExpanded] = useState(false);
  const supportsWebBackups = Platform.OS !== 'web'
    || (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined');

  const refreshBackupSettings = async () => {
    const settings = await getAutomaticBackupSettings();
    setAutoBackupEnabled(settings.enabled);
    setAutoBackupInterval(settings.intervalHours);
    setAutoBackupLastAt(settings.lastAt);
    setAutoBackupError(settings.lastError);
    setAutoBackupFolderName(settings.folderName);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      getApiKey(),
      getSetting('ai.textModel', DEFAULT_TEXT_MODEL),
      getSetting('ai.visionModel', DEFAULT_VISION_MODEL),
      getSetting('ai.systemPrompt', DEFAULT_TUTOR_PROMPT),
      getClassroomClientId(),
      hasClassroomConnection(),
      getClassroomAccountEmail(),
    ]).then(([key, text, vision, prompt, classroomId, connected, accountEmail]) => {
      if (!active) return;
      setApiKeyDraft(key || '');
      setTextModel(text);
      setVisionModel(vision);
      setSystemPrompt(normalizeEditableTutorPrompt(prompt) || DEFAULT_TUTOR_PROMPT);
      setClassroomClientIdDraft(classroomId || '');
      setClassroomConnected(Boolean(connected));
      setClassroomAccountEmail(accountEmail);
      setClassroomExpired(false);
    }).catch(error => showAppDialog(t('profile.appSettings.errors.open'), String(error), undefined, { variant: 'danger' }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void getSetting('welcome.enabled', true)
      .then((enabled) => {
        if (active) setWelcomeEnabled(enabled);
      })
      .catch((error) => {
        if (active) {
          showAppDialog(
            t('profile.appSettings.errors.loadWelcome'),
            error instanceof Error ? error.message : String(error),
            undefined,
            { variant: 'danger' },
          );
        }
      })
      .finally(() => {
        if (active) setWelcomeBusy(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let active = true;
    void prepareClassroomWebAuth()
      .then(() => { if (active) setClassroomAuthReady(true); })
      .catch(error => {
        if (active) showAppDialog('Google Classroom', error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const settings = await getAutomaticBackupSettings();
      if (!active) return;
      setAutoBackupEnabled(settings.enabled);
      setAutoBackupInterval(settings.intervalHours);
      setAutoBackupLastAt(settings.lastAt);
      setAutoBackupError(settings.lastError);
      setAutoBackupFolderName(settings.folderName);
    };
    void refresh().catch(error => showAppDialog(t('profile.appSettings.errors.loadBackup'), String(error), undefined, { variant: 'danger' }));
    const timer = setInterval(() => void refresh().catch(error => console.error('Could not refresh automatic backup status:', error)), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const saveKey = async () => {
    setBusy(true);
    try {
      await setApiKey(apiKey);
      await setSetting('ai.textModel', textModel);
      await setSetting('ai.visionModel', visionModel.trim());
      await setSetting('ai.systemPrompt', normalizeEditableTutorPrompt(systemPrompt.trim()) || DEFAULT_TUTOR_PROMPT);
      showAppDialog(t('profile.appSettings.dialogs.settingsSaved'), t('profile.appSettings.dialogs.keyStorage'), undefined, { variant: 'success' });
    } catch (error) {
        showAppDialog(t('profile.appSettings.errors.save'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const testKey = async () => {
    setBusy(true);
    try {
      await setApiKey(apiKey);
      await testOpenRouterKey(textModel);
      showAppDialog(t('profile.appSettings.dialogs.keyValid'), t('profile.appSettings.dialogs.keyValidMessage'), undefined, { variant: 'success' });
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.testKey'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const saveClassroomClientId = async () => {
    setBusy(true);
    try {
      await setClassroomClientId(classroomClientId);
      const connected = await hasClassroomConnection();
      setClassroomConnected(Boolean(connected));
      setClassroomExpired(false);
      showAppDialog('Google Classroom', 'O Client ID foi guardado localmente.', undefined, { variant: 'success' });
    } catch (error) {
      showAppDialog('Google Classroom', error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleClassroomConnect = async () => {
    setBusy(true);
    setClassroomError('');
    try {
      await connectClassroom(classroomClientId);
      if (Platform.OS !== 'android') await setClassroomClientId(classroomClientId);
      const connected = await hasClassroomConnection();
      if (!connected) throw new Error('O Google fechou a janela, mas o OStudy não conseguiu guardar a autorização. Tenta novamente e não feches a janela antes de terminar.');
      setClassroomAccountEmail(await getClassroomAccountEmail());
      setClassroomConnected(true);
      setClassroomExpired(false);
      showAppDialog('Google Classroom', 'Ligação concluída com sucesso.', undefined, { variant: 'success' });
    } catch (error) {
      setClassroomConnected(false);
      setClassroomExpired(false);
      const message = error instanceof Error ? error.message : String(error);
      setClassroomError(message);
      showAppDialog('Google Classroom', message, undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleClassroomDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectClassroom();
      setClassroomConnected(false);
      setClassroomAccountEmail(null);
      setClassroomExpired(false);
    } catch (error) {
      showAppDialog('Google Classroom', error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    const confirmed = await confirmDialog(
      t('profile.appSettings.dialogs.exportTitle'),
      t('profile.appSettings.dialogs.exportWarning'),
      t('common.cancel'),
      t('common.continue'),
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await exportLocalDatabase();
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.export'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const enableAutomaticBackup = async () => {
    setBackupBusy(true);
    try {
      const savedAt = Platform.OS === 'web'
        ? await chooseBackupFolderAndEnable(autoBackupInterval)
        : await enableDeviceAutomaticBackups(autoBackupInterval);
      setAutoBackupLastAt(savedAt);
      setAutoBackupError('');
      setAutoBackupEnabled(true);
      const settings = await getAutomaticBackupSettings();
      setAutoBackupFolderName(settings.folderName);
      showAppDialog(
        t('profile.appSettings.dialogs.backupEnabled'),
        Platform.OS === 'web'
          ? t('profile.appSettings.dialogs.backupEnabledWeb')
          : t('profile.appSettings.dialogs.backupEnabledDevice'),
        undefined,
        { variant: 'success' },
      );
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.enableBackup'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBackupBusy(false);
    }
  };

  const turnOffAutomaticBackup = async () => {
    setBackupBusy(true);
    try {
      await disableAutomaticBackups();
      setAutoBackupEnabled(false);
      setAutoBackupError('');
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.disableBackup'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBackupBusy(false);
    }
  };

  const changeAutomaticBackupInterval = async (interval: AutoBackupIntervalHours) => {
    setAutoBackupInterval(interval);
    try {
      await updateAutomaticBackupInterval(interval);
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.interval'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
      await refreshBackupSettings();
    }
  };

  const backupNow = async () => {
    setBackupBusy(true);
    try {
      const savedAt = await createAutomaticBackupNow();
      setAutoBackupLastAt(savedAt);
      setAutoBackupError('');
      showAppDialog(t('profile.appSettings.dialogs.backupSaved'), t('profile.appSettings.dialogs.backupSavedMessage'), undefined, { variant: 'success' });
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.backup'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBackupBusy(false);
    }
  };

  const importData = async () => {
    setBusy(true);
    try {
      const imported = await pickAndImportLocalDatabase(message =>
        confirmDialog(
          t('profile.appSettings.dialogs.importTitle'),
          t('profile.appSettings.dialogs.importWarning'),
          t('common.cancel'),
          t('common.continue'),
        ),
      );
      if (!imported) return;
      useChatStore.getState().reset();
      await useSpaceStore.getState().fetchSpaces(true);
      await useProfileStore.getState().fetchProfile();
      router.replace('/(app)/dashboard');
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.import'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const clearData = async () => {
    setBusy(true);
    try {
      await clearLocalDatabase();
      await removeApiKey();
      useChatStore.getState().reset();
      await useProfileStore.getState().reset();
      await useSpaceStore.getState().fetchSpaces(true);
      setDeleteConfirmationVisible(false);
      if (Platform.OS === 'web') window.location.assign('/onboarding');
      else router.replace('/onboarding');
    } catch (error) {
      setDeleteConfirmationVisible(false);
      showAppDialog(t('profile.appSettings.errors.delete'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const toggleWelcome = async () => {
    const nextValue = !welcomeEnabled;
    setWelcomeBusy(true);
    try {
      await setSetting('welcome.enabled', nextValue);
      setWelcomeEnabled(nextValue);
    } catch (error) {
      showAppDialog(
        t('profile.appSettings.errors.saveWelcome'),
        error instanceof Error ? error.message : String(error),
        undefined,
        { variant: 'danger' },
      );
    } finally {
      setWelcomeBusy(false);
    }
  };

  return <>
    <SettingsSection
      title={t('profile.appSettings.welcome.title')}
      expanded={welcomeExpanded}
      onToggle={() => setWelcomeExpanded(value => !value)}
    >
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
        {t('profile.appSettings.welcome.description')}
      </Text>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: welcomeEnabled, disabled: welcomeBusy }}
        disabled={welcomeBusy}
        onPress={() => void toggleWelcome()}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: welcomeBusy ? 0.6 : 1 }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
          {t('profile.appSettings.welcome.enabled')}
        </Text>
        <Ionicons
          name={welcomeEnabled ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={welcomeEnabled ? colors.textPrimary : colors.textTertiary}
        />
      </Pressable>
    </SettingsSection>
    <SettingsSection title={t('profile.appSettings.ai.title')} expanded={aiExpanded} onToggle={() => setAiExpanded(value => !value)}>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{t('profile.appSettings.ai.keyHint')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
        <TextInput value={apiKey} onChangeText={setApiKeyDraft} secureTextEntry={!keyVisible}
          autoCapitalize="none" autoCorrect={false} placeholder="sk-or-v1-…" placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('profile.appSettings.ai.apiKey')}
          style={{ flex: 1, minHeight: 48, color: colors.textPrimary }} />
        <Pressable onPress={() => setKeyVisible(value => !value)} accessibilityRole="button"
          accessibilityLabel={keyVisible ? t('profile.appSettings.ai.hideKey') : t('profile.appSettings.ai.showKey')}>
          <Ionicons name={keyVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.ai.textModel')}</Text>
        <TextInput value={textModel} onChangeText={setTextModel}
          autoCapitalize="none" autoCorrect={false} autoComplete="off"
          placeholder="provider/model" placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('profile.appSettings.ai.textModel')}
          style={{ minHeight: 48, color: colors.textPrimary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17 }}>
          {t('profile.appSettings.ai.textModelExample', { model: SUGGESTED_MODEL_ID })}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.ai.visionModel')}</Text>
        <TextInput value={visionModel} onChangeText={setVisionModel}
          autoCapitalize="none" autoCorrect={false} autoComplete="off"
          placeholder="provider/model" placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('profile.appSettings.ai.visionModel')}
          style={{ minHeight: 48, color: colors.textPrimary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17 }}>
          {t('profile.appSettings.ai.visionModelExample', { model: SUGGESTED_MODEL_ID })}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.ai.tutorPrompt')}</Text>
        <TextInput value={systemPrompt} onChangeText={setSystemPrompt} multiline maxLength={12000}
          textAlignVertical="top" autoCapitalize="sentences" autoCorrect
          accessibilityLabel={t('profile.appSettings.ai.tutorPrompt')}
          placeholderTextColor={colors.textTertiary}
          style={{ minHeight: 220, color: colors.textPrimary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, lineHeight: 20 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17 }}>
          {t('profile.appSettings.ai.tutorPromptHint')}
        </Text>
        <Button title={t('profile.appSettings.ai.restorePrompt')} onPress={() => setSystemPrompt(DEFAULT_TUTOR_PROMPT)} variant="outline" />
      </View>
      <Button title={t('profile.appSettings.ai.saveSettings')} onPress={() => void saveKey()} loading={busy} />
      <Button title={t('profile.appSettings.ai.testKey')} onPress={() => void testKey()} disabled={!apiKey.trim()} loading={busy} variant="outline" />
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://openrouter.ai/keys')}>
        <Text style={{ color: colors.primary, textDecorationLine: 'underline' }}>{t('profile.appSettings.ai.createKey')}</Text>
      </Pressable>
      <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17 }}>
        {t('profile.appSettings.ai.costNotice')}
      </Text>

    </SettingsSection>

    <SettingsSection title="Google Classroom" expanded={classroomExpanded} onToggle={() => setClassroomExpanded(value => !value)}>
      {Platform.OS !== 'android' && <SettingsDisclosure title="Guia para Web" expanded={classroomWebGuideExpanded} onToggle={() => setClassroomWebGuideExpanded(value => !value)}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          1. Ative a Google Classroom API e configure a tela de consentimento OAuth.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          2. Crie um cliente OAuth do tipo Aplicativo da Web.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          3. Em Origens JavaScript autorizadas, adicione http://localhost:8081 e a origem do site publicado.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          4. Copie o Client ID para o campo abaixo.
        </Text>
      </SettingsDisclosure>}
      {Platform.OS === 'android' && <SettingsDisclosure title="Guia para Android" expanded={classroomAndroidGuideExpanded} onToggle={() => setClassroomAndroidGuideExpanded(value => !value)}>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          1. Ative a Google Classroom API e configure a tela de consentimento OAuth.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          2. Crie um cliente OAuth do tipo Android.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          3. Informe o pacote com.ostudy.app e o SHA-1 da assinatura da versão instalada (debug, EAS ou Play).
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          Não ative “Esquema de URI personalizado”; no Android, a autorização retorna pelo SDK nativo.
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          SHA-1 da keystore EAS recém-gerada (para builds assinados com ela; a versão da Play pode usar outro):
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, flexShrink: 1, color: colors.textPrimary, fontSize: 13, lineHeight: 18 }}>
            9D:5B:1A:61:45:A4:...
          </Text>
          <Pressable
            onPress={() => void copyClassroomSha1('9D:5B:1A:61:45:A4:E9:AF:0A:B5:6B:46:CC:CE:42:12:32:22:21:FD')}
            accessibilityRole="button"
            accessibilityLabel="Copiar SHA-1"
            style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}
          >
            <Ionicons name={classroomSha1Copied ? 'checkmark' : 'copy-outline'} size={16} color={classroomSha1Copied ? colors.success : colors.textSecondary} />
            <Text style={{ color: classroomSha1Copied ? colors.success : colors.textPrimary, fontSize: 12, fontWeight: '600' }}>
              {classroomSha1Copied ? 'Copiado' : 'Copiar'}
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          4. Não é necessário colar o Client ID Android no OStudy; a autorização usa o SDK nativo.
        </Text>
      </SettingsDisclosure>}
      {Platform.OS !== 'android' && <>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Client ID</Text>
        <TextInput
          value={classroomClientId}
          onChangeText={setClassroomClientIdDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="1234567890-abc123.apps.googleusercontent.com"
          placeholderTextColor={colors.textTertiary}
          style={{ minHeight: 48, color: colors.textPrimary, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}
        />
        <Button title="Guardar Client ID" onPress={() => void saveClassroomClientId()} loading={busy} variant="outline" />
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://console.cloud.google.com/')}>
          <Text style={{ color: colors.primary, textDecorationLine: 'underline' }}>Abrir Google Cloud Console</Text>
        </Pressable>
      </>}
      {classroomExpired && (
        <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600' }}>
          Ligação ao Classroom expirou — reconectar
        </Text>
      )}
      {classroomError ? (
        <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, lineHeight: 18 }}>
          {classroomError}
        </Text>
      ) : null}
      {classroomConnected ? (
        <>
          {classroomAccountEmail && (
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              Conta conectada: {classroomAccountEmail}
            </Text>
          )}
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            Para ver as tarefas: abra um Space, toque em editar, escolha a turma em “Turma do Google Classroom” e guarde. A aba Classroom aparece dentro desse Space.
          </Text>
          <Button title="Reconectar / trocar conta Google" onPress={() => void handleClassroomConnect()} loading={busy} variant="outline" disabled={!classroomAuthReady} />
          <Button title="Desligar" onPress={() => void handleClassroomDisconnect()} loading={busy} variant="outline" />
        </>
      ) : (
        <Button title="Ligar ao Google Classroom" onPress={() => void handleClassroomConnect()} loading={busy} disabled={!classroomAuthReady} />
      )}
    </SettingsSection>

    <SettingsSection title={t('profile.appSettings.data.sectionTitle')} expanded={dataExpanded} onToggle={() => setDataExpanded(value => !value)}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 24 }}>
        <View style={{ padding: 16, gap: 12, borderRadius: 12, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{t('profile.appSettings.data.backupTitle')}</Text>
            <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: autoBackupEnabled ? colors.successSoft : colors.surfaceElevated }}>
              <Text style={{ color: autoBackupEnabled ? colors.success : colors.textTertiary, fontSize: 12, fontWeight: '600' }}>
                {autoBackupEnabled ? t('profile.appSettings.data.active') : t('profile.appSettings.data.inactive')}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
            {Platform.OS === 'web'
              ? t('profile.appSettings.data.backupDescriptionComputer')
              : t('profile.appSettings.data.backupDescriptionDevice')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, opacity: autoBackupEnabled ? 1 : 0.5 }}>
            {AUTO_BACKUP_INTERVALS.map(interval => (
              <Pressable key={interval} onPress={() => void changeAutomaticBackupInterval(interval)}
                disabled={!autoBackupEnabled || backupBusy}
                accessibilityRole="button" accessibilityState={{ selected: autoBackupInterval === interval, disabled: !autoBackupEnabled || backupBusy }}
                style={{
                  minHeight: 40,
                  justifyContent: 'center',
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: autoBackupInterval === interval ? colors.borderStrong : colors.border,
                  backgroundColor: autoBackupInterval === interval ? colors.border : 'transparent',
                  paddingHorizontal: 12,
                }}>
                <Text style={{ color: autoBackupInterval === interval ? colors.textPrimary : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                  {interval < 24
                    ? t('profile.appSettings.data.intervalHours', { count: interval })
                    : interval === 24 ? t('profile.appSettings.data.daily') : t('profile.appSettings.data.weekly')}
                </Text>
              </Pressable>
            ))}
          </View>
          {Platform.OS === 'web' && !supportsWebBackups && (
            <Text style={{ color: colors.warning, fontSize: 12 }}>{t('profile.appSettings.data.browserRequirement')}</Text>
          )}
          {!!autoBackupError && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{autoBackupError}</Text>}
          {autoBackupEnabled ? (
            <>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                {t('profile.appSettings.data.folderName', { folder: autoBackupFolderName || t('profile.appSettings.data.selectedFolder') })}
              </Text>
              {autoBackupLastAt && (
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {t('profile.appSettings.data.lastBackup', {
                    time: formatBackupTime(
                      autoBackupLastAt,
                      i18n.resolvedLanguage ?? i18n.language,
                      t('profile.appSettings.data.today'),
                      t('profile.appSettings.data.yesterday'),
                    ),
                  })}
                </Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable onPress={() => void backupNow()} disabled={backupBusy} accessibilityRole="button"
                      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated }}>
                  <Ionicons name="download-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.backupNow')}</Text>
                </Pressable>
                {Platform.OS === 'web' && (
                  <Pressable onPress={() => void enableAutomaticBackup()} disabled={backupBusy || !supportsWebBackups} accessibilityRole="button"
                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, opacity: backupBusy ? 0.5 : 1 }}>
                    <Ionicons name="folder-open-outline" size={18} color={colors.textSecondary} />
                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.changeFolder')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => void turnOffAutomaticBackup()} disabled={backupBusy} accessibilityRole="button"
                  style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated }}>
                  <Ionicons name="pause-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.deactivate')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => void enableAutomaticBackup()} disabled={backupBusy || !supportsWebBackups}
              cssInterop={false}
              accessibilityRole="button" accessibilityState={{ disabled: backupBusy || !supportsWebBackups }}
              style={({ pressed }) => ({
                minHeight: 40,
                borderRadius: 999,
                borderWidth: 0,
                borderColor: colors.textPrimary,
                paddingHorizontal: 18,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start',
                backgroundColor: colors.primaryStrong,
                opacity: backupBusy || !supportsWebBackups ? 0.5 : pressed ? 0.86 : 1,
              })}>
              <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '600' }}>
                {backupBusy
                  ? t('profile.appSettings.data.activating')
                  : Platform.OS === 'web' ? t('profile.appSettings.data.chooseFolderActivate') : t('profile.appSettings.data.activateBackup')}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ padding: 16, gap: 12, borderRadius: 12, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{t('profile.appSettings.data.yourData')}</Text>
          <DataActionButton
            title={t('profile.appSettings.data.exportTitle')}
            description={t('profile.appSettings.data.exportDescription')}
            icon="download-outline"
            onPress={() => void exportData()}
            disabled={busy}
          />
          <DataActionButton
            title={t('profile.appSettings.data.importTitle')}
            description={t('profile.appSettings.data.importDescription')}
            icon="enter-outline"
            onPress={() => void importData()}
            disabled={busy}
          />
          <View style={{ marginTop: 8 }}>
            <DataActionButton
              title={t('profile.appSettings.data.deleteAll')}
              icon="trash-outline"
              onPress={() => setDeleteConfirmationVisible(true)}
              disabled={busy}
              destructive
            />
          </View>
        </View>
      </View>
    </SettingsSection>
    <ConfirmModal
      visible={deleteConfirmationVisible}
      onClose={() => setDeleteConfirmationVisible(false)}
      onConfirm={clearData}
      variant="danger"
      title={t('profile.appSettings.data.deleteDialogTitle')}
      messages={[t('profile.appSettings.data.deleteDialogMessage')]}
      confirmLabel={t('profile.appSettings.data.deleteConfirm')}
      cancelLabel={t('common.cancel')}
      loading={busy}
      requireTypedConfirmation={t('profile.appSettings.data.deleteWord')}
      secondaryAction={{
        label: t('profile.appSettings.data.exportBefore'),
        onPress: () => {
          setDeleteConfirmationVisible(false);
          void exportData();
        },
      }}
    />
  </>;
}

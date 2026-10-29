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
import {
  APP_LIMIT_FIELDS,
  DEFAULT_APP_LIMITS,
  getAppLimits,
  parseAppLimitDraft,
  saveAppLimits,
  type AppLimits,
} from '../../services/appLimits';
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
  const [apiKey, setApiKeyDraft] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [textModel, setTextModel] = useState<string>(DEFAULT_TEXT_MODEL);
  const [visionModel, setVisionModel] = useState<string>(DEFAULT_VISION_MODEL);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_TUTOR_PROMPT);
  const [busy, setBusy] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [limitDraft, setLimitDraft] = useState<Record<keyof AppLimits, string>>(() =>
    Object.fromEntries(Object.entries(DEFAULT_APP_LIMITS).map(([key, value]) => [key, String(value)])) as Record<keyof AppLimits, string>,
  );
  const [dataExpanded, setDataExpanded] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState<AutoBackupIntervalHours>(24);
  const [autoBackupLastAt, setAutoBackupLastAt] = useState<string | null>(null);
  const [autoBackupError, setAutoBackupError] = useState('');
  const [autoBackupFolderName, setAutoBackupFolderName] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
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
      getAppLimits(),
    ]).then(([key, text, vision, prompt, limits]) => {
      if (!active) return;
      setApiKeyDraft(key || '');
      setTextModel(text);
      setVisionModel(vision);
      setSystemPrompt(normalizeEditableTutorPrompt(prompt) || DEFAULT_TUTOR_PROMPT);
      setLimitDraft(Object.fromEntries(Object.entries(limits).map(([name, value]) => [name, String(value)])) as Record<keyof AppLimits, string>);
    }).catch(error => showAppDialog(t('profile.appSettings.errors.open'), String(error), undefined, { variant: 'danger' }));
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
      await setSetting('ai.visionModel', visionModel);
      await setSetting('ai.systemPrompt', normalizeEditableTutorPrompt(systemPrompt.trim()) || DEFAULT_TUTOR_PROMPT);
      showAppDialog(t('profile.appSettings.dialogs.settingsSaved'), t('profile.appSettings.dialogs.keyStorage'), undefined, { variant: 'success' });
    } catch (error) {
        showAppDialog(t('profile.appSettings.errors.save'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const saveLimits = async () => {
    setBusy(true);
    try {
      const limits = parseAppLimitDraft(limitDraft);
      await saveAppLimits(limits);
      setLimitDraft(Object.fromEntries(Object.entries(limits).map(([name, value]) => [name, String(value)])) as Record<keyof AppLimits, string>);
      showAppDialog(t('profile.appSettings.dialogs.limitsSaved'), t('profile.appSettings.dialogs.limitsSavedMessage'), undefined, { variant: 'success' });
    } catch (error) {
      showAppDialog(t('profile.appSettings.errors.saveLimits'), error instanceof Error ? error.message : String(error), undefined, { variant: 'danger' });
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

  return <>
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

      <View style={{ height: 1, backgroundColor: colors.border, marginTop: 8 }} />
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>{t('profile.appSettings.limits.title')}</Text>
      <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
        {t('profile.appSettings.limits.description')}
      </Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 18 }}>{t('profile.appSettings.limits.hint')}</Text>
      {[...new Set(APP_LIMIT_FIELDS.map(field => field.group))].map(group => (
        <View key={group} style={{ gap: 10, marginTop: 8 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t(`profile.appSettings.limits.groups.${group}`, { defaultValue: group })}</Text>
          {APP_LIMIT_FIELDS.filter(field => field.group === group).map(field => (
            <View key={field.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, color: colors.textSecondary, lineHeight: 18 }}>
                {t(`profile.appSettings.limits.fields.${field.key}`, { defaultValue: field.label })} ({t(`profile.appSettings.limits.units.${field.unit}`, { defaultValue: field.unit })})
              </Text>
              <TextInput
                value={limitDraft[field.key]}
                onChangeText={value => setLimitDraft(current => ({ ...current, [field.key]: value }))}
                keyboardType="number-pad"
                selectTextOnFocus
                accessibilityLabel={t('profile.appSettings.limits.fieldAccessibility', {
                  field: t(`profile.appSettings.limits.fields.${field.key}`, { defaultValue: field.label }),
                  unit: t(`profile.appSettings.limits.units.${field.unit}`, { defaultValue: field.unit }),
                })}
                style={{ width: 96, minHeight: 44, color: colors.textPrimary, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, textAlign: 'right' }}
              />
            </View>
          ))}
        </View>
      ))}
      <Button title={t('profile.appSettings.limits.save')} onPress={() => void saveLimits()} loading={busy} />
      <Button
        title={t('profile.appSettings.limits.restore')}
        onPress={() => setLimitDraft(Object.fromEntries(Object.entries(DEFAULT_APP_LIMITS).map(([name, value]) => [name, String(value)])) as Record<keyof AppLimits, string>)}
        disabled={busy}
        variant="outline"
      />
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
                  borderColor: autoBackupInterval === interval ? colors.primary : colors.border,
                  backgroundColor: autoBackupInterval === interval ? colors.primarySoft : 'transparent',
                  paddingHorizontal: 12,
                }}>
                <Text style={{ color: autoBackupInterval === interval ? colors.primary : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
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
                      style={({ focused }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: focused ? 1 : 0, borderColor: colors.primary })}>
                  <Ionicons name="download-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.backupNow')}</Text>
                </Pressable>
                {Platform.OS === 'web' && (
                  <Pressable onPress={() => void enableAutomaticBackup()} disabled={backupBusy || !supportsWebBackups} accessibilityRole="button"
                    style={({ focused }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: focused ? 1 : 0, borderColor: colors.primary, opacity: backupBusy ? 0.5 : 1 })}>
                    <Ionicons name="folder-open-outline" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.changeFolder')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => void turnOffAutomaticBackup()} disabled={backupBusy} accessibilityRole="button"
                  style={({ focused }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, borderWidth: focused ? 1 : 0, borderColor: colors.primary })}>
                  <Ionicons name="pause-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('profile.appSettings.data.deactivate')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => void enableAutomaticBackup()} disabled={backupBusy || !supportsWebBackups}
              accessibilityRole="button" accessibilityState={{ disabled: backupBusy || !supportsWebBackups }}
              style={({ pressed, focused }) => ({
                minHeight: 40,
                borderRadius: 999,
                borderWidth: focused ? 2 : 0,
                borderColor: colors.textPrimary,
                paddingHorizontal: 18,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-start',
                backgroundColor: colors.primary,
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

        <View style={{ padding: 16, gap: 8, borderRadius: 12, backgroundColor: colors.surface }}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{t('profile.appSettings.data.yourData')}</Text>
          <Pressable onPress={() => void exportData()} disabled={busy} accessibilityRole="button"
            style={({ pressed, hovered, focused }) => ({
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 8,
              borderWidth: focused ? 1 : 0,
              borderColor: colors.primary,
              paddingHorizontal: 10,
              backgroundColor: pressed || hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
              opacity: busy ? 0.5 : 1,
            })}>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{t('profile.appSettings.data.exportTitle')}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('profile.appSettings.data.exportDescription')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable onPress={() => void importData()} disabled={busy} accessibilityRole="button"
            style={({ pressed, hovered, focused }) => ({
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 8,
              borderWidth: focused ? 1 : 0,
              borderColor: colors.primary,
              paddingHorizontal: 10,
              backgroundColor: pressed || hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
              opacity: busy ? 0.5 : 1,
            })}>
            <Ionicons name="enter-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{t('profile.appSettings.data.importTitle')}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('profile.appSettings.data.importDescription')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={{ padding: 16, paddingTop: 24, gap: 12, borderTopWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>{t('profile.appSettings.data.dangerZone')}</Text>
          <Pressable onPress={() => setDeleteConfirmationVisible(true)} disabled={busy} accessibilityRole="button"
            style={({ pressed, focused }) => ({
              minHeight: 44,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              borderWidth: focused ? 2 : 1,
              borderColor: colors.error,
              paddingHorizontal: 16,
              opacity: busy ? 0.5 : pressed ? 0.7 : 1,
            })}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>{t('profile.appSettings.data.deleteAll')}</Text>
          </Pressable>
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

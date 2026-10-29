import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSpaceStore, Space } from '../../stores/spaceStore';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { showAppDialog } from '../ui/AppDialog';
import { SPACE_COLOR_MAP, useThemeColors } from '../../constants/theme';

import { SPACE_ICONS } from '../../utils/spaceIcons';
import { SpaceIcon } from './SpaceIcon';

const ICONS = SPACE_ICONS;
const COLOR_KEYS = Object.keys(SPACE_COLOR_MAP);

interface SpaceFormProps {
  mode: 'create' | 'edit';
  initial?: Space;
  defaultParentId?: string | null;
}

export function SpaceForm({ mode, initial, defaultParentId = null }: SpaceFormProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { createSpace, updateSpace, deleteSpace, countDescendants } = useSpaceStore();

  const [name, setName] = useState(initial?.name || '');
  const [icon, setIcon] = useState(initial?.icon || ICONS[0]);
  const [color, setColor] = useState(initial?.color || 'blue');
  const [isFavorite, setIsFavorite] = useState(initial?.is_favorite || false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setName(initial?.name || '');
    setIcon(initial?.icon || ICONS[0]);
    setColor(initial?.color || 'blue');
    setIsFavorite(initial?.is_favorite || false);
  }, [initial]);

  const activeColorHex = SPACE_COLOR_MAP[color] || colors.primary;
  // No web o formulário é compactado para caber todo no modal, sem scroll.
  // No nativo (iOS/Android) mantém-se o layout original.
  const compact = Platform.OS === 'web';

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('spaces.form.errors.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'create') {
        await createSpace({
          name: name.trim(),
          parent_id: defaultParentId,
          icon,
          color,
          is_favorite: isFavorite,
        });
      } else if (initial) {
        await updateSpace(initial.id, {
          name: name.trim(),
          icon,
          color,
          is_favorite: isFavorite,
        });
      }
      router.back();
    }  finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!initial) return;
    const descendants = countDescendants(initial.id);
    const warning =
      descendants > 0
        ? t('spaces.form.deleteConfirm.withDescendants', { count: descendants })
        : t('spaces.form.deleteConfirm.noDescendants');

    showAppDialog(t('spaces.form.deleteConfirm.title'), warning, [
      { text: t('spaces.form.deleteConfirm.cancel'), style: 'cancel' },
      {
        text: t('spaces.form.deleteConfirm.confirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteSpace(initial.id);
            router.replace('/(app)/dashboard');
          } catch {
            setError(t('spaces.form.errors.deleteFailed'));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-border/50">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text className="text-base font-bold text-textPrimary">
          {mode === 'create' ? t('spaces.form.newSpaceTitle') : t('spaces.form.editSpaceTitle')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        className={compact ? 'flex-1 px-4' : 'flex-1 px-6'}
        contentContainerStyle={compact
          ? { paddingTop: 18, paddingBottom: 16, width: '100%', maxWidth: 520, alignSelf: 'center' }
          : { paddingVertical: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={error} />

        {/* Live Card Preview */}
        <View
          className={compact
            ? 'flex-row items-center justify-center gap-4 px-5 py-4 mb-5 bg-surface rounded-2xl border border-border shadow-sm'
            : 'items-center justify-center p-5 mb-6 bg-surface rounded-[18px] border border-border shadow-sm'}
        >
          <View
            className={compact
              ? 'w-12 h-12 rounded-xl items-center justify-center shadow-md'
              : 'w-16 h-16 rounded-2xl items-center justify-center mb-1 shadow-md'}
            style={{ backgroundColor: activeColorHex }}
          >
            <SpaceIcon name={icon} size={compact ? 24 : 32} color="#FFFFFF" />
          </View>
          <View style={compact ? { flexShrink: 1 } : undefined}>
            <Text
              className={compact
                ? 'text-lg font-bold text-textPrimary'
                : 'text-lg font-bold text-textPrimary text-center'}
              numberOfLines={1}
            >
              {name.trim() || t('spaces.form.namePlaceholderPreview')}
            </Text>

            {isFavorite && (
              <View className={compact
                ? 'flex-row items-center gap-1.5 mt-0.5'
                : 'flex-row items-center gap-1.5 mt-2 px-3 py-1'}
              >
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text className="text-xs font-semibold text-warning">{t('spaces.form.favoriteBadge')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Input: Nome */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className={compact
            ? 'text-xs font-bold text-textTertiary mb-2.5 uppercase tracking-wider text-center'
            : 'text-xs font-bold text-textTertiary mb-2 uppercase tracking-wider'}>
            {t('spaces.form.nameLabel')}
          </Text>
          <TextInput
            className={compact
              ? 'bg-surface rounded-lg px-4 py-3 text-textPrimary text-sm border border-border'
              : 'bg-surface rounded-lg px-4 py-3.5 text-textPrimary text-base border border-border'}
            placeholder={t('spaces.form.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={35}
          />
        </View>

      {/* Selector: Ícone (Centralizado) */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className={compact
              ? 'text-xs font-bold text-textTertiary mb-3 uppercase tracking-wider text-center'
              : 'text-xs font-bold text-textTertiary mb-3 uppercase tracking-wider text-center'}>
            {t('spaces.form.iconLabel')}
          </Text>
          <View
            className="rounded-2xl"
            style={{ backgroundColor: colors.background, padding: compact ? 6 : 12 }}
          >
            <ScrollView
              style={{ maxHeight: compact ? 120 : 240 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
            >
              <View
                className="flex-row flex-wrap justify-center items-center"
                style={{ padding: 4, gap: compact ? 5 : 12 }}
              >
                {ICONS.map((i) => {
                  const isSelected = icon === i;
                  return (
                    <TouchableOpacity
                      key={i}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={i.replace('subject:', '').replace(/-/g, ' ')}
                      onPress={() => setIcon(i)}
                      activeOpacity={0.7}
                      className={compact
                        ? 'rounded-lg items-center justify-center border'
                        : 'w-13 h-13 rounded-2xl items-center justify-center border'}
                      style={{
                        ...(compact ? { width: 28, height: 28 } : {}),
                        backgroundColor: isSelected ? activeColorHex : colors.surface,
                        borderColor: isSelected ? activeColorHex : 'rgba(0,0,0,0.05)',
                      }}
                    >
                      <SpaceIcon
                        name={i}
                        size={compact ? 16 : 22}
                        color={isSelected ? '#FFFFFF' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Selector: Cor (Centralizada) */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className={compact
              ? 'text-xs font-bold text-textTertiary mb-3 uppercase tracking-wider text-center'
              : 'text-xs font-bold text-textTertiary mb-3 uppercase tracking-wider text-center'}>
            {t('spaces.form.colorLabel')}
          </Text>
          <View
            className={compact
              ? 'flex-row flex-wrap justify-center items-center gap-3 px-3 py-3 rounded-2xl'
              : 'flex-row flex-wrap justify-center items-center gap-3 p-4 rounded-2xl'}
            style={{ backgroundColor: colors.surface }}
          >
            {COLOR_KEYS.map((c) => {
              const isSelected = color === c;
              const hex = SPACE_COLOR_MAP[c];
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  activeOpacity={0.8}
                  className={compact
                    ? 'w-7 h-7 rounded-full items-center justify-center'
                    : 'w-10 h-10 rounded-full items-center justify-center'}
                  style={{
                    backgroundColor: hex,
                    transform: [{ scale: isSelected ? 1.15 : 1 }],
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: colors.textPrimary,
                  }}
                >
                  {isSelected && <Ionicons name="checkmark" size={compact ? 14 : 18} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {/* Card: Favorito Toggle */}
        <TouchableOpacity
          activeOpacity={0.8}
          className={compact
            ? 'flex-row items-center justify-between bg-surface rounded-lg px-4 py-2.5 mb-5'
            : 'flex-row items-center justify-between bg-surface rounded-lg p-4 mb-8'}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <View className="flex-row items-center gap-3">
            <View
              className={compact ? 'w-8 h-8 rounded-xl items-center justify-center' : 'w-10 h-10 rounded-xl items-center justify-center'}
            >
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={compact ? 16 : 20}
                color={isFavorite ? colors.warning : colors.textTertiary}
              />
            </View>
            <View>
              <Text className={compact ? 'text-textPrimary font-semibold text-sm' : 'text-textPrimary font-semibold text-base'}>
                {t('spaces.form.favoriteToggleTitle')}
              </Text>
              <Text className="text-textTertiary text-xs">
                {t('spaces.form.favoriteToggleSubtitle')}
              </Text>
            </View>
          </View>

          <Ionicons
            name={isFavorite ? 'checkbox' : 'square-outline'}
            size={compact ? 20 : 24}
            color={isFavorite ? colors.warning : colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Botão Principal */}
        <Button
          title={mode === 'create' ? t('spaces.form.createButton') : t('spaces.form.saveButton')}
          onPress={handleSubmit}
          loading={loading}
          size={compact ? 'sm' : 'md'}
        />

        {/* Estado de preparação do Space: usa a chave common.preparingStudySpace,
            que existe agora em todos os dicionários (pt/en/es/fr/de/it) — nunca
            deve poder aparecer como texto literal da chave por falta de tradução. */}
        {mode === 'create' && loading && (
          <Text className="text-center text-textTertiary text-xs mt-3">
            {t('common.preparingStudySpace')}
          </Text>
        )}

        {/* Zona de Perigo (Editar / Apagar) */}
        {mode === 'edit' && (
          <View className="mt-8 pt-6 border-t border-border/40">
            <TouchableOpacity
              className="py-3.5 px-4 rounded-xl bg-error/10 border border-error/20 flex-row items-center justify-center gap-2"
              onPress={handleDelete}
              disabled={deleting}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error || '#EF4444'} />
              <Text className="text-error font-semibold text-sm">
                {deleting ? t('spaces.form.deletingButton') : t('spaces.form.deleteButton')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSpaceStore, Space } from '../../stores/spaceStore';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { showAppDialog } from '../ui/AppDialog';
import { SPACE_COLOR_MAP, useThemeColors } from '../../constants/theme';

import { SPACE_ICONS } from '../../utils/spaceIcons';
import { SpaceIcon } from './SpaceIcon';
import { hasClassroomConnection } from '../../services/classroom/auth';
import { listCourses } from '../../services/classroom/api';
import type { ClassroomCourse } from '../../services/classroom/api';

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
  const [googleClassroomCourseId, setGoogleClassroomCourseId] = useState(initial?.google_classroom_course_id || '');
  const [classroomCourses, setClassroomCourses] = useState<ClassroomCourse[]>([]);
  const [classroomCoursesLoading, setClassroomCoursesLoading] = useState(false);
  const [classroomCoursesError, setClassroomCoursesError] = useState('');
  const [isClassroomPanelOpen, setIsClassroomPanelOpen] = useState(true);
  const [isFavorite, setIsFavorite] = useState(initial?.is_favorite || false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setName(initial?.name || '');
    setIcon(initial?.icon || ICONS[0]);
    setColor(initial?.color || 'blue');
    setGoogleClassroomCourseId(initial?.google_classroom_course_id || '');
    setIsFavorite(initial?.is_favorite || false);
  }, [initial]);

  const loadClassroomCourses = useCallback(async (isActive: () => boolean = () => true) => {
    setClassroomCoursesLoading(true);
    setClassroomCoursesError('');
    try {
      const connected = await hasClassroomConnection();
      if (!isActive()) return;
      if (!connected) {
        setClassroomCourses([]);
        setClassroomCoursesError('O Google Classroom não está ligado. Liga-o nas definições do perfil e tenta novamente.');
        return;
      }

      const courses = await listCourses();
      if (isActive()) setClassroomCourses(courses);
    } catch (caught) {
      if (!isActive()) return;
      setClassroomCourses([]);
      setClassroomCoursesError(caught instanceof Error ? caught.message : 'Não foi possível carregar as turmas do Google Classroom.');
    } finally {
      if (isActive()) setClassroomCoursesLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadClassroomCourses(() => active);
    return () => { active = false; };
  }, [loadClassroomCourses]));

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
          google_classroom_course_id: googleClassroomCourseId || null,
          is_favorite: isFavorite,
        });
      } else if (initial) {
        await updateSpace(initial.id, {
          name: name.trim(),
          icon,
          color,
          google_classroom_course_id: googleClassroomCourseId || null,
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
            ? 'mb-5 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3'
            : 'mb-6 flex-row items-center justify-center gap-4 rounded-xl border border-border bg-surface px-4 py-4'}
        >
          <View
            className={compact ? 'h-10 w-10 items-center justify-center rounded-lg' : 'mb-1 h-14 w-14 items-center justify-center rounded-xl'}
            style={{ backgroundColor: activeColorHex }}
          >
            <SpaceIcon name={icon} size={compact ? 20 : 28} color="#FFFFFF" />
          </View>
          <View style={compact ? { flexShrink: 1 } : { alignItems: 'center' }}>
            <Text
              className={compact ? 'text-base font-semibold text-textPrimary' : 'text-lg font-semibold text-textPrimary'}
              numberOfLines={1}
            >
              {name.trim() || t('spaces.form.namePlaceholderPreview')}
            </Text>

            {isFavorite && (
              <View className={compact ? 'mt-1 flex-row items-center gap-1.5' : 'mt-2 flex-row items-center gap-1.5'}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text className="text-[10px] font-semibold uppercase tracking-[0.08em] text-warning">
                  {t('spaces.form.favoriteBadge')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Input: Nome */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-textTertiary">
            {t('spaces.form.nameLabel')}
          </Text>
          <TextInput
            className={compact
              ? 'rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-textPrimary'
              : 'rounded-lg border border-border bg-background px-4 py-3.5 text-base text-textPrimary'}
            placeholder={t('spaces.form.namePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={35}
          />
        </View>

        {/* Selector: Ícone */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-textTertiary">
            {t('spaces.form.iconLabel')}
          </Text>
          <View className="rounded-xl border border-border bg-surface p-2">
            <ScrollView
              style={{ maxHeight: compact ? 120 : 220 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
            >
              <View className="flex-row flex-wrap items-center justify-center" style={{ gap: compact ? 8 : 10 }}>
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
                      className={compact ? 'h-8 w-8 items-center justify-center rounded-lg border' : 'h-12 w-12 items-center justify-center rounded-xl border'}
                      style={{
                        backgroundColor: isSelected ? activeColorHex : colors.background,
                        borderColor: isSelected ? activeColorHex : colors.border,
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

        {/* Selector: Cor */}
        <View className={compact ? 'mb-5' : 'mb-6'}>
          <Text className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-textTertiary">
            {t('spaces.form.colorLabel')}
          </Text>
          <View
            className={compact ? 'flex-row flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-surface px-3 py-3' : 'flex-row flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-surface p-4'}
          >
            {COLOR_KEYS.map((c) => {
              const isSelected = color === c;
              const hex = SPACE_COLOR_MAP[c];
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  activeOpacity={0.8}
                  className={compact ? 'h-7 w-7 items-center justify-center rounded-full' : 'h-9 w-9 items-center justify-center rounded-full'}
                  style={{
                    backgroundColor: hex,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: colors.background,
                    transform: [{ scale: isSelected ? 1.08 : 1 }],
                  }}
                >
                  {isSelected && <Ionicons name="checkmark" size={compact ? 12 : 16} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Card: Favorito Toggle */}
        <TouchableOpacity
          activeOpacity={0.8}
          className={compact
            ? 'mb-5 flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3'
            : 'mb-8 flex-row items-center justify-between rounded-xl border border-border bg-surface p-4'}
          onPress={() => setIsFavorite(!isFavorite)}
        >
          <View className="flex-row items-center gap-3">
            <View className={compact ? 'h-8 w-8 items-center justify-center rounded-lg bg-background' : 'h-10 w-10 items-center justify-center rounded-xl bg-background'}>
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={compact ? 16 : 20}
                color={isFavorite ? colors.warning : colors.textTertiary}
              />
            </View>
            <View>
              <Text className={compact ? 'text-sm font-semibold text-textPrimary' : 'text-base font-semibold text-textPrimary'}>
                {t('spaces.form.favoriteToggleTitle')}
              </Text>
              <Text className="text-xs text-textTertiary">{t('spaces.form.favoriteToggleSubtitle')}</Text>
            </View>
          </View>

          <Ionicons
            name={isFavorite ? 'checkbox' : 'square-outline'}
            size={compact ? 20 : 24}
            color={isFavorite ? colors.warning : colors.textTertiary}
          />
        </TouchableOpacity>

        <View className={compact ? 'mb-5' : 'mb-6'}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsClassroomPanelOpen((prev) => !prev)}
            className="mb-3 flex-row items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-textTertiary">
              Turma do Google Classroom
            </Text>
            <Ionicons
              name={isClassroomPanelOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {isClassroomPanelOpen && (
            <>
              {classroomCoursesLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : classroomCoursesError ? (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                    {classroomCoursesError}
                  </Text>
                  {!classroomCoursesError.startsWith('O Google Classroom não está ligado') && (
                    <Button
                      title="Tentar carregar turmas novamente"
                      onPress={() => void loadClassroomCourses()}
                      variant="outline"
                      size="sm"
                    />
                  )}
                  {classroomCoursesError.startsWith('O Google Classroom não está ligado') && (
                    <Button
                      title="Abrir definições do perfil"
                      onPress={() => router.push('/(app)/profile')}
                      variant="outline"
                      size="sm"
                    />
                  )}
                </View>
              ) : classroomCourses.length > 0 ? (
                <View className="rounded-xl border border-border bg-surface p-2">
                  {googleClassroomCourseId ? (
                    <TouchableOpacity
                      onPress={() => setGoogleClassroomCourseId('')}
                      activeOpacity={0.8}
                      className="my-1 rounded-lg px-3 py-2"
                      style={{ backgroundColor: colors.background }}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Remover turma vinculada</Text>
                    </TouchableOpacity>
                  ) : null}
                  {classroomCourses.map((course) => {
                    const selected = course.id === googleClassroomCourseId;
                    return (
                      <TouchableOpacity
                        key={course.id}
                        onPress={() => setGoogleClassroomCourseId(selected ? '' : course.id)}
                        activeOpacity={0.8}
                        className="my-1 rounded-lg px-3 py-2.5"
                        style={{
                          backgroundColor: selected ? colors.primarySoft : colors.background,
                          borderWidth: selected ? 1 : 0,
                          borderColor: selected ? colors.primary : 'transparent',
                        }}
                      >
                        <Text style={{ color: selected ? colors.primary : colors.textPrimary, fontWeight: '600' }}>
                          {course.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-center text-xs text-textTertiary">
                  Não foram encontradas turmas ativas na conta Google ligada ao Classroom.
                </Text>
              )}
            </>
          )}
        </View>

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
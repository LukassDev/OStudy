import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../constants/theme';
import { listAnnouncements, listCourseWork, listCourses } from '../../services/classroom/api';
import type { ClassroomAnnouncement, ClassroomCourseWork } from '../../services/classroom/api';
import { getClassroomAccountEmail, hasClassroomConnection } from '../../services/classroom/auth';
import { getClassroomItemUrl, openClassroomItem } from '../classroom/classroomLinks';
import { type Space, useSpaceStore } from '../../stores/spaceStore';

type FeedItem = {
  id: string;
  courseId: string;
  courseName: string;
  kind: 'task' | 'announcement';
  title: string;
  description?: string;
  publishedAt?: string;
  dueDate?: ClassroomCourseWork['dueDate'];
  url?: string;
};

function getLinkedSpaces(spaces: Space[]): Map<string, string> {
  const linked = new Map<string, string>();
  const visit = (items: Space[]) => {
    for (const space of items) {
      if (space.google_classroom_course_id) {
        linked.set(space.google_classroom_course_id, space.name);
      }
      if (space.children?.length) visit(space.children);
    }
  };
  visit(spaces);
  return linked;
}

function formatShortDate(value?: string): string {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatDueDate(value?: ClassroomCourseWork['dueDate']): string {
  if (!value?.year || !value.month || !value.day) return 'Sem prazo';
  return new Date(value.year, value.month - 1, value.day)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function splitAnnouncement(text?: string): { title: string; description?: string } {
  const normalized = text?.trim()
    .replace(/^(?:INFORMAÇÃO|INFORMACAO|AVISO)\s*(?:\r?\n)+/i, '')
    .replace(/\s+/g, ' ');
  if (!normalized) return { title: 'Aviso da turma' };

  const sentenceEnd = normalized.search(/[.!?](?=\s|$)/);
  if (sentenceEnd >= 0) {
    const end = sentenceEnd + 1;
    return {
      title: normalized.slice(0, end),
      description: normalized.slice(end).trim() || undefined,
    };
  }

  const titleEnd = Math.min(normalized.length, 100);
  const wordBoundary = normalized.lastIndexOf(' ', titleEnd);
  const end = titleEnd === normalized.length ? titleEnd : wordBoundary > 0 ? wordBoundary : titleEnd;
  return {
    title: normalized.slice(0, end),
    description: normalized.slice(end).trim() || undefined,
  };
}

function toFeedItem(
  courseId: string,
  courseName: string,
  accountEmail: string,
  kind: FeedItem['kind'],
  item: ClassroomCourseWork | ClassroomAnnouncement,
): FeedItem {
  if (kind === 'task') {
    const task = item as ClassroomCourseWork;
    return {
      id: `${courseId}:task:${task.id}`,
      courseId,
      courseName,
      kind,
      title: task.title,
      description: task.description,
      publishedAt: task.creationTime,
      dueDate: task.dueDate,
      url: getClassroomItemUrl(task.alternateLink, accountEmail),
    };
  }

  const announcement = item as ClassroomAnnouncement;
  const content = splitAnnouncement(announcement.text);
  return {
    id: `${courseId}:announcement:${announcement.id}`,
    courseId,
    courseName,
    kind,
    ...content,
    publishedAt: announcement.creationTime,
    url: getClassroomItemUrl(announcement.alternateLink, accountEmail),
  };
}

export function ClassroomFeed() {
  const colors = useThemeColors();
  const spaces = useSpaceStore(state => state.spaces);
  const linkedSpaces = useMemo(() => getLinkedSpaces(spaces), [spaces]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [courseOptions, setCourseOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (selectedCourseId !== 'all' && !linkedSpaces.has(selectedCourseId)) {
      setSelectedCourseId('all');
    }
  }, [linkedSpaces, selectedCourseId]);

  useFocusEffect(useCallback(() => {
    let active = true;

    async function loadFeed() {
      setLoading(true);
      setError('');
      try {
        setCourseOptions(Array.from(linkedSpaces, ([id, name]) => ({ id, name })));
        if (linkedSpaces.size === 0) {
          if (active) setItems([]);
          return;
        }
        if (!await hasClassroomConnection()) {
          if (active) {
            setItems([]);
            setError('Ligue o Google Classroom nas definições do perfil para ver as notificações.');
          }
          return;
        }
        const accountEmail = await getClassroomAccountEmail();
        if (!accountEmail) {
          if (active) {
            setItems([]);
            setError('Reconecte o Google Classroom nas definições do perfil e escolha a conta usada nas turmas para abrir os links corretamente.');
          }
          return;
        }

        const [courses, ...courseResults] = await Promise.all([
          listCourses(),
          ...Array.from(linkedSpaces.keys(), async courseId => {
            const [tasks, announcements] = await Promise.all([
              listCourseWork(courseId),
              listAnnouncements(courseId),
            ]);
            return { courseId, tasks, announcements };
          }),
        ]);
        if (!active) return;

        const courseNames = new Map(courses.map(course => [course.id, course.name]));
        setCourseOptions(Array.from(linkedSpaces, ([id, fallbackName]) => ({
          id,
          name: courseNames.get(id) || fallbackName,
        })));
        const nextItems = courseResults.flatMap(({ courseId, tasks, announcements }) => {
          const courseName = courseNames.get(courseId) || linkedSpaces.get(courseId) || 'Turma do Classroom';
          return [
            ...tasks.map(task => toFeedItem(courseId, courseName, accountEmail, 'task', task)),
            ...announcements.map(announcement => toFeedItem(courseId, courseName, accountEmail, 'announcement', announcement)),
          ];
        });
        setItems(nextItems);
      } catch (caught) {
        if (active) {
          setItems([]);
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar as notificações do Classroom.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFeed();
    return () => { active = false; };
  }, [linkedSpaces]));

  const visibleItems = useMemo(
    () => items
      .filter(item => selectedCourseId === 'all' || item.courseId === selectedCourseId)
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : Number.NaN;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : Number.NaN;
        const aValid = Number.isFinite(aTime);
        const bValid = Number.isFinite(bTime);
        if (aValid !== bValid) return aValid ? -1 : 1;
        if (!aValid || !bValid) return a.id.localeCompare(b.id);
        return bTime - aTime;
      }),
    [items, selectedCourseId],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Classroom</Text>
          {!loading && (
            <View style={[styles.countBadge, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.countLabel, { color: colors.textSecondary }]}>{visibleItems.length}</Text>
            </View>
          )}
        </View>
      </View>

      {courseOptions.length > 1 && (
        <ScrollView
          horizontal
          style={styles.courseFilterScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.courseFilters}
        >
          {[{ id: 'all', name: 'Todas' }, ...courseOptions].map(course => {
            const selected = selectedCourseId === course.id;
            return (
              <Pressable
                key={course.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedCourseId(course.id)}
                style={[
                  styles.chip,
                  { borderColor: selected ? colors.borderStrong : colors.border },
                  selected && { backgroundColor: colors.border },
                ]}
              >
                <Text numberOfLines={1} style={[styles.chipText, { color: selected ? colors.textPrimary : colors.textSecondary }]}>{course.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={styles.feedContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.status} />
        ) : error ? (
          <Text accessibilityRole="alert" style={[styles.statusText, { color: colors.error }]}>{error}</Text>
        ) : visibleItems.length === 0 ? (
          <Text style={[styles.statusText, { color: colors.textTertiary }]}>
            {linkedSpaces.size === 0
              ? 'Vincule uma turma do Google Classroom a um Space para ver as notificações aqui.'
              : 'Não há notificações para os filtros selecionados.'}
          </Text>
        ) : visibleItems.map(item => (
          <Pressable
            key={item.id}
            accessibilityRole={item.url ? 'link' : undefined}
            accessibilityLabel={`${item.kind === 'task' ? 'Tarefa' : 'Aviso'}: ${item.title}`}
            disabled={!item.url}
            onPress={() => item.url && openClassroomItem(item.url)}
            style={({ pressed }) => [
              styles.item,
              { borderColor: colors.border },
              pressed && styles.itemPressed,
            ]}
          >
            <View style={styles.itemMetaRow}>
              <View style={styles.itemMetaGroup}>
                <Text numberOfLines={1} style={[styles.courseBadge, { color: colors.textSecondary, backgroundColor: colors.surfaceElevated }]}>
                  {item.courseName}
                </Text>
                <Text style={[styles.itemMeta, { color: colors.textTertiary }]}>·</Text>
                <Text style={[styles.itemMeta, { color: colors.textSecondary }]}>
                  {item.kind === 'task' ? 'Tarefa' : 'Aviso'}
                </Text>
              </View>
              <Text numberOfLines={1} style={[
                styles.itemDate,
                { color: item.kind === 'task' && item.dueDate ? colors.primary : colors.textTertiary },
              ]}>
                {item.kind === 'task'
                  ? `Prazo: ${formatDueDate(item.dueDate)}`
                  : formatShortDate(item.publishedAt)}
              </Text>
            </View>
            <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
            {item.description?.trim() ? (
              <Text numberOfLines={2} style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
            ) : null}
            {item.url && <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} style={styles.itemChevron} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 480, maxHeight: 680, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingBottom: 8, marginBottom: 28 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 16, letterSpacing: -0.2 },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countLabel: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9, maxWidth: 160 },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
  courseFilterScroll: { flexGrow: 0, flexShrink: 0, height: 38 },
  courseFilters: { alignItems: 'center', gap: 7, paddingRight: 4 },
  feedScroll: { flex: 1 },
  feedContent: { flexGrow: 1 },
  status: { paddingVertical: 16 },
  statusText: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  item: { minHeight: 92, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 11, paddingRight: 18, gap: 4, position: 'relative' },
  itemPressed: { opacity: 0.72 },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  itemMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  courseBadge: { maxWidth: 130, overflow: 'hidden', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontFamily: 'DMSans_500Medium', fontSize: 10 },
  itemMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 15 },
  itemDate: { maxWidth: 105, fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 15, textAlign: 'right' },
  itemTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, lineHeight: 18 },
  description: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  itemChevron: { position: 'absolute', right: 0, top: 43 },
});

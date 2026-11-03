import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { useSpaceStore } from '../../stores/spaceStore';
import { getClassroomAccountEmail, hasClassroomConnection } from '../../services/classroom/auth';
import { getClassroomItemUrl, openClassroomItem } from './classroomLinks';
import {
  listAnnouncements,
  listCourseWork,
  type ClassroomAnnouncement,
  type ClassroomCourseWork,
} from '../../services/classroom/api';

function formatDueDate(value?: { year?: number; month?: number; day?: number }): string {
  if (!value || !value.year || !value.month || !value.day) return 'Sem data';
  const date = new Date(value.year, value.month - 1, value.day);
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPostedDate(value?: string): string {
  if (!value) return 'Data de publicação indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data de publicação indisponível';
  return `Publicado em ${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

export function ClassroomTab({ spaceId }: { spaceId: string }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { findSpace } = useSpaceStore();
  const space = findSpace(spaceId);
  const courseId = space?.google_classroom_course_id ?? null;

  const [loading, setLoading] = useState(Boolean(courseId));
  const [assignments, setAssignments] = useState<ClassroomCourseWork[]>([]);
  const [accountEmail, setAccountEmail] = useState('');
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(() => new Set());
  const [announcements, setAnnouncements] = useState<ClassroomAnnouncement[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!courseId) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const connected = await hasClassroomConnection();
        if (!connected) {
          if (active) {
            setAssignments([]);
            setAccountEmail('');
            setAnnouncements([]);
            setError('Ligue o Google Classroom nas definições e vincule a turma deste Space.');
          }
          return;
        }

        const nextAccountEmail = await getClassroomAccountEmail();
        if (!nextAccountEmail) {
          throw new Error('Reconecte o Google Classroom nas definições do perfil e escolha a conta usada nas turmas para abrir os links corretamente.');
        }

        const [nextAssignments, nextAnnouncements] = await Promise.all([
          listCourseWork(courseId),
          listAnnouncements(courseId),
        ]);

        if (!active) return;
        setAssignments(nextAssignments);
        setAccountEmail(nextAccountEmail);
        setExpandedAssignments(new Set());
        setAnnouncements(nextAnnouncements);
      } catch (caught) {
        if (active) {
          setAssignments([]);
          setAccountEmail('');
          setAnnouncements([]);
          setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o Classroom.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => { active = false; };
  }, [courseId, t]);

  if (!space) {
    return <View style={styles.emptyState}><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Space não encontrado.</Text></View>;
  }

  if (!courseId) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="school-outline" size={28} color={colors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Google Classroom</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Para ver tarefas e avisos, edite este Space, escolha uma turma em “Turma do Google Classroom” e guarde. Depois, volte à aba Classroom.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="warning-outline" size={28} color={colors.warning} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Google Classroom</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{assignments.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Tarefas</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{announcements.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Avisos</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Próximas tarefas</Text>
        {assignments.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textTertiary }]}>Ainda não há tarefas sincronizadas para esta turma.</Text>
        ) : (
          assignments.map((assignment) => {
            const expanded = expandedAssignments.has(assignment.id);
            const url = getClassroomItemUrl(assignment.alternateLink, accountEmail);
            return (
              <View key={assignment.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedAssignments(current => {
                    const next = new Set(current);
                    if (next.has(assignment.id)) next.delete(assignment.id);
                    else next.add(assignment.id);
                    return next;
                  })}
                >
                  <View style={styles.assignmentHeading}>
                    <View style={styles.assignmentText}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{assignment.title}</Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {formatPostedDate(assignment.creationTime)}
                        {' · '}
                        {assignment.dueDate ? `Entrega: ${formatDueDate(assignment.dueDate)}` : 'Sem data de entrega'}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </View>
                  {expanded && (
                    <Text style={[styles.assignmentDescription, { color: colors.textSecondary }]}>
                      {assignment.description?.trim() || 'Esta tarefa não tem descrição adicional.'}
                    </Text>
                  )}
                </Pressable>
                {url && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => openClassroomItem(url)}
                    style={styles.openButton}
                  >
                    <Text style={[styles.openButtonText, { color: colors.primary }]}>Abrir tarefa</Text>
                    <Ionicons name="open-outline" size={15} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Avisos</Text>
        {announcements.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textTertiary }]}>Ainda não há avisos públicos desta turma.</Text>
        ) : (
          announcements.map((announcement) => {
            const url = getClassroomItemUrl(announcement.alternateLink, accountEmail);
            return (
              <View key={announcement.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{formatPostedDate(announcement.creationTime)}</Text>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{announcement.text || 'Aviso da turma'}</Text>
                {url && (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => openClassroomItem(url)}
                    style={styles.openButton}
                  >
                    <Text style={[styles.openButtonText, { color: colors.primary }]}>Abrir aviso</Text>
                    <Ionicons name="open-outline" size={15} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  summaryTile: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  summaryLabel: { fontSize: 12, marginTop: 4 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  openButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 6 },
  openButtonText: { fontSize: 13, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  cardMeta: { fontSize: 12 },
  assignmentHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assignmentText: { flex: 1, gap: 4 },
  assignmentDescription: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  muted: { fontSize: 13, lineHeight: 18 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

import { SpaceGrid } from '../../src/components/dashboard/SpaceGrid';
import { StudyCards } from '../../src/components/dashboard/StudyCards';
import { ClassroomFeed } from '../../src/components/dashboard/ClassroomFeed';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { guardedPush } from '../../src/utils/navigation';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../src/stores/profileStore';
import { useSpaceStore } from '../../src/stores/spaceStore';
import { useUiStore } from '../../src/stores/uiStore';
import { Avatar } from '../../src/components/ui/Avatar';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { useThemeColors } from '../../src/constants/theme';
import { getGreeting } from '../../src/utils/greetings';
import { matchesSearchText } from '../../src/utils/search';
import { showAppDialog } from '../../src/components/ui/AppDialog';

function countAllSpaces(spaces: ReturnType<typeof useSpaceStore.getState>['spaces']): number {
  let count = 0;
  const walk = (nodes: typeof spaces) => {
    for (const n of nodes) { count += 1; if (n.children) walk(n.children); }
  };
  walk(spaces);
  return count;
}

// Métricas simples: sem card nem fundo, apenas número e rótulo.
function MetricStat({
  icon, value, label, colors,
}: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; colors: any }) {
  return (
    <View style={styles.metricStat}>
      <Ionicons name={icon} size={15} color={colors.textSecondary} style={{ marginBottom: 2 }} />
      <View style={styles.metricTextRow}>
        <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}> {label}</Text>
      </View>
    </View>
  );
}

function SectionTitle({
  title, action, onAction, colors,
}: { title: string; action?: string; onAction?: () => void; colors: any }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Dashboard() {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const { name } = useProfileStore();
  const { spaces, fetchSpaces } = useSpaceStore();
  const [search, setSearch] = useState('');
  const [draggingSpace, setDraggingSpace] = useState(false);
  const editingSpaces = useUiStore((state) => state.editingSpaces);
  const [editorSpaces, setEditorSpaces] = useState(spaces);
  const draftOrder = useRef<string[] | null>(null);
  useEffect(() => () => { useUiStore.setState({ editingSpaces: false }); }, []);
  const closeSpaceEditor = () => {
    if (draggingSpace) return;
    useUiStore.setState({ editingSpaces: false });
    const draft = draftOrder.current;
    draftOrder.current = null;
    if (!draft) return;
    const current = useSpaceStore.getState().spaces;
    const existing = new Set(current.map(space => space.id));
    const visible = new Set(draft);
    const ordered = draft.filter(id => existing.has(id));
    let index = 0;
    const ids = current.map(space => visible.has(space.id) ? ordered[index++] : space.id);
    if (ids.every((id, i) => id === current[i].id)) return;
    void useSpaceStore.getState().reorderSpaces(ids).catch(error => showAppDialog(t('update15.error'), String(error)));
  };

  // Saudação sorteada uma única vez por montagem do dashboard (não a cada
  // render), para não "saltar" de frase enquanto o utilizador está a ler.
  // Recalcula se o idioma mudar (ex.: o utilizador troca o idioma no Perfil
  // e volta ao dashboard), para não ficar preso na língua anterior.
  const greetingRef = useRef(getGreeting());
  useEffect(() => {
    greetingRef.current = getGreeting();
  }, [i18n.language]);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const filteredSpaces = useMemo(() => {
    if (!search.trim()) return spaces;
    return spaces.filter((s) => matchesSearchText([s.name], search));
  }, [search, spaces]);

  const totalSpaces = countAllSpaces(spaces);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        scrollEnabled={!editingSpaces}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={[styles.headerGreeting, { color: colors.textPrimary }]}>
              {greetingRef.current}{' '}{name || t('dashboard.defaultStudentName')}.
            </Text>
          </View>
          <TouchableOpacity onPress={() => guardedPush('/(app)/profile')} activeOpacity={0.85} style={{ marginRight: 4 }}>
            <Avatar name={name || 'OStudy'} size={52} />
          </TouchableOpacity>
        </View>

        {/* Faixa de métricas simples, sem competir com os cards abaixo. */}
        <View style={styles.metricsRow}>
          <MetricStat icon="folder-outline" value={String(totalSpaces)} label={t('dashboard.stats.spaces')} colors={colors} />
        </View>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t('dashboard.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoComplete="off"
            textContentType="none"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginBottom: 28, gap: 16 }}>
          <StudyCards />
        </View>

        <SectionTitle
          title={t('dashboard.sections.yourSpaces')}
          action={spaces.length > 0 ? t('dashboard.sections.createNew') : undefined}
          onAction={() => guardedPush('/(app)/spaces/new')}
          colors={colors}
        />
        {spaces.length > 1 && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setEditorSpaces(useSpaceStore.getState().spaces);
              draftOrder.current = null;
              useUiStore.setState({ editingSpaces: true, sidebarOpen: false });
            }}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 8 }}
          >
            <Ionicons name="move-outline" size={17} color={colors.primary} />
            <Text style={[styles.sectionAction, { color: colors.primary }]}>{t('studyVisual.editSpaces')}</Text>
          </TouchableOpacity>
        )}
        {filteredSpaces.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="folder-open-outline"
              title={t('dashboard.emptySpaces.title')}
              subtitle={t('dashboard.emptySpaces.subtitle')}
              actionLabel={t('dashboard.emptySpaces.action')}
              onAction={() => guardedPush('/(app)/spaces/new')}
            />
          </View>
        ) : (
          <SpaceGrid spaces={filteredSpaces} onDragging={setDraggingSpace} />
        )}

        <ClassroomFeed />

      </ScrollView>
      <Modal visible={editingSpaces} animationType="slide" onRequestClose={closeSpaceEditor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, width: '100%', maxWidth: 1200, alignSelf: 'center' }}>
            <View style={{ padding: 20, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, flex: 1 }]}>{t('studyVisual.editSpaces')}</Text>
                <TouchableOpacity accessibilityRole="button" disabled={draggingSpace} onPress={closeSpaceEditor}
                  style={{ padding: 12, borderRadius: 20, backgroundColor: colors.primaryStrong, opacity: draggingSpace ? 0.5 : 1 }}>
                  <Text style={[styles.sectionAction, { color: colors.primaryText }]}>{t('studyVisual.finishEditing')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 13 }}>{t('studyVisual.dragSpacesHint')}</Text>
            </View>
            <ScrollView scrollEnabled={!draggingSpace} bounces={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              {editingSpaces && <SpaceGrid spaces={editorSpaces} editing onDragging={setDraggingSpace} onReorder={ids => { draftOrder.current = ids; }} />}
            </ScrollView>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 12 : 64,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 32,
    paddingRight: 4,
  },
  headerDate: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  headerGreeting: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 34,
  },

  // Métricas: sem card, sem fundo — só número + rótulo, com um traço fino
  // a separar. O peso visual fica reservado para os cards de conteúdo.
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 32,
  },
  metricStat: {
    alignItems: 'flex-start',
  },
  metricTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    marginLeft: 10,
    height: '100%',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.6,
  },
  sectionAction: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  spacesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  spaceCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
  },
  spaceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  spaceName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  spaceSub: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  emptyContainer: {
    marginBottom: 28,
  },
});

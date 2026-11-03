import React, { ReactNode, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';
import { useContentStore } from '../../stores/contentStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { useGradesStore } from '../../stores/gradesStore';
import { useResourcesStore } from '../../stores/resourcesStore';
import { Button } from '../ui/Button';

type Tab = 'chats' | 'conteudo' | 'calendario' | 'avaliacoes' | 'recursos' | 'classroom';

export function SpaceDataGate({ spaceId, tab, children }: {
  spaceId: string; tab: Tab; children: ReactNode;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const chats = useChatStore();
  const content = useContentStore();
  const calendar = useCalendarStore();
  const grades = useGradesStore();
  const resources = useResourcesStore();
  const states = { chats, conteudo: content, calendario: calendar, avaliacoes: grades, recursos: resources, classroom: null as any };
  const fetchers = { chats: chats.fetchChats, conteudo: content.fetchTopics,
    calendario: calendar.fetchEvents, avaliacoes: grades.fetchGrades, recursos: resources.fetchResources,
    classroom: async () => undefined };
  const isClassroomTab = tab === 'classroom';
  const fetchData = isClassroomTab ? async () => undefined : fetchers[tab];

  // Runs on focus and when the active tab/Space changes; no duplicate mount fetch.
  useFocusEffect(useCallback(() => { void fetchData(spaceId); }, [fetchData, spaceId]));

  const state = isClassroomTab ? null : states[tab];
  // Background synchronization must not hide the mounted tab or block touches.
  const ready = isClassroomTab || state?.loadedSpaceId === spaceId;

  return (
    <View style={styles.fill}>
      <View style={[styles.fill, !ready && styles.hidden]} pointerEvents={ready ? 'auto' : 'none'}
        accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}>
        {children}
      </View>
      {!isClassroomTab && !ready && state && <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>
        {state.loading ? <ActivityIndicator color={colors.primary} size="large" />
          : <Button title={t('common.retry')} onPress={() => void fetchData(spaceId)} />}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, hidden: { opacity: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
});

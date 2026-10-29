import React, { ReactNode, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { useChatStore } from '../../stores/chatStore';
import { usePlanStore } from '../../stores/planStore';
import { useContentStore } from '../../stores/contentStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { useGradesStore } from '../../stores/gradesStore';
import { useResourcesStore } from '../../stores/resourcesStore';
import { Button } from '../ui/Button';

type Tab = 'chats' | 'plano' | 'conteudo' | 'calendario' | 'avaliacoes' | 'recursos';

export function SpaceDataGate({ spaceId, tab, children }: {
  spaceId: string; tab: Tab; children: ReactNode;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const chats = useChatStore();
  const plan = usePlanStore();
  const content = useContentStore();
  const calendar = useCalendarStore();
  const grades = useGradesStore();
  const resources = useResourcesStore();
  const states = { chats, plano: plan, conteudo: content, calendario: calendar, avaliacoes: grades, recursos: resources };
  const fetchers = { chats: chats.fetchChats, plano: plan.fetchPlan, conteudo: content.fetchTopics,
    calendario: calendar.fetchEvents, avaliacoes: grades.fetchGrades, recursos: resources.fetchResources };
  const fetchData = fetchers[tab];

  // Runs on focus and when the active tab/Space changes; no duplicate mount fetch.
  useFocusEffect(useCallback(() => { void fetchData(spaceId); }, [fetchData, spaceId]));

  const state = states[tab];
  // Background synchronization must not hide the mounted tab or block touches.
  const ready = state.loadedSpaceId === spaceId;

  return (
    <View style={styles.fill}>
      <View style={[styles.fill, !ready && styles.hidden]} pointerEvents={ready ? 'auto' : 'none'}
        accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}>
        {children}
      </View>
      {!ready && <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>
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

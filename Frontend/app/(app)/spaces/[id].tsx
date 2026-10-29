import { SpaceIcon } from '../../../src/components/spaces/SpaceIcon';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  PanResponder,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { guardedPush } from '../../../src/utils/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSpaceStore } from '../../../src/stores/spaceStore';
import { useUiStore } from '../../../src/stores/uiStore';
import { ChatList } from '../../../src/components/ChatList';
import { SpaceDataGate } from '../../../src/components/spaces/SpaceDataGate';
import { ContentTab } from '../../../src/components/content/ContentTab';
import { CalendarTab } from '../../../src/components/calendar/CalendarTab';
import { GradesTab } from '../../../src/components/grades/GradesTab';
import { ResourcesTab } from '../../../src/components/resources/ResourcesTab';
import { useSpaceColorMap, useThemeColors } from '../../../src/constants/theme';

import {
  getSwipedTab,
  isHorizontalSwipe,
  SpaceTab as Tab,
} from '../../../src/utils/swipeNavigation';

function getTabs(t: (key: string) => string): { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] {
  return [
    { key: 'chats', label: t('spaces.tabs.chats'), icon: 'chatbubbles-outline' },
    { key: 'plano', label: t('spaces.tabs.plan'), icon: 'rocket-outline' },
    { key: 'conteudo', label: t('spaces.tabs.content'), icon: 'book-outline' },
    { key: 'calendario', label: t('spaces.tabs.calendar'), icon: 'calendar-outline' },
    { key: 'avaliacoes', label: t('spaces.tabs.grades'), icon: 'stats-chart-outline' },
    { key: 'recursos', label: t('spaces.tabs.resources'), icon: 'folder-open-outline' },
  ];
}

export default function SpaceScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { spaces, fetchSpaces, findSpace, getBreadcrumb } = useSpaceStore();
  const SPACE_COLOR_MAP = useSpaceColorMap();
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const tabsScroll = useRef<ScrollView>(null);
  const tabPositions = useRef<Partial<Record<Tab, number>>>({});
  const tabs = getTabs(t);

  useEffect(() => {
    tabsScroll.current?.scrollTo({
      x: Math.max(0, (tabPositions.current[activeTab] || 0) - 20),
      animated: true,
    });
  }, [activeTab]);

  useEffect(() => {
    setActiveTab('chats');
  }, [id]);

  const swipe = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      !useUiStore.getState().editingResources &&
      isHorizontalSwipe(gesture.dx, gesture.dy, gesture.numberActiveTouches),
    onPanResponderRelease: (_, gesture) => {
      setActiveTab((current) => getSwipedTab(current, gesture.dx));
    },
  });

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces();
  }, [spaces.length, fetchSpaces]);

  const space = id ? findSpace(id) : null;
  const breadcrumb = space ? getBreadcrumb(id) : [];

  if (!space) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const tint = SPACE_COLOR_MAP[space.color] || colors.primary;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chats':
        return (
          <SpaceDataGate spaceId={id} tab="chats">
            <ChatList spaceId={id} readOnly={false} />
          </SpaceDataGate>
        );
      case 'plano':
        return (
          <View style={styles.emptyTab}>
            <Text style={[styles.emptyTabTitle, { color: colors.textPrimary }]}>Em breve</Text>
            <Text style={[styles.emptyTabSubtitle, { color: colors.textSecondary }]}>
              A funcionalidade de plano ainda não está disponível.
            </Text>
          </View>
        );
      case 'conteudo':
        return (
          <SpaceDataGate spaceId={id} tab="conteudo">
            <ContentTab spaceId={id} readOnly={false} />
          </SpaceDataGate>
        );
      case 'calendario':
        return (
          <SpaceDataGate spaceId={id} tab="calendario">
            <CalendarTab spaceId={id} readOnly={false} />
          </SpaceDataGate>
        );
      case 'avaliacoes':
        return (
          <SpaceDataGate spaceId={id} tab="avaliacoes">
            <GradesTab spaceId={id} readOnly={false} />
          </SpaceDataGate>
        );
      case 'recursos':
        return (
          <SpaceDataGate spaceId={id} tab="recursos">
            <ResourcesTab spaceId={id} readOnly={false} />
          </SpaceDataGate>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
            minHeight: 72,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
            borderBottomWidth: 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            const parent = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;
            router.dismissTo(parent ? `/(app)/spaces/${parent.id}` : '/(app)/dashboard');
          }}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          {breadcrumb.length > 1 && (
            <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]} numberOfLines={1}>
              {breadcrumb.slice(0, -1).map((s) => s.name).join(' › ')}
            </Text>
          )}
          <View style={styles.spaceTitleRow}>
            <View style={[styles.spaceIconBadge, { backgroundColor: tint }]}>
              <SpaceIcon name={space.icon || 'folder-outline'} size={16} color="#FFFFFF" />
            </View>
            <Text
              style={[
                styles.spaceTitle,
                { color: colors.textPrimary },
                {
                  minWidth: 0,
                  fontSize: Platform.OS === 'web' ? 28 : 24,
                  lineHeight: 32,
                },
              ]}
              numberOfLines={1}
            >
              {space.name}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => guardedPush(`/(app)/spaces/edit/${id}`)}
          hitSlop={8}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabsScrollWrapper, { borderBottomColor: colors.border }]}>
        <ScrollView
          ref={tabsScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsContainer, Platform.OS === 'web' && styles.webTabsContainer]}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onLayout={(event) => {
                  tabPositions.current[tab.key] = event.nativeEvent.layout.x;
                }}
                style={[
                  styles.tabItem,
                  Platform.OS === 'web' && styles.webTabItem,
                  { backgroundColor: 'transparent' },
                  isActive && { backgroundColor: 'transparent', borderBottomColor: colors.primary },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: colors.textSecondary },
                    isActive && { fontFamily: 'DMSans_700Bold', color: colors.primary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View {...swipe.panHandlers} style={styles.contentArea}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  breadcrumbText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    marginBottom: 2,
  },
  spaceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  spaceTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.6,
    flex: 1,
  },
  tabsScrollWrapper: {
    borderBottomWidth: 1.5,
  },
  tabsContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  webTabsContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  webTabItem: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tabLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    marginLeft: 6,
  },
  contentArea: {
    flex: 1,
  },
  emptyTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTabTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    marginBottom: 8,
  },
  emptyTabSubtitle: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    textAlign: 'center',
  },
});

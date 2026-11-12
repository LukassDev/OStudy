import { SpaceIcon } from '../spaces/SpaceIcon';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, type Href } from 'expo-router';
import { guardedPush } from '../../utils/navigation';
import { useTranslation } from 'react-i18next';
import { useSpaceStore } from '../../stores/spaceStore';
import { useUiStore } from '../../stores/uiStore';
import { SpaceTree } from './SpaceTree';
import { useSpaceColorMap, useThemeColors } from '../../constants/theme';
import { matchesSearchText } from '../../utils/search';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Header de secção reutilizável — colapsável, com contador e chevron animado
function SectionHeader({
  label,
  count,
  expanded,
  onToggle,
}: {
  label: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.6}
      className="flex-row items-center justify-between px-4 py-2"
      hitSlop={{ top: 4, bottom: 4 }}
    >
      <View className="flex-row items-center">
        <Text className="text-[11px] font-bold text-textTertiary uppercase tracking-wide">
          {label}
        </Text>
        {typeof count === 'number' && (
          <Text className="text-[11px] font-medium text-textTertiary ml-1.5 opacity-60">
            {count}
          </Text>
        )}
      </View>
      <Ionicons
        name="chevron-down"
        size={15}
        color={colors.textTertiary}
        style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}
      />
    </TouchableOpacity>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const currentPath = pathname.replace(/^\/\(app\)/, '');
  const selectedSpaceId = currentPath.match(/^\/spaces\/([^/]+)\/?$/)?.[1] ?? null;
  const homeSelected = currentPath === '/dashboard';
  const { t } = useTranslation();
  const { spaces, loading, expandedIds, toggleExpand, fetchSpaces, getFavorites } =
    useSpaceStore();
  const colors = useThemeColors();
  const closeSidebar = useUiStore(state => state.closeSidebar);
  const palette = useSpaceColorMap();
  const [search, setSearch] = useState('');

  // Estado de colapso por secção
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(true);

  const toggleSection = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((prev) => !prev);
  };

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const filteredSpaces = useMemo(() => {
    if (!search.trim()) return spaces;
    const filter = (nodes: typeof spaces): typeof spaces =>
      nodes
        .map((node) => ({ ...node, children: node.children ? filter(node.children) : [] }))
        .filter(
          (node) =>
            matchesSearchText([node.name], search) ||
            (node.children && node.children.length > 0)
        );
    return filter(spaces);
  }, [search, spaces]);

  const favorites = useMemo(
    () => (search.trim() ? [] : getFavorites()),
    [search, getFavorites]
  );

  const handleNavigate = (href: Href) => {
    if (typeof href !== 'string' || href.replace(/^\/\(app\)/, '') !== currentPath) {
      guardedPush(href);
    }
    closeSidebar();
    onNavigate?.();
  };
  const handleSelectSpace = (id: string) => handleNavigate(`/(app)/spaces/${id}`);

  return (
    <>
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-4 ml-2 ">
          <Text className="text-lg font-bold text-textPrimary">{t('sidebar.appName')}</Text>
        </View>

        <View className="flex-row items-center rounded-2xl px-3" style={{ backgroundColor: colors.surfaceElevated }}>
          <Ionicons name="search" size={19} color={colors.textTertiary} />
          <TextInput
            className="flex-1 py-2.5 ml-2 text-textPrimary text-sm"
            placeholder={t('sidebar.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: homeSelected }} onPress={() => handleNavigate('/(app)/dashboard')} className="px-4 py-3 flex-row items-center">
          <Ionicons name="home-outline" size={21} color={colors.textSecondary} />
          <Text className="ml-3 font-semibold" style={{ color: colors.textPrimary }}>{t('sidebar.home', { defaultValue: 'Home' })}</Text>
        </TouchableOpacity>
        {(['agenda', 'grades'] as const).map(route => {
          const selected = currentPath === `/${route}`;
          return (
            <TouchableOpacity key={route} accessibilityRole="button" accessibilityState={{ selected }}
              onPress={() => handleNavigate('/(app)/' + route as '/(app)/agenda' | '/(app)/grades')}
              className="px-4 py-3 flex-row items-center">
              <Ionicons name={route === 'agenda' ? 'calendar-outline' : 'school-outline'} size={21} color={colors.textSecondary} />
              <Text className="ml-3 font-semibold" style={{ color: colors.textPrimary }}>{t('update15.' + route)}</Text>
            </TouchableOpacity>
          );
        })}
        {favorites.length > 0 && (
          <View className="mb-1">
            <SectionHeader
              label={t('sidebar.sections.favorites')}
              count={favorites.length}
              expanded={favoritesOpen}
              onToggle={() => toggleSection(setFavoritesOpen)}
            />
            {favoritesOpen &&
              favorites.map((space) => {
                const selected = selectedSpaceId === space.id;
                return (
                  <TouchableOpacity
                    key={space.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className="flex-row items-center py-2.5 px-4"
                    onPress={() => handleSelectSpace(space.id)}
                  >
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                      style={{ backgroundColor: colors.iconSurface }}
                    >
                      <SpaceIcon
                        name={space.icon || 'folder-outline'}
                        size={16}
                        color={palette[space.color] || colors.textSecondary}
                      />
                    </View>
                    <Text className="text-sm flex-1" numberOfLines={1} style={{ color: colors.textPrimary }}>
                      {space.name}
                    </Text>
                    <Ionicons name="star" size={16} color={colors.warning} />
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        <SectionHeader
          label={t('sidebar.sections.spaces')}
          count={!loading ? filteredSpaces.length : undefined}
          expanded={spacesOpen}
          onToggle={() => toggleSection(setSpacesOpen)}
        />
        {spacesOpen && (
          loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : filteredSpaces.length === 0 ? (
            <View className="py-8 items-center px-6">
              <Ionicons name="folder-open-outline" size={36} color={colors.textTertiary} />
              <Text className="text-textSecondary text-sm mt-2 text-center">
                {search ? t('sidebar.noResults') : t('sidebar.createFirstSpace')}
              </Text>
            </View>
          ) : (
            filteredSpaces.map((space) => (
              <SpaceTree
                key={space.id}
                space={space}
                level={0}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onSelectSpace={handleSelectSpace}
                selectedSpaceId={selectedSpaceId}
              />
            ))
          )
        )}
      </ScrollView>

    </SafeAreaView>
    </>
  );
}

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
import { OrenLogo } from '../common/OrenLogo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Href, usePathname } from 'expo-router';
import { guardedPush } from '../../utils/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useSpaceStore } from '../../stores/spaceStore';
import { useProfileStore } from '../../stores/profileStore';
import { useChatStore } from '../../stores/chatStore';
import { SpaceTree } from './SpaceTree';
import { Avatar } from '../ui/Avatar';
import { useThemeColors, useSpaceColorMap } from '../../constants/theme';
import { useDateFnsLocale } from '../../i18n/dateFnsLocale';
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

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { spaces, loading, expandedIds, toggleExpand, fetchSpaces, getFavorites } =
    useSpaceStore();
  const { recentChats, fetchRecentChats, searchChats } = useChatStore();
  const { name } = useProfileStore();
  const colors = useThemeColors();
  const SPACE_COLOR_MAP = useSpaceColorMap();
  const [search, setSearch] = useState('');
  const [searchedChats, setSearchedChats] = useState<typeof recentChats>([]);

  // Estado de colapso por secção
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(false);

  const toggleSection = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((prev) => !prev);
  };

  useEffect(() => {
    fetchSpaces();
    fetchRecentChats(5);
  }, [fetchSpaces, fetchRecentChats]);

  useEffect(() => {
    let cancelled = false;
    if (!search.trim()) {
      setSearchedChats([]);
      return () => { cancelled = true; };
    }

    const timeout = setTimeout(() => {
      searchChats(search).then((results) => {
        if (!cancelled) setSearchedChats(results);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [search, searchChats]);

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
  const visibleChats = search.trim() ? searchedChats : recentChats;
  const showRecents = visibleChats.length > 0;

  const handleSelectSpace = (id: string) => guardedPush(`/(app)/spaces/${id}`);
  const handleNewSpace = () => guardedPush('/(app)/spaces/new');

  return (
    <>
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.surface }}>
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center justify-between mb-4 ml-2 ">
          <View className="flex-row items-center">
            <View
              className="w-8 h-8 rounded-xl border items-center justify-center mr-2"
              style={{ backgroundColor: colors.surfaceElevated, borderColor: colors.border }}
            >
              <OrenLogo size={40} />
            </View>
            <Text className="text-lg font-bold text-textPrimary">{t('sidebar.appName')}</Text>
          </View>
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
        <TouchableOpacity accessibilityRole="button" onPress={() => { if (pathname !== '/dashboard' && pathname !== '/(app)/dashboard') guardedPush('/(app)/dashboard'); }} className="px-4 py-3 flex-row items-center">
          <Ionicons name="home-outline" size={21} color={colors.primary} />
          <Text className="text-textPrimary ml-3 font-semibold">{t('sidebar.home', { defaultValue: 'Home' })}</Text>
        </TouchableOpacity>
        {(['agenda', 'grades'] as const).map(route => <TouchableOpacity key={route} onPress={() => guardedPush('/(app)/' + route as '/(app)/agenda' | '/(app)/grades')} className="px-4 py-3 flex-row items-center"><Ionicons name={route === 'agenda' ? 'calendar-outline' : 'school-outline'} size={21} color={colors.primary} /><Text className="text-textPrimary ml-3 font-semibold">{t('update15.' + route)}</Text></TouchableOpacity>)}
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
                const tint = SPACE_COLOR_MAP[space.color] || colors.textSecondary;
                return (
                  <TouchableOpacity
                    key={space.id}
                    className="flex-row items-center py-2.5 px-4"
                    onPress={() => handleSelectSpace(space.id)}
                  >
                    {/* Mesmo tratamento visual do SpaceTree: círculo sólido
                        na cor do space + ícone branco, para consistência
                        entre "Favoritos" e a árvore de "Spaces" abaixo. */}
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
                      style={{ backgroundColor: tint }}
                    >
                      <SpaceIcon
                        name={space.icon || 'folder-outline'}
                        size={16}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text className="text-textPrimary text-sm flex-1" numberOfLines={1}>
                      {space.name}
                    </Text>
                    <Ionicons name="star" size={16} color={colors.warning} />
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {showRecents && (
          <View className="mb-1">
            <SectionHeader
              label={t('sidebar.sections.recentChats')}
              count={visibleChats.length}
              expanded={recentsOpen}
              onToggle={() => toggleSection(setRecentsOpen)}
            />
            {recentsOpen &&
              visibleChats.map((chat) => (
                <TouchableOpacity
                  key={chat.id}
                  className="flex-row items-center py-2.5 px-4"
                  onPress={() => guardedPush(`/(app)/chats/${chat.id}` as Href)}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={19}
                    color={colors.textTertiary}
                    style={{ marginRight: 10 }}
                  />
                  <View className="flex-1">
                    <Text className="text-textPrimary text-sm" numberOfLines={1}>
                      {chat.title}
                    </Text>
                    <Text className="text-textTertiary text-[11px]">
                      {chat.space?.name} ·{' '}
                      {formatDistanceToNow(new Date(chat.updated_at), {
                        locale: dateLocale,
                        addSuffix: true,
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
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
              />
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity
        className="mx-4 my-2 bg-primary py-3.5 rounded-full flex-row items-center justify-center"
        onPress={handleNewSpace}
      >
        <Ionicons name="add" size={21} color={colors.primaryText} />
        <Text className="text-primaryText font-semibold ml-1 text-sm">{t('sidebar.newSpace')}</Text>
      </TouchableOpacity>

      <View className="border-t border-border px-4 py-3 flex-row items-center justify-between">
        <TouchableOpacity
          className="flex-row items-center flex-1"
          onPress={() => guardedPush('/(app)/profile')}
        >
          <Avatar name={name || '?'} size={30} />
          <View className="ml-2 flex-1">
            <Text className="text-textPrimary font-medium text-sm" numberOfLines={1}>
              {name || t('sidebar.defaultUserName')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </>
  );
}

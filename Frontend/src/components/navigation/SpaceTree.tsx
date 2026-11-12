import { SpaceIcon } from '../spaces/SpaceIcon';
import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Space } from '../../stores/spaceStore';
import { useSpaceColorMap, useThemeColors } from '../../constants/theme';

interface SpaceTreeProps {
  space: Space;
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onSelectSpace: (id: string) => void;
  selectedSpaceId?: string | null;
}

export function SpaceTree({
  space,
  level,
  expandedIds,
  toggleExpand,
  onSelectSpace,
  selectedSpaceId,
}: SpaceTreeProps) {
  const colors = useThemeColors();
  const palette = useSpaceColorMap();
  const hasChildren = !!(space.children && space.children.length > 0);
  const isExpanded = expandedIds.has(space.id);
  const selected = selectedSpaceId === space.id;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelectSpace(space.id)}
        className="flex-row items-center py-2.5 px-4 active:bg-surfaceElevated rounded-xl"
        style={{ paddingLeft: 16 + level * 18 }}
      >
        {hasChildren ? (
          <TouchableOpacity onPress={() => toggleExpand(space.id)} className="mr-1.5" hitSlop={8}>
            <Ionicons
              name={isExpanded ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 14, marginRight: 6 }} />
        )}

        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: colors.iconSurface }}
        >
          <SpaceIcon name={space.icon || 'folder-outline'} size={16} color={palette[space.color] || colors.textSecondary} />
        </View>

        <Text className="flex-1 text-sm" numberOfLines={1} style={{ color: colors.textPrimary }}>
          {space.name}
        </Text>

        {space.is_favorite && <Ionicons name="star" size={13} color={colors.warning} />}
      </Pressable>

      {hasChildren && isExpanded && (
        <View>
          {space.children!.map((child) => (
            <SpaceTree
              key={child.id}
              space={child}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onSelectSpace={onSelectSpace}
              selectedSpaceId={selectedSpaceId}
            />
          ))}
        </View>
      )}
    </View>
  );
}

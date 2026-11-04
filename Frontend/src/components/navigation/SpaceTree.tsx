import { SpaceIcon } from '../spaces/SpaceIcon';
import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Space } from '../../stores/spaceStore';
import { useThemeColors, useSpaceColorMap } from '../../constants/theme';

interface SpaceTreeProps {
  space: Space;
  level: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onSelectSpace: (id: string) => void;
}

export function SpaceTree({
  space,
  level,
  expandedIds,
  toggleExpand,
  onSelectSpace,
}: SpaceTreeProps) {
  const colors = useThemeColors();
  const SPACE_COLOR_MAP = useSpaceColorMap();
  const hasChildren = !!(space.children && space.children.length > 0);
  const isExpanded = expandedIds.has(space.id);
  const tint = SPACE_COLOR_MAP[space.color] || colors.textSecondary;

  return (
    <View>
      <Pressable
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

        {/* Círculo do ícone: fundo sólido na cor do space + ícone branco.
            Antes era fundo em 12.5% de opacidade com ícone na mesma cor
            (baixo contraste, quase impercetível em vários tons). Fundo
            sólido + branco garante legibilidade em qualquer cor do
            SPACE_COLOR_MAP, em claro e escuro. */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-2.5"
          style={{ backgroundColor: tint }}
        >
          <SpaceIcon name={space.icon || 'folder-outline'} size={16} color="#FFFFFF" />
        </View>

        <Text className="flex-1 text-textPrimary text-sm" numberOfLines={1}>
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
            />
          ))}
        </View>
      )}
    </View>
  );
}
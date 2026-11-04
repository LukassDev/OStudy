import { SpaceIcon } from '../spaces/SpaceIcon';
    import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Space } from '../../stores/spaceStore';
import { useThemeColors } from '../../constants/theme';

interface SpaceTreeItemProps {
  space: Space;
  level: number;
  onPress: (space: Space) => void;
  onLongPress?: (space: Space) => void;
}

export function SpaceTreeItem({space, level, onPress, onLongPress }: SpaceTreeItemProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const hasChildren = space.children && space.children.length > 0;

  const toggleExpand = () => {
    if (hasChildren) setExpanded(!expanded);
  };

  const handlePress = () => {
    onPress(space);
  };

  return (
    <View>
      <TouchableWithoutFeedback onPress={handlePress} onLongPress={() => onLongPress?.(space)}>
        <View
          className="flex-row items-center py-2 px-4"
          style={{ paddingLeft: 16 + level * 20 }}
        >
          {/* Seta para expandir/recolher */}
          {hasChildren && (
            <TouchableOpacity onPress={toggleExpand} className="mr-1">
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
          {/* Ícone do Space */}
          <SpaceIcon
            name={space.icon || 'folder-outline'}
            size={20}
            color={colors.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text className="text-textPrimary text-base flex-1" numberOfLines={1}>
            {space.name}
          </Text>
          {space.is_favorite && (
            <Ionicons name="star" size={16} color={colors.warning} style={{ marginLeft: 4 }} />
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Sub-Spaces (recursão) */}
      {expanded && hasChildren && (
        <View>
          {space.children!.map((child) => (
            <SpaceTreeItem
              key={child.id}
              space={child}
              level={level + 1}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}
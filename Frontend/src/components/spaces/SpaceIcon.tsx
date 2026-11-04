import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SPACE_SUBJECT_ICON_SVGS } from '../../utils/spaceSubjectIcons';

export function SpaceIcon({
  name,
  size = 22,
  color,
  style,
}: {
  name?: string | null;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const subjectSvg = name ? SPACE_SUBJECT_ICON_SVGS[name] : undefined;
  const glyph = (name || 'folder-outline') as keyof typeof Ionicons.glyphMap;
  return (
    <View style={style}>
      {subjectSvg
        ? <SvgXml xml={subjectSvg} width={size} height={size} color={color} />
        : <Ionicons name={glyph in Ionicons.glyphMap ? glyph : 'folder-outline'} size={size} color={color} />}
    </View>
  );
}

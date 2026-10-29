import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../constants/theme';
import { OrenLogo } from './OrenLogo';

interface OrenAvatarProps {
  size?: number;
}

export const OrenAvatar: React.FC<OrenAvatarProps> = ({ size = 40 }) => {
  return (
    <View>
      <OrenLogo size={size} />
    </View>
  );
};
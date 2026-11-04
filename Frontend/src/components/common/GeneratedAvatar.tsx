import React from 'react';
import { View, Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AVATAR_BACKGROUND, AVATAR_FOREGROUND, getAvatarPreset, isInitialsAvatar } from '../../utils/avatarPresets';
import { LORELEI_AVATARS } from '../../utils/loreleiAvatars';

interface GeneratedAvatarProps {
  name: string;
  size?: number;
  avatarStyle?: string | null;
}

export function GeneratedAvatar({ name, size = 40, avatarStyle }: GeneratedAvatarProps) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: AVATAR_BACKGROUND, alignItems: 'center', justifyContent: 'center' }}>
      {isInitialsAvatar(avatarStyle) ? (
        <Text style={{ color: AVATAR_FOREGROUND, fontFamily: 'DMSans_700Bold', fontSize: size * 0.42 }}>
          {(name?.trim()?.[0] || '?').toUpperCase()}
        </Text>
      ) : (
        <SvgXml xml={LORELEI_AVATARS[getAvatarPreset(avatarStyle).id]} width={size} height={size} />
      )}
    </View>
  );
}

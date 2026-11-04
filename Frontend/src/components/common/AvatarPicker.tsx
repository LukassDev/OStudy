import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GeneratedAvatar } from './GeneratedAvatar';
import { AVATAR_PRESETS, INITIALS_AVATAR_ID, getAvatarPreset, isInitialsAvatar } from '../../utils/avatarPresets';
import { useThemeColors } from '../../constants/theme';

export function AvatarPicker({ name, value, onChange }: { name: string; value: string; onChange: (id: string) => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const selectedId = isInitialsAvatar(value) ? INITIALS_AVATAR_ID : getAvatarPreset(value).id;
  const options = [{ id: INITIALS_AVATAR_ID, label: t('profile.initials') }, ...AVATAR_PRESETS];
  const initialOptions = options.slice(0, 6);
  const selected = options.find((option) => option.id === selectedId);
  if (selected && !initialOptions.some((option) => option.id === selectedId)) initialOptions[5] = selected;
  return (
    <View style={{ width: '100%', marginTop: 16, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface }}>
      <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled showsVerticalScrollIndicator={expanded}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(expanded ? options : initialOptions).map((option, index) => (
            <TouchableOpacity key={option.id} accessibilityRole="radio" accessibilityState={{ checked: selectedId === option.id }} accessibilityLabel={option.label || 'Avatar ' + (index + 1)} onPress={() => onChange(option.id)} style={{ width: '33.333%', alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ padding: 4, borderWidth: 2, borderRadius: 40, borderColor: selectedId === option.id ? colors.primary : 'transparent' }}>
                <GeneratedAvatar name={name || '?'} size={56} avatarStyle={option.id} />
              </View>
              {option.label ? <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{option.label}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('profile.avatarPickerTitle')} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ alignItems: 'center', padding: 10 }}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

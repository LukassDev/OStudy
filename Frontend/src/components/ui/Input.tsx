// src/components/ui/Input.tsx
import { View, Text, TextInput, TextInputProps, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, typography, radius } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;            // label opcional — omitir para inputs "flutuantes"
  error?: string;
  hint?: string;             // texto de apoio abaixo do input
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconRightPress?: () => void;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  icon,
  iconRight,
  onIconRightPress,
  isPassword,
  ...props
}: InputProps) {
  const colors = useThemeColors();
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : 'transparent';

  const bgColor = focused ? colors.surfaceElevated : colors.surface;

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            fontFamily: typography.fontFamily.medium,
            color: focused ? colors.primary : colors.textSecondary,
            marginBottom: 6,
            letterSpacing: 0,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bgColor,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor,
          paddingHorizontal: 14,
          // sombra sutil quando focused
          ...(focused ? {
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          } : {}),
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={17}
            color={focused ? colors.primary : colors.textTertiary}
            style={{ marginRight: 10 }}
          />
        )}

        <TextInput
          style={{
            flex: 1,
            paddingVertical: 13,
            fontSize: 16,
            fontFamily: typography.fontFamily.regular,
            color: colors.textPrimary,
            // Remove o outline azul nativo no Android
            textAlignVertical: 'center',
          }}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        )}

        {iconRight && !isPassword && (
          <TouchableOpacity onPress={onIconRightPress} hitSlop={8}>
            <Ionicons name={iconRight} size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: typography.fontFamily.regular,
            color: colors.error,
            marginTop: 5,
          }}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: typography.fontFamily.regular,
            color: colors.textTertiary,
            marginTop: 5,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
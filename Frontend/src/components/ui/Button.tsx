// src/components/ui/Button.tsx
import { Pressable, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useThemeColors, typography } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'outline' | 'ghost' | 'secondary';
  size?: 'md' | 'sm' | 'lg';
  style?: ViewStyle | ViewStyle[];
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'md',
  style,
  fullWidth = true,
  icon,
}: ButtonProps) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const blocked = !!disabled || !!loading;

  // Backgrounds por variante
  const bgStyle =
    variant === 'primary'   ? { backgroundColor: colors.primaryStrong } :
    variant === 'danger'    ? { backgroundColor: colors.error } :
    variant === 'secondary' || variant === 'outline'
                           ? { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border } :
                              { backgroundColor: 'transparent' };

  // Cor do texto por variante
  const textColor =
    variant === 'outline' || variant === 'ghost' || variant === 'secondary'
      ? colors.textPrimary
      : variant === 'primary' ? colors.primaryText : '#FFFFFF';

  // Padding e altura por size
  const paddingStyle =
    size === 'lg' ? { paddingVertical: 17, paddingHorizontal: 28 } :
    size === 'sm' ? { paddingVertical: 10, paddingHorizontal: 18 } :
                   { paddingVertical: 14, paddingHorizontal: 24 };

  const fontSize =
    size === 'lg' ? 17 :
    size === 'sm' ? 14 :
    16;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      disabled={blocked}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        {
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          opacity: disabled || loading ? 0.48 : 1,
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          ...paddingStyle,
          ...bgStyle,
        },
        style,
        variant === 'primary' && !blocked && (pressed || hovered) && {
          backgroundColor: pressed ? colors.primaryPressed : colors.primaryStrong,
          opacity: pressed ? 1 : 0.92,
        },
        variant !== 'primary' && pressed && !blocked && { opacity: 0.82 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
          size="small"
        />
      ) : (
        <>
          {icon}
        <Text
          style={{
            color: textColor,
            fontSize,
            fontFamily: typography.fontFamily.semibold,
            letterSpacing: -0.1,
          }}
        >
          {title}
        </Text>
        </>
      )}
    </Pressable>
  );
}

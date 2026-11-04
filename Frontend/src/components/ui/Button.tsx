// src/components/ui/Button.tsx
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useThemeColors, shadows, typography } from '../../constants/theme';

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

  // Backgrounds por variante
  const bgStyle =
    variant === 'primary'   ? { backgroundColor: colors.primary, ...shadows.cta } :
    variant === 'danger'    ? { backgroundColor: colors.error } :
    variant === 'secondary' ? { backgroundColor: colors.secondary } :
    variant === 'outline'   ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border } :
                              { backgroundColor: 'transparent' };

  // Cor do texto por variante
  const textColor =
    variant === 'outline' || variant === 'ghost'
      ? colors.textPrimary
      : '#FFFFFF';

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
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
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
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.textPrimary : '#FFFFFF'}
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
    </TouchableOpacity>
  );
}
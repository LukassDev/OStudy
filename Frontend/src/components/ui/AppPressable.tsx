import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { interaction, radius, useThemeColors } from '../../constants/theme';

type AppPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  error?: boolean;
  activeOpacity?: number;
};

/** Feedback e área de toque comuns a botões, linhas e abas. */
export function AppPressable({
  style, disabled, loading = false, error = false,
  activeOpacity = interaction.pressedOpacity,
  accessibilityRole = 'button', accessibilityState,
  onHoverIn, onHoverOut, android_ripple, ...props
}: AppPressableProps) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const blocked = !!disabled || loading;
  return (
    <Pressable
      {...props}
      disabled={blocked}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: blocked, busy: loading }}
      android_ripple={android_ripple ?? { color: colors.ripple, foreground: true }}
      onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
      style={({ pressed }) => [
        { minHeight: interaction.minTarget, minWidth: interaction.minTarget, borderRadius: radius.md, overflow: 'hidden' },
        style,
        error && { borderWidth: 1, borderColor: colors.error },
        { opacity: disabled ? interaction.disabledOpacity : blocked ? 1 : pressed ? activeOpacity : hovered ? interaction.hoverOpacity : 1 },
      ]}
    />
  );
}

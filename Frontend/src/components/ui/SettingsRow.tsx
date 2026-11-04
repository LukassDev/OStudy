import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { radius, spacing, typography, useThemeColors } from '../../constants/theme';
import { AppPressable } from './AppPressable';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  divider?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
}
export function SettingsRow({ icon, label, onPress, destructive, divider = true, disabled, loading, error, expanded }: SettingsRowProps) {
  const colors = useThemeColors();
  const tint = destructive ? colors.error : colors.textSecondary;
  return (
    <AppPressable onPress={onPress} disabled={disabled} loading={loading} error={!!error}
      accessibilityLabel={label} accessibilityState={{ expanded }}
      style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.compact, borderRadius: radius.md, borderBottomWidth: divider ? 1 : 0, borderBottomColor: colors.border }}>
      <Ionicons name={icon} size={20} color={tint} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ ...typography.body, color: destructive ? colors.error : colors.textPrimary }}>{label}</Text>
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
      </View>
      {loading ? <ActivityIndicator size="small" color={tint} /> : <Ionicons name={expanded === undefined ? 'chevron-forward-outline' : expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={20} color={tint} />}
    </AppPressable>
  );
}

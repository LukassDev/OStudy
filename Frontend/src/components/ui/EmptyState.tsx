import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { useThemeColors } from "../../constants/theme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

// Estado vazio consistente — usado em qualquer lista sem dados (Spaces, Chats,
// Conteúdo, Calendário, Avaliações, Recursos). Evita ecrãs em branco sem explicação.
export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled = false,
}: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="items-center justify-center py-12 px-6">
      <View className="w-16 h-16 rounded-full bg-primarySoft items-center justify-center mb-4">
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text className="text-textPrimary font-semibold text-base text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-textSecondary text-sm text-center mt-1">
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          className="mt-5 bg-primary rounded-[12px] py-3 px-6"
          onPress={onAction}
          disabled={actionDisabled}
          style={{ opacity: actionDisabled ? 0.5 : 1 }}
        >
          <Text className="text-primaryText font-semibold text-sm">
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

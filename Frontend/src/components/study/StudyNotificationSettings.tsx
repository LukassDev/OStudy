import React, { useRef, useState } from "react";
import { View, Text, Switch, TouchableOpacity, InteractionManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "../../constants/theme";
import { useStudyStore } from "../../stores/studyStore";
import { requestStudyNotifications } from "../../services/studyNotifications";
import { KeyboardAwareModal } from "../ui/KeyboardAwareModal";
import { Button } from "../ui/Button";
import { showAppDialog } from "../ui/AppDialog";

let commitVersion = 0;
export function StudyNotificationSettings({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [draft, setDraft] = useState(() => useStudyStore.getState().preferences.reminder_minutes);
  const initial = useRef(draft);
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
    if (draft === initial.current) return;
    const version = ++commitVersion;
    // Close the sheet first. Taps only update this component's draft.
    InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const isCurrent = () => version === commitVersion;
        if (!isCurrent()) return;
        try {
          if (draft !== null) await requestStudyNotifications();
          if (!isCurrent()) return;
          await useStudyStore.getState().savePreferences({ reminder_minutes: draft });
        } catch (error) {
          if (isCurrent()) showAppDialog(t("update15.error"), String((error as Error).message || error));
        }
      })();
    });
  };
  const muted = {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: "DMSans_400Regular" as const,
  };
  const heading = {
    color: colors.textPrimary,
    fontSize: 17,
    fontFamily: "DMSans_700Bold" as const,
  };
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 100,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          color: selected ? colors.primary : colors.textSecondary,
          fontFamily: "DMSans_500Medium",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  const modalHeader = (title: string, close: () => void) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 22,
      }}
    >
      <Text style={[heading, { fontSize: 22, flex: 1 }]}>{title}</Text>
      <TouchableOpacity
        accessibilityLabel={t("update15.cancel")}
          onPress={close}
        style={{ padding: 8 }}
      >
        <Ionicons name="close" size={23} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
      <KeyboardAwareModal
        visible={true}
        contentStyle={{ padding: 20 }}
        onRequestClose={close}
      >
        {modalHeader(t("studyVisual.notifications"), close)}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <Text style={[heading, { fontSize: 15, flex: 1 }]}>
            {t("studyVisual.enableReminders")}
          </Text>
          <Switch
            value={draft !== null}
            trackColor={{ true: colors.primary }}
            onValueChange={enabled => setDraft(enabled ? 10 : null)}
          />
        </View>
        {draft !== null && (
          <>
            <Text style={[muted, { marginBottom: 10 }]}>
              {t("update15.reminders")}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 22,
              }}
            >
              {[0, 5, 10, 15, 30, 60].map((m) => (
                <View key={m}>
                  {chip(
                    `${m} min`,
                    draft === m,
                    () => setDraft(m),
                  )}
                </View>
              ))}
            </View>
          </>
        )}
        <Text style={[muted, { lineHeight: 20, marginBottom: 22 }]}>
          {t("update15.localTime")}
        </Text>
        <Button
          title={t("common.save")}
          onPress={close}
        />
      </KeyboardAwareModal>
  );
}

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "../ui/DateTimePicker";
import { differenceInCalendarDays, format } from "date-fns";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useThemeColors } from "../../constants/theme";
import { useDateFnsLocale } from "../../i18n/dateFnsLocale";
import {
    CalendarEvent,
    EventType,
    useCalendarStore,
} from "../../stores/calendarStore";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { KeyboardAwareModal } from "../ui/KeyboardAwareModal";
import { showAppDialog } from "../ui/AppDialog";

interface CalendarTabProps {
  spaceId: string;
  readOnly?: boolean;
}

function useTypeLabels(): Record<EventType, string> {
  const { t } = useTranslation();
  return {
    exam: t("calendar.types.exam"),
    assignment: t("calendar.types.assignment"),
    session: t("calendar.types.session"),
    other: t("calendar.types.other"),
  };
}

const TYPE_ICON: Record<EventType, keyof typeof Ionicons.glyphMap> = {
  exam: "school-outline",
  assignment: "document-text-outline",
  session: "time-outline",
  other: "ellipse-outline",
};

export function CalendarTab({ spaceId, readOnly = false }: CalendarTabProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const TYPE_LABEL = useTypeLabels();
  const { events, loading, fetchEvents, deleteEvent } = useCalendarStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    fetchEvents(spaceId);
  }, [spaceId, fetchEvents]);

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events],
  );

  const handleDelete = (event: CalendarEvent) => {
    if (readOnly) return;
    showAppDialog(
      t("calendar.deleteConfirm.title"),
      t("calendar.deleteConfirm.message", { title: event.title }),
      [
        { text: t("calendar.deleteConfirm.cancel"), style: "cancel" },
        {
          text: t("calendar.deleteConfirm.confirm"),
          style: "destructive",
          onPress: () => deleteEvent(event.id, spaceId),
        },
      ],
    );
  };

  if (!loading && sorted.length === 0) {
    return (
      <View className="flex-1">
        <EmptyState
          icon="calendar-outline"
          title={t("calendar.empty.title")}
          subtitle={t("calendar.empty.subtitle")}
          actionLabel={t("calendar.empty.action")}
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          actionDisabled={readOnly}
        />
        <EventModal
          visible={modalOpen}
          spaceId={spaceId}
          editing={editing}
          onClose={() => setModalOpen(false)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <TouchableOpacity
            className="bg-primary rounded-[12px] py-3 px-4 mx-4 mt-4 mb-2 flex-row items-center justify-center"
            onPress={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            disabled={readOnly}
            style={{ opacity: readOnly ? 0.5 : 1 }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text className="text-primaryText font-semibold ml-1">
              {t("calendar.newEvent")}
            </Text>
        </TouchableOpacity>

        {sorted.map((event) => {
          const days = differenceInCalendarDays(
            new Date(event.event_date),
            new Date(),
          );
          const urgent = days >= 0 && days <= 5;
          return (
            <View
              key={event.id}
              className="flex-row items-center bg-surface rounded-[10px] px-4 py-3 mx-4 mb-2"
            >
              <TouchableOpacity
                className="flex-1 flex-row items-center"
                onPress={() => {
                  if (readOnly) return;
                  setEditing(event);
                  setModalOpen(true);
                }}
                disabled={readOnly}
                activeOpacity={0.75}
              >
                <View
                  className="w-9 h-9 rounded-[12px] items-center justify-center mr-3"
                  style={{
                    backgroundColor: urgent
                      ? colors.errorSoft
                      : colors.primarySoft,
                  }}
                >
                  <Ionicons
                    name={TYPE_ICON[event.type]}
                    size={17}
                    color={urgent ? colors.error : colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-textPrimary font-semibold"
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                  <Text className="text-textTertiary text-xs mt-0.5">
                    {TYPE_LABEL[event.type]} ·{" "}
                    {format(
                      new Date(event.event_date),
                      t("calendar.dateFormatShort"),
                      { locale: dateLocale },
                    )}
                  </Text>
                </View>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: urgent ? colors.error : colors.textTertiary }}
                >
                  {days === 0
                    ? t("calendar.dayCountToday")
                    : days > 0
                      ? t("calendar.dayCountFuture", { count: days })
                      : t("calendar.dayCountPast")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                  onPress={() => handleDelete(event)}
                  disabled={readOnly}
                  hitSlop={8}
                  className="ml-3 w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: "transparent" }}
                  accessibilityLabel="Delete event"
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.error} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <EventModal
        visible={modalOpen}
        spaceId={spaceId}
        editing={editing}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

function EventModal({
  visible,
  spaceId,
  editing,
  onClose,
}: {
  visible: boolean;
  spaceId: string;
  editing: CalendarEvent | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const TYPE_LABEL = useTypeLabels();
  const { createEvent, updateEvent } = useCalendarStore();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("exam");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setTitle(editing?.title || "");
      setType(editing?.type || "exam");
      setDate(editing ? new Date(editing.event_date) : new Date());
      setError("");
    }
  }, [visible, editing]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const isoDate = format(date, "yyyy-MM-dd");
      if (editing) {
        await updateEvent(editing.id, spaceId, {
          title: title.trim(),
          type,
          event_date: isoDate,
        });
      } else {
        await createEvent({
          space_id: spaceId,
          title: title.trim(),
          type,
          event_date: isoDate,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("calendar.modal.errors.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareModal visible={visible} onRequestClose={onClose}>
      <View className="bg-background p-6">
        <Text className="text-lg font-bold text-textPrimary mb-4">
          {editing
            ? t("calendar.modal.editTitle")
            : t("calendar.modal.newTitle")}
        </Text>

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("calendar.modal.titleLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          placeholder={t("calendar.modal.titlePlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text className="text-xs font-semibold text-textTertiary mb-2 uppercase">
          {t("calendar.modal.typeLabel")}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {(Object.keys(TYPE_LABEL) as EventType[]).map((typeKey) => (
            <TouchableOpacity
              key={typeKey}
              onPress={() => setType(typeKey)}
              className={`px-4 py-2 rounded-full ${type === typeKey ? "bg-primary" : "bg-surface"}`}
            >
              <Text
                className={
                  type === typeKey
                    ? "text-white text-sm font-medium"
                    : "text-textSecondary text-sm"
                }
              >
                {TYPE_LABEL[typeKey]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("calendar.modal.dateLabel")}
        </Text>
        {Platform.OS === "web" ? <View style={{ marginBottom: 24 }}><DateTimePicker value={date} mode="date" onChange={(_, selected) => { if (selected) setDate(selected); }} /></View> : <TouchableOpacity
          className="bg-surface rounded-xl px-4 py-3.5 mb-6 flex-row items-center justify-between"
          onPress={() => setShowPicker(true)}
        >
          <Text className="text-textPrimary text-base">
            {format(date, t("calendar.dateFormatLong"), { locale: dateLocale })}
          </Text>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>}
        {Platform.OS !== "web" && showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, selected) => {
              setShowPicker(Platform.OS === "ios");
              if (selected) setDate(selected);
            }}
          />
        )}

        {error ? (
          <Text className="text-error text-sm mb-3">{error}</Text>
        ) : null}

        <Button
          title={
            editing
              ? t("calendar.modal.saveButton")
              : t("calendar.modal.createButton")
          }
          onPress={handleSave}
          loading={saving}
        />
        <TouchableOpacity className="py-3 items-center mt-1" onPress={onClose}>
          <Text className="text-textSecondary">
            {t("calendar.modal.cancel")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareModal>
  );
}

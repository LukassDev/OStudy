import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useStudyStore, overallAverage } from "../../stores/studyStore";
import { guardedPush } from "../../utils/navigation";
import { useThemeColors } from "../../constants/theme";

interface DashboardCard {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  body: string;
  detail?: string;
  caption?: string;
  emphasizeBody?: boolean;
  cta: string;
  onPress: () => void;
}

function dateOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function getDayLabel(date: Date, now: Date, locale: string, t: (key: string) => string): string {
  const difference = dateOrdinal(date) - dateOrdinal(now);
  if (difference === 0) return t("studyVisual.todayLabel");
  if (difference === 1) return t("studyVisual.tomorrowLabel");
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
}

export function StudyCards() {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { preferences, grades, lessons, events } = useStudyStore();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    void useStudyStore.getState().load(false, ['grades', 'preferences', 'lessons', 'events']);
  }, []);

  const average = overallAverage(grades, preferences);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const nextLesson = lessons
    .map((lesson) => {
      let daysUntil = (lesson.weekday - now.getDay() + 7) % 7;
      const [hours, minutes] = lesson.start_time.split(":").map(Number);
      if (daysUntil === 0 && hours * 60 + minutes <= currentMinutes) daysUntil = 7;
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil);
      return { lesson, date, daysUntil };
    })
    .sort((a, b) =>
      a.daysUntil - b.daysUntil ||
      a.lesson.start_time.localeCompare(b.lesson.start_time) ||
      a.lesson.id.localeCompare(b.lesson.id),
    )[0];

  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nextEvent = events
    .filter((event) => event.event_date >= todayDate)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id.localeCompare(b.id))[0];
  const eventDate = nextEvent ? new Date(`${nextEvent.event_date}T12:00:00`) : null;

  const slides: DashboardCard[] = [
    {
      title: t("studyVisual.globalAverage"),
      icon: "school-outline" as const,
      body:
        average === null
          ? t("studyVisual.chooseModules")
          : `${average.toFixed(2)} / ${preferences.average_scale}`,
      emphasizeBody: average !== null,
      cta: t("update15.viewAll"),
      onPress: () => guardedPush("/(app)/grades"),
    },
    {
      title: t("update15.today"),
      icon: "calendar-outline" as const,
      body: nextLesson
        ? `${getDayLabel(nextLesson.date, now, i18n.language, t)} · ${nextLesson.lesson.start_time.slice(0, 5)}–${nextLesson.lesson.end_time.slice(0, 5)}`
        : t("studyVisual.noUpcomingLessons"),
      detail: nextLesson?.lesson.title,
      caption: nextLesson?.lesson.room
        ? `${t("update15.room")}: ${nextLesson.lesson.room}`
        : undefined,
      cta: t("update15.viewAll"),
      onPress: () =>
        guardedPush({ pathname: "/(app)/agenda", params: { tab: "schedule" } }),
    },
    {
      title: t("studyVisual.upcomingEvents"),
      icon: "calendar-number-outline" as const,
      body: nextEvent && eventDate
        ? getDayLabel(eventDate, now, i18n.language, t)
        : t("studyVisual.noUpcomingEvents"),
      detail: nextEvent?.title,
      cta: t("update15.viewAll"),
      onPress: () => guardedPush({ pathname: "/(app)/agenda", params: { tab: "calendar" } }),
    },
  ];

  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: width >= 960 ? 'row' : 'column', gap: 16 }}>
      {slides.map((slide) => {
        return (
        <View key={slide.title} style={{ flex: width >= 960 ? 1 : undefined, minWidth: 0, width: width >= 960 ? undefined : '100%', minHeight: 166,
          padding: 20, borderRadius: 16, borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name={slide.icon} size={20} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.textPrimary, fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>{slide.title}</Text>
          </View>
          {slide.detail && <Text style={{ color: colors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 16, lineHeight: 22, marginBottom: 4 }}>{slide.detail}</Text>}
          <Text style={{ color: slide.emphasizeBody ? colors.textPrimary : colors.textSecondary, fontFamily: slide.emphasizeBody ? 'DMSans_700Bold' : 'DMSans_400Regular', fontSize: slide.emphasizeBody ? 28 : 14, lineHeight: slide.emphasizeBody ? 34 : 22, flexGrow: 1 }}>{slide.body}</Text>
          {slide.caption && <Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, marginTop: 2 }}>{slide.caption}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={slide.onPress}
            style={{ alignSelf: 'flex-start', paddingVertical: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.primary, fontFamily: 'DMSans_600SemiBold', fontSize: 13 }}>{slide.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ); })}
    </View>
  );
}

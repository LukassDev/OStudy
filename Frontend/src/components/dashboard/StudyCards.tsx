import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSpaceStore } from '../../stores/spaceStore';
import { useStudyStore, overallAverage } from "../../stores/studyStore";
import { guardedPush } from "../../utils/navigation";
import { OrenLogo } from "../common/OrenLogo";
import { useThemeColors } from "../../constants/theme";

export function StudyCards({
  message,
  ctaLabel,
  onPressCta,
}: {
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { preferences, grades, lessons, events } = useStudyStore();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    void useSpaceStore.getState().fetchSpaces().then(() => {
      if (active) void useStudyStore.getState().load(false,
        page % 3 === 0 ? ['grades', 'preferences'] : page % 3 === 1 ? ['lessons', 'preferences'] : ['events']);
    });
    return () => { active = false; };
  }, [page]);
  const average = overallAverage(grades, preferences);
  const today = lessons.filter((l) => l.weekday === new Date().getDay());
  const now = new Date();
  const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingEvents = events
    .filter(event => event.event_date >= todayDate)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 2);
  const slides = [
    {
      title: t("dashboard.orenSays"),
      icon: null,
      body: message,
      cta: ctaLabel,
      onPress: onPressCta,
    },
    {
      title: t("studyVisual.globalAverage"),
      icon: "school-outline" as const,
      body:
        average === null
          ? t("studyVisual.chooseModules")
          : `${average.toFixed(2)} / ${preferences.average_scale}`,
      cta: t("update15.viewAll"),
      onPress: () => guardedPush("/(app)/grades"),
    },
    {
      title: t("update15.today"),
      icon: "calendar-outline" as const,
      body: today.length
        ? today
            .slice(0, 2)
            .map(
              (l) =>
                ` ${l.title}: ${ l.start_time.slice(0, 5)}/${l.end_time.slice(0, 5)} (${l.room ? "" + l.room : ""})`,
            )

            .join("\n")
        : t("update15.noLessons"),
      cta: t("update15.viewAll"),
      onPress: () =>
        guardedPush({ pathname: "/(app)/agenda", params: { tab: "schedule" } }),
    },
    {
      title: t("studyVisual.upcomingEvents"),
      icon: "calendar-number-outline" as const,
      body: upcomingEvents.length
        ? upcomingEvents.map(event => `${new Date(`${event.event_date}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })} · ${event.title}`).join("\n")
        : t("studyVisual.noUpcomingEvents"),
      cta: t("update15.viewAll"),
      onPress: () => guardedPush({ pathname: "/(app)/agenda", params: { tab: "calendar" } }),
    },
  ];
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: width >= 620 ? 'row' : 'column', flexWrap: 'nowrap', gap: 16 }}>
      {slides.filter((_, index) => index === 0 || index === (page % 3) + 1).map((slide) => {
        const index = slides.indexOf(slide);
        return (
        <View key={slide.title} style={{ flex: width >= 620 ? 1 : undefined, minWidth: 0, width: width >= 620 ? undefined : '100%', minHeight: 166,
          padding: 20, borderRadius: 16, borderWidth: 1,
          borderColor: index === 0 ? colors.primary : colors.border,
          backgroundColor: index === 0 ? colors.primary : colors.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {slide.icon ? <Ionicons name={slide.icon} size={20} color={colors.primary} /> : <OrenLogo size={24} />}
            <Text style={{ flex: 1, color: index === 0 ? '#fff' : colors.textPrimary, fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>{slide.title}</Text>
            {index !== 0 && <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => setPage(value => (value + 2) % 3)} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.continue')} onPress={() => setPage(value => (value + 1) % 3)} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /></TouchableOpacity>
            </View>}
          </View>
          <Text style={{ color: index === 0 ? '#fff' : colors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: index === 1 && average !== null ? 28 : 14, lineHeight: index === 1 && average !== null ? 34 : 22, flexGrow: 1 }}>{slide.body}</Text>
          {slide.cta && slide.onPress && <TouchableOpacity accessibilityRole="button" onPress={slide.onPress}
            style={{ alignSelf: 'flex-start', paddingVertical: 8, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: index === 0 ? '#fff' : colors.primary, fontFamily: 'DMSans_600SemiBold', fontSize: 13 }}>{slide.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={index === 0 ? '#fff' : colors.primary} />
          </TouchableOpacity>}
        </View>
      ); })}
    </View>
  );
}

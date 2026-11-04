import { useShallow } from 'zustand/react/shallow';
import { StudyNotificationSettings } from "./StudyNotificationSettings";
import { WeekSchedule } from './WeekSchedule';
import { LessonModal } from './LessonModal';
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useStudyStore,
  moduleAverages,
  overallAverage,
  Lesson,
} from "../../stores/studyStore";
import { useSpaceStore, Space } from "../../stores/spaceStore";
import { useThemeColors } from "../../constants/theme";
import { guardedPush } from "../../utils/navigation";

export const flattenSpaces = (spaces: Space[]): Space[] =>
  spaces.flatMap((s) => [s, ...flattenSpaces(s.children || [])]);
const emptyLessons: Lesson[] = [];
const emptyEvents: ReturnType<typeof useStudyStore.getState>['events'] = [];
const emptyGrades: ReturnType<typeof useStudyStore.getState>['grades'] = [];
const emptyLesson = (): Lesson => ({
  id: "",
  title: "",
  room: "",
  weekday: 1,
  start_time: "09:00",
  end_time: "10:00",
  space_id: null,
});
export function StudyScreen({ mode }: { mode: "agenda" | "grades" }) {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { t, i18n } = useTranslation();
  const day = (weekday: number) => new Date(2026, 0, 4 + weekday).toLocaleDateString(i18n.language, { weekday: 'short' });
  const colors = useThemeColors();
  const spaces = useSpaceStore(s => s.spaces);
  const fetchSpaces = useSpaceStore(s => s.fetchSpaces);
  const allSpaces = useMemo(() => flattenSpaces(spaces), [spaces]);
  const [tab, setTab] = useState<"calendar" | "schedule">(
    params.tab === "schedule" ? "schedule" : "calendar",
  );
  const [schedulePrepared, setSchedulePrepared] = useState(false);
  const state = useStudyStore(useShallow(s => ({
    lessons: mode === 'agenda' && (tab === 'schedule' || schedulePrepared) ? s.lessons : emptyLessons,
    events: mode === 'agenda' && tab === 'calendar' ? s.events : emptyEvents,
    grades: mode === 'grades' ? s.grades : emptyGrades,
    preferences: s.preferences, error: s.error, lessonSyncError: s.lessonSyncError,
    load: s.load, saveLessons: s.saveLessons, updateLesson: s.updateLesson,
    deleteLesson: s.deleteLesson, queuePreferences: s.queuePreferences, retryLessons: s.retryLessons,
  })));
  const load = state.load;
  useEffect(() => {
    if (tab === 'schedule') setSchedulePrepared(true);
  }, [tab]);
  // A prefetched route can receive its requested tab only when it is opened.
  useEffect(() => {
    if (params.tab === 'schedule' || params.tab === 'calendar') setTab(params.tab);
  }, [params.tab]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarWidth, setCalendarWidth] = useState(0);
  const splitCalendar = calendarWidth >= 840;
  const fixedCalendar = splitCalendar && mode !== 'grades' && tab === 'calendar';
  const fixedSchedule = mode === 'agenda' && tab === 'schedule';
  const EventListContainer = splitCalendar ? ScrollView : View;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<Lesson | null>(null);
  const busy = false;
  const createLesson = useCallback((weekday: number, start_time: string, end_time: string) =>
    setEditor({ ...emptyLesson(), weekday, start_time, end_time }), []);
  const editLesson = useCallback((lesson: Lesson) => setEditor({ ...lesson,
    start_time: lesson.start_time.slice(0, 5), end_time: lesson.end_time.slice(0, 5) }), []);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  useEffect(() => {
    void fetchSpaces();
    return () => { void useStudyStore.getState().flushPreferences(); };
  }, [fetchSpaces]);
  useEffect(() => {
    void load(false, mode === 'grades' ? ['grades', 'preferences']
      : tab === 'schedule' ? ['lessons', 'preferences'] : ['events', 'preferences']);
  }, [load, mode, tab]);
  const saveLesson = async (lesson: Lesson, days: number[], another: boolean) => {
    if (!lesson.title.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(lesson.start_time)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(lesson.end_time) || lesson.end_time <= lesson.start_time) {
      throw new Error(t('update15.invalidLesson'));
    }
    if (lesson.id) await state.updateLesson(lesson);
    else {
      const { id, ...values } = lesson;
      await state.saveLessons(days.map(weekday => ({ ...values, weekday })));
    }
    if (!another) setEditor(null);
  };
  const deleteLesson = async (lesson: Lesson) => {
    await state.deleteLesson(lesson.id);
    setEditor(null);
  };
  const average = overallAverage(state.grades, state.preferences);
  const selectedEvents = state.events.filter(
    (e) => e.event_date.startsWith(month) && (!filter || e.space_id === filter),
  );
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
  const panel = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  };
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={busy}
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
  const changeMonth = (offset: number) => {
    const d = new Date(month + "-15T12:00:00");
    d.setMonth(d.getMonth() + offset);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };
  const monthDate = new Date(month + "-01T12:00:00");
  const firstWeekday = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const navigate = (destination: "calendar" | "schedule" | "grades") => {
    if (destination === "grades") {
      if (mode !== "grades") router.replace("/(app)/grades");
    } else if (mode === "agenda") setTab(destination);
    else
      router.replace({
        pathname: "/(app)/agenda",
        params: { tab: destination },
      });
  };
  const eventList = selectedEvents.filter(
    (e) => !selectedDate || e.event_date === selectedDate,
  );
  const eventFilters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
      {chip(t("update15.allSpaces"), !filter, () => setFilter(null))}
      {allSpaces.map((s) => <View key={s.id}>{chip(s.name, filter === s.id, () => setFilter(s.id))}</View>)}
    </ScrollView>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, minHeight: 0, backgroundColor: colors.background, width: '100%', maxWidth: 1200, alignSelf: 'center' }}
    >
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <TouchableOpacity
          accessibilityLabel={t("update15.back")}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(app)/dashboard")
          }
          style={{
            padding: 9,
            borderRadius: 100,
            backgroundColor: colors.surface,
          }}
        >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontFamily: "DMSans_700Bold",
              fontSize: 25,
              color: colors.textPrimary,
            }}
          >
            {t(mode === "grades" ? "update15.grades" : "update15.agenda")}
          </Text>
          {Platform.OS !== 'web' && mode === "agenda" && (
            <TouchableOpacity
              accessibilityLabel={t("update15.reminders")}
              onPress={() => setSettingsOpen(true)}
              style={{
                padding: 10,
                borderRadius: 100,
                backgroundColor: colors.surface,
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}
        </View>
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: colors.surface,
            padding: 4,
            borderRadius: 100,
            flexDirection: "row",
            marginBottom: 18,
          }}
        >
          {(["calendar", "schedule", "grades"] as const).map((destination) => {
            const selected =
              mode === "grades" ? destination === "grades" : destination === tab;
            return (
              <TouchableOpacity
                key={destination}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => navigate(destination)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  paddingVertical: 11,
                  borderRadius: 100,
                  backgroundColor: selected ? colors.primary : "transparent",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "DMSans_500Medium",
                    fontSize: 12,
                    color: selected ? "#fff" : colors.textSecondary,
                  }}
                >
                  {t(
                    destination === "schedule"
                      ? "studyVisual.timetable"
                      : "update15." + destination,
                  )}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          scrollEnabled={!fixedCalendar && !fixedSchedule}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: fixedCalendar || fixedSchedule ? 20 : 42, ...(fixedCalendar || fixedSchedule ? { flex: 1, minHeight: 0 } : {}) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!!state.error && (
            <View style={panel}>
              <Text style={{ color: colors.error, marginBottom: 10 }}>
                {state.error}
              </Text>
              <Button
                title={t("update15.retry")}
                variant="outline"
                onPress={() => void load(true, mode === 'grades' ? ['grades', 'preferences'] : tab === 'schedule' ? ['lessons', 'preferences'] : ['events', 'preferences'])}
              />
            </View>
          )}
          {mode === "grades" ? (
            <>
              <View
                style={[
                  panel,
                  { backgroundColor: colors.primarySoft, padding: 22 },
                ]}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons
                    name="school-outline"
                    color={colors.primary}
                    size={20}
                  />
                  <Text style={[heading, { color: colors.primary }]}>
                    {t("studyVisual.globalAverage")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    marginTop: 14,
                  }}
                >
                  {average === null ? (
                    <View
                    style={{
                        width: 24,
                        height: 2,
                        borderRadius: 3,
                        backgroundColor: colors.textSecondary,
                        alignSelf: 'center',
                        marginBottom: -22, // sobe a barra para o meio da altura do texto "44"
                      }}
                    />
                  ) : (
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "DMSans_700Bold",
                        fontSize: 44,
                        textAlign: 'center',
                      }}
                    >
                      {average.toFixed(2)}
                    </Text>
                  )}
                  <Text style={[muted, { fontSize: 18 }]}>
                    {" "}
                    / {state.preferences.average_scale}
                  </Text>
                </View>
              {average === null && (
                <Text style={[muted, { marginTop: 8, lineHeight: 20 }]}>
                  {t("studyVisual.chooseModules")}
                </Text>
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <Text style={muted}>{t("studyVisual.scale")}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[10, 20, 100].map((scale) => (
                  <View key={scale}>
                    {chip(
                      "/" + scale,
                      state.preferences.average_scale === scale,
                      () => state.queuePreferences({ average_scale: scale }),
                    )}
                  </View>
                ))}
              </View>
            </View>
            <Text style={[heading, { marginBottom: 7 }]}>
              {t("studyVisual.modules")}
            </Text>
            <Text style={[muted, { lineHeight: 20, marginBottom: 18 }]}>
              {t("update15.averageHelp")}
            </Text>
            {!allSpaces.length && (
              <EmptyState
                icon="school-outline"
                title={t("studyVisual.noModules")}
              />
            )}
            {allSpaces.map((space) => {
              const checked = state.preferences.grade_space_ids.includes(
                space.id,
              );
              const avg = moduleAverages(
                state.grades,
                [space.id],
                state.preferences.average_scale,
              )[0].average;
              return (
                <TouchableOpacity
                  key={space.id}
                  disabled={busy}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => {
                    const current = useStudyStore.getState();
                    const ids = current.preferences.grade_space_ids;
                    current.queuePreferences({ grade_space_ids: ids.includes(space.id)
                      ? ids.filter(id => id !== space.id) : [...ids, space.id] });
                  }}
                  style={[
                    panel,
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 16,
                      marginBottom: 9,
                    },
                  ]}
                >
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={23}
                    color={checked ? colors.primary : colors.textTertiary}
                  />
                  <Text
                    numberOfLines={2}
                    style={[heading, { flex: 1, fontSize: 15 }]}
                  >
                    {space.name}
                  </Text>
                  <Text
                    style={{
                      color: checked ? colors.primary : colors.textSecondary,
                      fontFamily: "DMSans_700Bold",
                      fontSize: 18,
                    }}
                  >
                    {avg === null ? "—" : avg.toFixed(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </>
        ) : tab === "calendar" ? (
          <View onLayout={event => setCalendarWidth(event.nativeEvent.layout.width)} style={splitCalendar ? { flex: 1, minHeight: 0 } : undefined}>
            {splitCalendar && eventFilters}
            <View style={splitCalendar ? { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'stretch', gap: 24 } : undefined}>
            <View style={[panel, splitCalendar && { flex: 1, minWidth: 0, alignSelf: 'flex-start', marginBottom: 0 }]}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <TouchableOpacity
                  accessibilityLabel={t("studyVisual.previousMonth")}
                  onPress={() => changeMonth(-1)}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                <Text style={[heading, { textTransform: "capitalize" }]}>
                  {monthDate.toLocaleDateString(i18n.language, {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
                <TouchableOpacity
                  accessibilityLabel={t("studyVisual.nextMonth")}
                  onPress={() => changeMonth(1)}
                  style={{ padding: 6 }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row" }}>
                {[1, 2, 3, 4, 5, 6, 0].map((n) => (
                  <Text
                    key={n}
                    style={[
                      muted,
                      {
                        width: "14.2857%",
                        textAlign: "center",
                        fontSize: 11,
                        marginBottom: 10,
                      },
                    ]}
                  >
                    {day(n).slice(0, 3)}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from({ length: firstWeekday + daysInMonth }, (_, i) => {
                  const n = i - firstWeekday + 1;
                  const date = `${month}-${String(n).padStart(2, "0")}`;
                  const hasEvents = selectedEvents.some(
                    (e) => e.event_date === date,
                  );
                  return (
                    <View
                      key={i}
                      style={{
                        width: "14.2857%",
                        alignItems: "center",
                        height: 42,
                      }}
                    >
                      {n > 0 && (
                        <TouchableOpacity
                          onPress={() =>
                            setSelectedDate(selectedDate === date ? null : date)
                          }
                          accessibilityState={{
                            selected: selectedDate === date,
                          }}
                          style={{
                            width: 34,
                            height: 38,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            backgroundColor:
                              selectedDate === date
                                ? colors.primary
                                : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              color:
                                selectedDate === date
                                  ? "#fff"
                                  : colors.textPrimary,
                              fontFamily: "DMSans_500Medium",
                            }}
                          >
                            {n}
                          </Text>
                          <View
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              marginTop: 3,
                              backgroundColor: hasEvents
                                ? selectedDate === date
                                  ? "#fff"
                                  : colors.primary
                                : "transparent",
                            }}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={splitCalendar ? { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.surface, borderRadius: 16, padding: 20 } : undefined}>
            {!splitCalendar && eventFilters}
            <Text style={[heading, { marginBottom: 14 }]}>
              {t("studyVisual.events")}
            </Text>
            <EventListContainer style={splitCalendar ? { flex: 1, minHeight: 0 } : undefined}>
            {!eventList.length && (
              <EmptyState
                icon="calendar-outline"
                title={t("studyVisual.noEvents")}
                subtitle={t("studyVisual.eventsHint")}
              />
            )}
            {eventList.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => guardedPush(`/(app)/spaces/${event.space_id}`)}
                style={[
                  panel,
                  { flexDirection: "row", alignItems: "center", gap: 14 },
                  splitCalendar && { backgroundColor: colors.background },
                ]}
              >
                <View
                  style={{
                    backgroundColor: colors.primarySoft,
                    width: 48,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: "DMSans_700Bold",
                      fontSize: 22,
                    }}
                  >
                    {event.event_date.slice(8)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[heading, { fontSize: 15 }]}>{event.title}</Text>
                  <Text style={[muted, { marginTop: 4 }]}>
                    {allSpaces.find((s) => s.id === event.space_id)?.name}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ))}
            </EventListContainer>
            </View>
            </View>
          </View>
        ) : null}
        {mode === 'agenda' && (tab === 'schedule' || schedulePrepared) && (
          <View style={tab === 'schedule' ? { flex: 1, minHeight: 0 } : { display: 'none' }}>
            {state.lessonSyncError && <View style={panel}>
              <Text style={muted}>{t('scheduleQuick.syncError')}</Text>
              <Button title={t('update15.retry')} variant="ghost" onPress={state.retryLessons} />
            </View>}
            <WeekSchedule lessons={state.lessons} spaces={allSpaces} disabled={busy}
              onCreate={createLesson}
              onEdit={editLesson}
              />
          </View>
        )}
      </ScrollView>
      {settingsOpen && <StudyNotificationSettings onClose={() => setSettingsOpen(false)} />}
      {editor && <LessonModal key={editor.id || 'new'} lesson={editor} spaces={allSpaces}
        onClose={() => setEditor(null)} onSave={saveLesson} onDelete={deleteLesson}
        />}
    </SafeAreaView>
  );
}

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { CalendarEvent } from "../stores/calendarStore";
import type { Lesson, StudyPreferences } from "../stores/studyStore";
import i18n from "../i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestStudyNotifications() {
  if (Platform.OS === "web")
    throw new Error(i18n.t("update15.notificationsMobile"));
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("study", {
      name: "OStudy",
      importance: Notifications.AndroidImportance.HIGH,
    });
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return;
  const result = await Notifications.requestPermissionsAsync();
  if (!result.granted) throw new Error(i18n.t("update15.notificationsDenied"));
}
let queue = Promise.resolve();
let requestedSync = 0;
const NOTIFICATION_PREFIX = 'ostudy-study:';
const LEGACY_NOTIFICATION_PREFIX = 'oren-study:';

export function syncStudyNotifications(
  lessons: Lesson[],
  events: CalendarEvent[],
  preferences: StudyPreferences,
) {
  const syncVersion = ++requestedSync;
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (Platform.OS === "web") return;
      // If the user changed 10 → 15 → 30 quickly, only schedule the latest
      // choice instead of running three complete cancel/reschedule passes.
      if (syncVersion !== requestedSync) return;
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const existing = new Map(
        scheduled
          .filter((item) => item.identifier.startsWith(NOTIFICATION_PREFIX)
            || item.identifier.startsWith(LEGACY_NOTIFICATION_PREFIX))
          .map((item) => [item.identifier, item]),
      );
      if (preferences.reminder_minutes === null || !(await Notifications.getPermissionsAsync()).granted) {
        for (const item of existing.values()) {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
          if (syncVersion !== requestedSync) return;
        }
        return;
      }
      const offset = preferences.reminder_minutes;
      const desired = new Set<string>();
      for (const lesson of lessons.slice(0, 50)) {
        if (syncVersion !== requestedSync) return;
        const identifier = `${NOTIFICATION_PREFIX}lesson:${lesson.id}`;
        desired.add(identifier);
        const [hour, minute] = lesson.start_time.split(":").map(Number);
        const shifted = lesson.weekday * 1440 + hour * 60 + minute - offset;
        const minuteOfWeek = ((shifted % 10080) + 10080) % 10080;
        const content = {
          title: lesson.title,
          body: `${lesson.room ? lesson.room + " · " : ""}${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}`,
          data: { route: "/agenda" },
        };
        const trigger = {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY as const,
          weekday: Math.floor(minuteOfWeek / 1440) + 1,
          hour: Math.floor((minuteOfWeek % 1440) / 60),
          minute: minuteOfWeek % 60,
          channelId: "study",
        };
        const old = existing.get(identifier);
        const oldTrigger = old?.trigger as (typeof trigger & { type?: string }) | undefined;
        const sameTrigger = oldTrigger?.weekday === trigger.weekday
          && oldTrigger.hour === trigger.hour
          && oldTrigger.minute === trigger.minute
          && oldTrigger.channelId === trigger.channelId;
        if (old && old.content.title === content.title && old.content.body === content.body && sameTrigger) {
          existing.delete(identifier);
          continue;
        }
        if (old) {
          await Notifications.cancelScheduledNotificationAsync(identifier);
          if (syncVersion !== requestedSync) return;
        }
        await Notifications.scheduleNotificationAsync({ identifier, content, trigger });
      }
      for (const event of events) {
        if (syncVersion !== requestedSync) return;
        const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.event_date);
        if (!dateParts) continue;
        const [, yearText, monthText, dayText] = dateParts;
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        const fireAt = new Date(year, month - 1, day, preferences.event_reminder_hour);
        if (
          fireAt.getFullYear() !== year ||
          fireAt.getMonth() !== month - 1 ||
          fireAt.getDate() !== day
        ) continue;
        fireAt.setMinutes(fireAt.getMinutes() - offset);
        if (fireAt.getTime() <= Date.now()) continue;

        const identifier = `${NOTIFICATION_PREFIX}event:${event.id}`;
        desired.add(identifier);
        const content = {
          title: event.title,
          body: `${i18n.t(`calendar.types.${event.type}`)} · ${new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(year, month - 1, day))}`,
          data: { route: "/agenda" },
        };
        const trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE as const,
          date: fireAt,
          channelId: "study",
        };
        const old = existing.get(identifier);
        const oldTrigger = old?.trigger as (typeof trigger & { type?: string }) | undefined;
        const oldDateValue = oldTrigger?.date;
        const oldDate = oldDateValue instanceof Date
          ? oldDateValue.getTime()
          : typeof oldDateValue === 'number'
            ? oldDateValue
            : Number.NaN;
        const sameTrigger = oldTrigger?.type === trigger.type
          && oldDate === fireAt.getTime()
          && oldTrigger.channelId === trigger.channelId;
        if (old && old.content.title === content.title && old.content.body === content.body && sameTrigger) {
          existing.delete(identifier);
          continue;
        }
        if (old) {
          await Notifications.cancelScheduledNotificationAsync(identifier);
          if (syncVersion !== requestedSync) return;
        }
        await Notifications.scheduleNotificationAsync({ identifier, content, trigger });
      }
      for (const identifier of existing.keys()) {
        if (desired.has(identifier)) continue;
        await Notifications.cancelScheduledNotificationAsync(identifier);
        if (syncVersion !== requestedSync) return;
      }
    });
  return queue;
}

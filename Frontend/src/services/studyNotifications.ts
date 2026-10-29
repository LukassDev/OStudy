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
export function syncStudyNotifications(
  lessons: Lesson[],
  _events: CalendarEvent[],
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
          .filter((item) => item.identifier.startsWith("oren-study:"))
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
      // Weekly triggers continue working while the app is closed, without a server.
      const desired = new Set<string>();
      for (const lesson of lessons.slice(0, 50)) {
        if (syncVersion !== requestedSync) return;
        const identifier = `oren-study:lesson:${lesson.id}`;
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
      for (const identifier of existing.keys()) {
        if (desired.has(identifier)) continue;
        await Notifications.cancelScheduledNotificationAsync(identifier);
        if (syncVersion !== requestedSync) return;
      }
    });
  return queue;
}

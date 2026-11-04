import {
  createCalendarEvent,
  listCalendarEvents,
  listIgnoredClassroomEventIds,
  updateCalendarEvent,
} from '../../db/repositories/calendar.repo';
import { listSpaces } from '../../db/repositories/spaces.repo';
import { useStudyStore } from '../../stores/studyStore';
import { listCourseWork } from './api';
import { ClassroomNotConnectedError } from './auth';

function toIsoDate(date?: { year?: number; month?: number; day?: number }): string | null {
  if (!date || !date.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function toEventType(workType?: string): 'exam' | 'assignment' | 'session' | 'other' {
  if (workType === 'ASSIGNMENT') return 'assignment';
  if (workType === 'SHORT_ANSWER_QUESTION' || workType === 'MULTIPLE_CHOICE_QUESTION') return 'exam';
  return 'other';
}

export async function syncSpace(spaceId: string): Promise<void> {
  const spaces = await listSpaces();
  const space = spaces.find(item => item.id === spaceId);
  const courseId = space?.google_classroom_course_id;
  if (!courseId) return;

  const courseWork = await listCourseWork(courseId);
  const existing = await listCalendarEvents(spaceId);
  const existingById = new Map(existing.map(event => [event.id, event]));
  const ignoredEventIds = new Set(await listIgnoredClassroomEventIds());

  for (const work of courseWork) {
    const eventDate = toIsoDate(work.dueDate);
    if (!eventDate || !work.title) continue;
    const eventId = `classroom:${work.id}`;
    if (ignoredEventIds.has(eventId)) continue;
    const eventType = toEventType(work.workType);
    const payload = {
      id: eventId,
      space_id: spaceId,
      title: work.title,
      type: eventType,
      event_date: eventDate,
    };

    if (existingById.has(eventId)) {
      const current = existingById.get(eventId)!;
      if (current.title !== work.title || current.event_date !== eventDate || current.type !== eventType) {
        await updateCalendarEvent(eventId, spaceId, { title: work.title, type: eventType, event_date: eventDate });
      }
    } else {
      await createCalendarEvent(payload);
    }
  }

  await useStudyStore.getState().refreshLoaded(['events']);
}

export async function syncAllConnectedSpaces(): Promise<void> {
  const spaces = await listSpaces();
  for (const space of spaces) {
    if (!space.google_classroom_course_id) continue;
    try {
      await syncSpace(space.id);
    } catch (error) {
      if (error instanceof ClassroomNotConnectedError) continue;
      console.warn(`Could not sync classroom space ${space.id}:`, error);
    }
  }
}

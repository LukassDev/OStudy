import type { Lesson } from '../../stores/studyStore';
import { minutes } from './lessonHelpers';

// Assign overlapping lessons separate lanes instead of covering each other.
export function layoutDay(lessons: Lesson[]) {
  const sorted = [...lessons].sort((a, b) => minutes(a.start_time) - minutes(b.start_time));
  const placed: { lesson: Lesson; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const finish = () => cluster.forEach(item => { item.lanes = ends.length; });
  for (const lesson of sorted) {
    const start = minutes(lesson.start_time);
    const end = minutes(lesson.end_time);
    if (start >= clusterEnd) { finish(); cluster = []; ends = []; }
    let lane = ends.findIndex(value => value <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = end;
    const item = { lesson, lane, lanes: 1 };
    placed.push(item); cluster.push(item);
    clusterEnd = Math.max(...ends);
  }
  finish();
  return placed;
}


// Keep all 24 hours available; only the initial scroll position changes.
export function earliestLessonMinute(lessons: Lesson[]) {
  const starts = lessons.filter(l => Number.isFinite(minutes(l.start_time)) && Number.isFinite(minutes(l.end_time))
    && minutes(l.start_time) >= 0 && minutes(l.end_time) <= 1440 && minutes(l.end_time) > minutes(l.start_time))
    .map(l => minutes(l.start_time));
  return starts.length ? Math.min(...starts) : 8 * 60;
}

// Keep a small buffer around the viewport while retaining the full day's scroll height.
export function visibleScheduleHours(offset: number, height: number, hourHeight: number) {
  const start = Math.max(0, Math.min(23, Math.floor(Math.max(0, offset) / hourHeight) - 2));
  const end = Math.min(24, Math.max(start + 1, Math.ceil((Math.max(0, offset) + Math.max(1, height)) / hourHeight) + 2));
  return { start, end };
}

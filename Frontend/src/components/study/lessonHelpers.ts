import type { Lesson } from '../../stores/studyStore';

export type LessonDraft = Omit<Lesson, 'id'>;
export const lessonKey = (l: LessonDraft) => [l.title.trim().toLowerCase(), l.weekday, l.start_time.slice(0, 5), l.end_time.slice(0, 5)].join('|');
export function newLessons(rows: LessonDraft[], existing: Lesson[]): LessonDraft[] {
  const keys = new Set(existing.map(lessonKey));
  return rows.filter(row => {
    const key = lessonKey(row);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}
export function overlaps(rows: LessonDraft[], existing: Lesson[], excludeId = '') {
  return existing.filter(l => l.id !== excludeId && rows.some(row => row.weekday === l.weekday
    && row.start_time.slice(0, 5) < l.end_time.slice(0, 5) && row.end_time.slice(0, 5) > l.start_time.slice(0, 5)));
}
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeOf = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

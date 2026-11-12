import { create } from 'zustand';
import type { Grade } from './gradesStore';
import type { CalendarEvent } from './calendarStore';
import {
  listAllCalendarEvents,
} from '../db/repositories/calendar.repo';
import { listAllGrades, listGradeModules } from '../db/repositories/grades.repo';
import { subjectAverage, subjectIncludesEstimates, type GradeModule } from '../utils/gradeAverages';
import {
  deleteLesson as removeLesson,
  getStudyPreferences,
  listLessons,
  saveLessons as persistLessons,
  saveStudyPreferences,
  updateLesson as persistLesson,
  type LocalLesson,
} from '../db/repositories/study.repo';
import { syncStudyNotifications } from '../services/studyNotifications';

export interface Lesson extends LocalLesson {
  user_id?: string;
}

export interface StudyPreferences {
  show_grades: boolean;
  grade_space_ids: string[];
  average_scale: number;
  show_schedule_card: boolean;
  reminder_minutes: number | null;
  event_reminder_hour: number;
}

export const defaultPreferences: StudyPreferences = {
  show_grades: false,
  grade_space_ids: [],
  average_scale: 20,
  show_schedule_card: true,
  reminder_minutes: null,
  event_reminder_hour: 9,
};

export function moduleAverages(grades: Grade[], ids: string[], scale: number, modules: GradeModule[] = []) {
  return [...new Set(ids)].map(id => ({ id, average: subjectAverage(grades, modules, id, scale) }));
}

export function overallAverage(grades: Grade[], preferences: StudyPreferences, modules: GradeModule[] = []) {
  const values = moduleAverages(grades, preferences.grade_space_ids, preferences.average_scale, modules)
    .flatMap((module) => module.average === null ? [] : [module.average]);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function overallIncludesEstimates(grades: Grade[], preferences: StudyPreferences, modules: GradeModule[] = []) {
  return preferences.grade_space_ids.some(id => subjectIncludesEstimates(grades, modules, id));
}

export type StudySection = 'lessons' | 'preferences' | 'events' | 'grades';
const allSections: StudySection[] = ['lessons', 'preferences', 'events', 'grades'];
const loadedSections = new Set<StudySection>();
let loadEpoch = 0;
let lessonQueue: Promise<void> = Promise.resolve();
let preferenceTimer: ReturnType<typeof setTimeout> | undefined;

interface StudyState {
  lessonSyncError: boolean;
  retryLessons: () => void;
  events: CalendarEvent[];
  grades: Grade[];
  gradeModules: GradeModule[];
  lessons: Lesson[];
  preferences: StudyPreferences;
  loading: boolean;
  hydrated: boolean;
  error: string | null;
  load: (force?: boolean, sections?: StudySection[]) => Promise<void>;
  refreshLoaded: (sections: StudySection[]) => Promise<void>;
  reset: () => void;
  savePreferences: (changes: Partial<StudyPreferences>) => Promise<void>;
  queuePreferences: (changes: Partial<StudyPreferences>) => void;
  flushPreferences: () => Promise<void>;
  saveLessons: (lessons: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  updateLesson: (lesson: Lesson) => Promise<void>;
  deleteLesson: (id: string) => Promise<void>;
}

function syncNotificationsIfReady(get: () => StudyState) {
  if (!['lessons', 'events', 'preferences'].every((section) => loadedSections.has(section as StudySection))) return;
  const state = get();
  void syncStudyNotifications(state.lessons, state.events, state.preferences).catch((error) => {
    console.error('Could not synchronize study notifications:', error);
  });
}

function updateHydration(set: (partial: Partial<StudyState>) => void) {
  set({
    hydrated: loadedSections.has('lessons') && loadedSections.has('preferences'),
    loading: false,
  });
}

export const useStudyStore = create<StudyState>((set, get) => ({
  lessonSyncError: false,
  retryLessons: () => {
    set({ lessonSyncError: false });
    void get().load(true, ['lessons']);
  },
  events: [],
  grades: [],
  gradeModules: [],
  lessons: [],
  preferences: defaultPreferences,
  loading: false,
  hydrated: false,
  error: null,

  reset: () => {
    loadEpoch++;
    loadedSections.clear();
    clearTimeout(preferenceTimer);
    lessonQueue = Promise.resolve();
    set({
      lessonSyncError: false, events: [], grades: [], gradeModules: [], lessons: [],
      preferences: defaultPreferences, loading: false, hydrated: false, error: null,
    });
  },

  refreshLoaded: async (sections) => {
    const visible = sections.filter((section) => loadedSections.has(section));
    if (visible.length) await get().load(true, visible);
  },

  load: async (force = false, sections = allSections) => {
    const epoch = loadEpoch;
    set({ error: null });
    const pending = sections.filter((section) => force || !loadedSections.has(section));
    if (!pending.length) return;
    set({ loading: true });
    try {
      const results = await Promise.all(pending.map(async (section) => {
        if (section === 'lessons') return [section, await listLessons()] as const;
        if (section === 'preferences') return [section, await getStudyPreferences(defaultPreferences)] as const;
        if (section === 'events') return [section, await listAllCalendarEvents()] as const;
        const [grades, modules] = await Promise.all([listAllGrades(), listGradeModules()]);
        return [section, { grades, modules }] as const;
      }));
      if (epoch !== loadEpoch) return;
      for (const [section, value] of results) {
        loadedSections.add(section);
        if (section === 'lessons') set({ lessons: value as Lesson[] });
        else if (section === 'preferences') set({ preferences: { ...defaultPreferences, ...(value as Partial<StudyPreferences>) } });
        else if (section === 'events') set({ events: value as CalendarEvent[] });
        else {
          const data = value as { grades: Grade[]; modules: GradeModule[] };
          set({ grades: data.grades, gradeModules: data.modules });
        }
      }
      updateHydration(set);
      syncNotificationsIfReady(get);
    } catch (error) {
      if (epoch === loadEpoch) {
        set({ error: String((error as Error).message || error), loading: false });
        console.error('Could not load local study data:', error);
      }
    }
  },

  queuePreferences: (changes) => {
    const preferences = { ...get().preferences, ...changes };
    set({ preferences });
    syncNotificationsIfReady(get);
    clearTimeout(preferenceTimer);
    preferenceTimer = setTimeout(() => { void get().flushPreferences(); }, 250);
  },

  flushPreferences: async () => {
    clearTimeout(preferenceTimer);
    try {
      await saveStudyPreferences(get().preferences);
      loadedSections.add('preferences');
      updateHydration(set);
    } catch (error) {
      set({ error: String((error as Error).message || error) });
      throw error;
    }
  },

  savePreferences: async (changes) => {
    get().queuePreferences(changes);
    await get().flushPreferences();
  },

  saveLessons: async (lessons) => {
    const current = get().lessons;
    const existing = new Set(current.map((lesson) => [
      lesson.title.trim().toLowerCase(), lesson.weekday,
      lesson.start_time.slice(0, 5), lesson.end_time.slice(0, 5),
    ].join('|')));
    const unique = lessons.filter((lesson) => {
      const key = [
        lesson.title.trim().toLowerCase(), lesson.weekday,
        lesson.start_time.slice(0, 5), lesson.end_time.slice(0, 5),
      ].join('|');
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    }).map((lesson) => ({ ...lesson, title: lesson.title.trim() }));
    if (!unique.length) return;
    const save = lessonQueue.then(async () => {
      await persistLessons(unique);
      const updated = await listLessons();
      set({ lessons: updated, lessonSyncError: false });
      loadedSections.add('lessons');
      updateHydration(set);
      syncNotificationsIfReady(get);
    });
    lessonQueue = save.catch((error) => {
      set({ lessonSyncError: true, error: String((error as Error).message || error) });
      console.error('Could not save local lessons:', error);
    });
    await save;
  },

  updateLesson: async (lesson) => {
    await persistLesson(lesson);
    const lessons = await listLessons();
    set({ lessons: lessons });
    syncNotificationsIfReady(get);
  },

  deleteLesson: async (id) => {
    await removeLesson(id);
    const lessons = await listLessons();
    set({ lessons });
    syncNotificationsIfReady(get);
  },
}));

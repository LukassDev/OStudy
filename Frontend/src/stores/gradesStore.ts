import { create } from 'zustand';
import { getSetting, setSetting } from '../db/repositories/settings.repo';
import {
  createGrade as insertGrade,
  deleteGrade as removeGrade,
  listGrades,
  updateGrade as persistGrade,
  listGradeModules,
  saveGradeModule as persistModule,
  deleteGradeModule as removeModule,
} from '../db/repositories/grades.repo';
import { useStudyStore } from './studyStore';
import { subjectAverage, type GradeModule, type AssessmentType, type QualitativeGrade } from '../utils/gradeAverages';

export interface Grade {
  id: string;
  space_id: string;
  title: string;
  score: number;
  max_score: number;
  weight: number;
  module_id?: string | null;
  category_id?: AssessmentType | null;
  qualitative_value?: QualitativeGrade | null;
  topic_id: string | null;
  graded_at: string;
  created_at?: string;
  updated_at?: string;
}

interface GradesState {
  loadedSpaceId: string | null;
  grades: Grade[];
  modules: GradeModule[];
  saveModule: (module: GradeModule) => Promise<void>;
  deleteModule: (id: string, spaceId: string) => Promise<void>;
  loading: boolean;
  averageScale: number;
  setAverageScale: (scale: number) => void;
  fetchGrades: (spaceId: string) => Promise<void>;
  createGrade: (data: Omit<Grade, 'id'>) => Promise<void>;
  updateGrade: (id: string, spaceId: string, data: Partial<Grade>) => Promise<void>;
  deleteGrade: (id: string, spaceId: string) => Promise<void>;
  weightedAverage: () => number | null;
}

let fetchVersion = 0;

export const useGradesStore = create<GradesState>((set, get) => ({
  loadedSpaceId: null,
  grades: [],
  modules: [],
  loading: false,
  averageScale: 20,

  setAverageScale: (scale) => {
    if (!Number.isFinite(scale) || scale <= 0) return;
    set({ averageScale: scale });
    void setSetting('grades.averageScale', scale).catch((error) => {
      console.error('Could not save the local grade scale:', error);
    });
  },

  fetchGrades: async (spaceId) => {
    const version = ++fetchVersion;
    if (get().loadedSpaceId !== spaceId) set({ grades: [], modules: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const [grades, averageScale, modules] = await Promise.all([
        listGrades(spaceId),
        getSetting('grades.averageScale', 20),
        listGradeModules(spaceId),
      ]);
      if (version === fetchVersion) set({
        grades,
        modules,
        averageScale: Number.isFinite(averageScale) && averageScale > 0 ? averageScale : 20,
        loadedSpaceId: spaceId,
        loading: false,
      });
    } catch (error) {
      console.error('Could not load local grades:', error);
      if (version === fetchVersion) set({ loading: false });
      throw error;
    }
  },

  saveModule: async (module) => {
    await persistModule(module);
    await Promise.all([get().fetchGrades(module.space_id), useStudyStore.getState().load(true, ['grades'])]);
  },

  deleteModule: async (id, spaceId) => {
    await removeModule(id, spaceId);
    await Promise.all([get().fetchGrades(spaceId), useStudyStore.getState().load(true, ['grades'])]);
  },

  createGrade: async (data) => {
    await insertGrade(data);
    await Promise.all([
      get().fetchGrades(data.space_id),
      useStudyStore.getState().load(true, ['grades']),
    ]);
  },

  updateGrade: async (id, spaceId, data) => {
    await persistGrade(id, spaceId, data);
    await Promise.all([
      get().fetchGrades(spaceId),
      useStudyStore.getState().load(true, ['grades']),
    ]);
  },

  deleteGrade: async (id, spaceId) => {
    await removeGrade(id, spaceId);
    await Promise.all([
      get().fetchGrades(spaceId),
      useStudyStore.getState().load(true, ['grades']),
    ]);
  },

  weightedAverage: () => {
    const { grades, modules, averageScale, loadedSpaceId } = get();
    return loadedSpaceId ? subjectAverage(grades, modules, loadedSpaceId, averageScale) : null;
  },
}));

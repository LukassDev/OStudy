import { create } from 'zustand';
import { getSetting, setSetting } from '../db/repositories/settings.repo';
import {
  createGrade as insertGrade,
  deleteGrade as removeGrade,
  listGrades,
  updateGrade as persistGrade,
} from '../db/repositories/grades.repo';

export interface Grade {
  id: string;
  space_id: string;
  title: string;
  score: number;
  max_score: number;
  weight: number;
  topic_id: string | null;
  graded_at: string;
  created_at?: string;
  updated_at?: string;
}

interface GradesState {
  loadedSpaceId: string | null;
  grades: Grade[];
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
    if (get().loadedSpaceId !== spaceId) set({ grades: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const [grades, averageScale] = await Promise.all([
        listGrades(spaceId),
        getSetting('grades.averageScale', 20),
      ]);
      if (version === fetchVersion) set({
        grades,
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

  createGrade: async (data) => {
    await insertGrade(data);
    await get().fetchGrades(data.space_id);
  },

  updateGrade: async (id, spaceId, data) => {
    await persistGrade(id, spaceId, data);
    await get().fetchGrades(spaceId);
  },

  deleteGrade: async (id, spaceId) => {
    await removeGrade(id, spaceId);
    await get().fetchGrades(spaceId);
  },

  weightedAverage: () => {
    const { grades, averageScale } = get();
    if (!grades.length) return null;
    const totalWeight = grades.reduce((sum, grade) => sum + grade.weight, 0);
    if (!totalWeight) return null;
    return grades.reduce(
      (sum, grade) => sum + (grade.score / grade.max_score) * averageScale * grade.weight,
      0,
    ) / totalWeight;
  },
}));

import { create } from 'zustand';
import { listPlanModules, type ContentTopicRow } from '../db/repositories/content.repo';
import { getStudentGoal } from '../db/repositories/study.repo';
import { applyPendingReviews, saveTopicReviews, topicReviewRevision } from '../services/topicReviews';

export interface PlanModule {
  id: string;
  title: string;
  summary: string | null;
  last_reviewed_at: string | null;
}

interface PlanState {
  loadedSpaceId: string | null;
  goal: string | null;
  modules: PlanModule[];
  loading: boolean;
  fetchPlan: (spaceId: string) => Promise<void>;
  markModuleReviewed: (id: string, spaceId: string) => Promise<void>;
}

let fetchVersion = 0;

export const usePlanStore = create<PlanState>((set, get) => ({
  loadedSpaceId: null,
  goal: null,
  modules: [],
  loading: false,

  fetchPlan: async (spaceId) => {
    const version = ++fetchVersion;
    const reviewRevision = topicReviewRevision(spaceId);
    if (get().loadedSpaceId !== spaceId) set({ goal: null, modules: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const [goal, rows] = await Promise.all([getStudentGoal(spaceId), listPlanModules(spaceId)]);
      if (version !== fetchVersion) return;
      if (reviewRevision !== topicReviewRevision(spaceId)) {
        await get().fetchPlan(spaceId);
        return;
      }
      set({ goal, modules: applyPendingReviews(spaceId, rows).map(toPlanModule), loadedSpaceId: spaceId, loading: false });
    } catch (error) {
      console.error('Could not load the local study plan:', error);
      if (version === fetchVersion) set({ loading: false });
      throw error;
    }
  },

  markModuleReviewed: async (id, spaceId) => {
    if (get().loadedSpaceId !== spaceId) return;
    const current = get().modules.find((module) => module.id === id);
    if (!current) return;
    const reviewedAt = current.last_reviewed_at ? null : new Date().toISOString();
    set({ modules: get().modules.map((module) =>
      module.id === id ? { ...module, last_reviewed_at: reviewedAt } : module,
    ) });
    try {
      await saveTopicReviews(spaceId, new Map([[id, reviewedAt]]));
    } catch (error) {
      console.error('Could not save local plan review status:', error);
      if (get().loadedSpaceId === spaceId) await get().fetchPlan(spaceId);
      throw error;
    }
  },
}));

function toPlanModule(row: ContentTopicRow): PlanModule {
  return { id: row.id, title: row.title, summary: row.summary, last_reviewed_at: row.last_reviewed_at };
}

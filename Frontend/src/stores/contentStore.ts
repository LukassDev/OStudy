import { create } from 'zustand';
import {
  createContentTopic,
  deleteContentTopic,
  listContentTopics,
  updateContentTopic,
  type ContentTopicRow,
} from '../db/repositories/content.repo';
import { applyPendingReviews, saveTopicReviews, topicReviewRevision } from '../services/topicReviews';

export interface Topic extends ContentTopicRow {
  importance: 'low' | 'medium' | 'high';
  children?: Topic[];
}

interface ContentState {
  loadedSpaceId: string | null;
  topics: Topic[];
  loading: boolean;
  fetchTopics: (spaceId: string) => Promise<void>;
  createTopic: (data: Partial<Topic> & { space_id: string }) => Promise<void>;
  updateTopic: (id: string, spaceId: string, data: Partial<Topic>) => Promise<void>;
  deleteTopic: (id: string, spaceId: string) => Promise<void>;
  markReviewed: (id: string, spaceId: string) => Promise<void>;
  findTopic: (id: string) => Topic | null;
}

let fetchVersion = 0;

export const useContentStore = create<ContentState>((set, get) => ({
  loadedSpaceId: null,
  topics: [],
  loading: false,

  fetchTopics: async (spaceId) => {
    const version = ++fetchVersion;
    const reviewRevision = topicReviewRevision(spaceId);
    if (get().loadedSpaceId !== spaceId) set({ topics: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const rows = await listContentTopics(spaceId);
      if (version !== fetchVersion) return;
      if (reviewRevision !== topicReviewRevision(spaceId)) {
        await get().fetchTopics(spaceId);
        return;
      }
      set({ topics: buildTree(applyPendingReviews(spaceId, rows)), loadedSpaceId: spaceId, loading: false });
    } catch (error) {
      console.error('Could not load local content topics:', error);
      if (version === fetchVersion) set({ loading: false });
      throw error;
    }
  },

  createTopic: async (data) => {
    if (!data.title) throw new Error('O tópico precisa de um título.');
    await createContentTopic({
      space_id: data.space_id,
      parent_id: data.parent_id ?? null,
      title: data.title,
      summary: data.summary ?? null,
      importance: data.importance ?? 'medium',
    });
    await get().fetchTopics(data.space_id);
  },

  updateTopic: async (id, spaceId, data) => {
    await updateContentTopic(id, spaceId, data);
    await get().fetchTopics(spaceId);
  },

  deleteTopic: async (id, spaceId) => {
    await deleteContentTopic(id, spaceId);
    await get().fetchTopics(spaceId);
  },

  markReviewed: async (id, spaceId) => {
    if (get().loadedSpaceId !== spaceId) return;
    const topic = get().findTopic(id);
    if (!topic) return;
    const reviewedAt = topic.last_reviewed_at ? null : new Date().toISOString();
    const changedAt = new Map<string, string | null>();

    const updateTree = (nodes: Topic[]): Topic[] => nodes.map((node) => {
      if (node.id === id) {
        const updated = markDescendants(node, reviewedAt, changedAt);
        changedAt.set(node.id, reviewedAt);
        return updated;
      }
      return node.children?.length ? { ...node, children: updateTree(node.children) } : node;
    });

    let updatedTopics = updateTree(get().topics);
    const parents = new Map<string, Topic>();
    indexParents(updatedTopics, null, parents);
    let parent = parents.get(id);
    while (parent) {
      const children = parent.children || [];
      const parentReviewedAt = children.length > 0 && children.every((child) => !!child.last_reviewed_at)
        ? reviewedAt || new Date().toISOString()
        : null;
      if (parent.last_reviewed_at !== parentReviewedAt) {
        updatedTopics = updateTopicReview(updatedTopics, parent.id, parentReviewedAt);
        changedAt.set(parent.id, parentReviewedAt);
      }
      parent = parents.get(parent.id);
    }
    set({ topics: updatedTopics });
    try {
      await saveTopicReviews(spaceId, changedAt);
    } catch (error) {
      console.error('Could not save local topic review status:', error);
      if (get().loadedSpaceId === spaceId) await get().fetchTopics(spaceId);
      throw error;
    }
  },

  findTopic: (id) => {
    const search = (nodes: Topic[]): Topic | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = node.children?.length ? search(node.children) : null;
        if (found) return found;
      }
      return null;
    };
    return search(get().topics);
  },
}));

function markDescendants(topic: Topic, reviewedAt: string | null, changedAt: Map<string, string | null>): Topic {
  const children = topic.children?.map((child) => {
    changedAt.set(child.id, reviewedAt);
    return markDescendants(child, reviewedAt, changedAt);
  });
  return { ...topic, last_reviewed_at: reviewedAt, ...(children ? { children } : {}) };
}

function indexParents(nodes: Topic[], parent: Topic | null, parentByChild: Map<string, Topic>) {
  nodes.forEach((node) => {
    if (parent) parentByChild.set(node.id, parent);
    if (node.children) indexParents(node.children, node, parentByChild);
  });
}

function updateTopicReview(nodes: Topic[], id: string, reviewedAt: string | null): Topic[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, last_reviewed_at: reviewedAt };
    return node.children?.length ? { ...node, children: updateTopicReview(node.children, id, reviewedAt) } : node;
  });
}

function buildTree(rows: ContentTopicRow[]): Topic[] {
  const map: Record<string, Topic> = {};
  const roots: Topic[] = [];
  rows.forEach((row) => { map[row.id] = { ...row, importance: row.importance as Topic['importance'], children: [] }; });
  rows.forEach((row) => {
    const node = map[row.id];
    if (row.parent_id && map[row.parent_id]) map[row.parent_id].children!.push(node);
    else roots.push(node);
  });
  return roots;
}

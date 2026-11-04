import { updateTopicReviews } from '../db/repositories/content.repo';

const queues = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
const pending = new Map<string, Map<string, { value: string | null; token: object }>>();

export const topicReviewRevision = (spaceId: string): number => revisions.get(spaceId) || 0;
const changed = (spaceId: string) => revisions.set(spaceId, topicReviewRevision(spaceId) + 1);

export function applyPendingReviews<T extends { id: string; last_reviewed_at: string | null }>(
  spaceId: string,
  rows: T[],
): T[] {
  const values = pending.get(spaceId);
  return rows.map((row) => {
    const entry = values?.get(row.id);
    return entry ? { ...row, last_reviewed_at: entry.value } : row;
  });
}

export function saveTopicReviews(spaceId: string, changes: Map<string, string | null>): Promise<void> {
  const token = {};
  const values = pending.get(spaceId) || new Map();
  pending.set(spaceId, values);
  changes.forEach((value, id) => values.set(id, { value, token }));
  changed(spaceId);
  const save = (queues.get(spaceId) || Promise.resolve()).then(async () => {
    try {
      await updateTopicReviews(spaceId, changes);
    } finally {
      changes.forEach((_value, id) => {
        if (values.get(id)?.token === token) values.delete(id);
      });
      if (!values.size) pending.delete(spaceId);
      changed(spaceId);
    }
  });
  const settled = save.catch(() => {});
  queues.set(spaceId, settled);
  void settled.then(() => {
    if (queues.get(spaceId) === settled) queues.delete(spaceId);
  });
  return save;
}

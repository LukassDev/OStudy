import { create } from 'zustand';
import i18n from '../i18n';
import {
  createSpace as insertSpace,
  deleteSpace as removeSpace,
  listSpaces,
  updateSpace as persistSpace,
  updateSpaceOrder,
  type SpaceRow,
} from '../db/repositories/spaces.repo';
import { listResources } from '../db/repositories/resources.repo';
import { listChats, listMessages } from '../db/repositories/chats.repo';
import { deleteLocalFile } from '../services/localFiles';

export interface Space {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string;
  color: string;
  is_favorite: boolean;
  position?: number;
  depth?: number;
  children?: Space[];
}

interface SpaceState {
  spaces: Space[];
  loading: boolean;
  expandedIds: Set<string>;
  hydrated: boolean;
  reset: () => void;
  fetchSpaces: (force?: boolean) => Promise<void>;
  reorderSpaces: (ids: string[]) => Promise<void>;
  moveSpace: (id: string, direction: number) => Promise<void>;
  toggleExpand: (id: string) => void;
  createSpace: (data: Partial<Space>) => Promise<Space>;
  updateSpace: (id: string, data: Partial<Space>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  findSpace: (id: string) => Space | null;
  getBreadcrumb: (id: string) => Space[];
  countDescendants: (id: string) => number;
  getFavorites: () => Space[];
}

let spacesFetchPromise: Promise<void> | null = null;
let spacesEpoch = 0;
let pendingOrders = 0;
let confirmedOrder: string[] = [];

function toSpace(row: SpaceRow): Space {
  return { ...row, is_favorite: row.is_favorite === 1, children: [] };
}

function orderRoots(spaces: Space[], ids: string[]): Space[] {
  const rank = new Map(ids.map((id, index) => [id, index]));
  return [...spaces]
    .sort((a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length))
    .map((space, position) => ({ ...space, position }));
}

function buildTree(rows: SpaceRow[]): Space[] {
  const map: Record<string, Space> = {};
  const roots: Space[] = [];
  rows.forEach((row) => { map[row.id] = toSpace(row); });
  rows.forEach((row) => {
    const node = map[row.id];
    if (row.parent_id && map[row.parent_id]) map[row.parent_id].children!.push(node);
    else roots.push(node);
  });
  return roots;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  loading: false,
  expandedIds: new Set(),
  hydrated: false,
  reset: () => {
    spacesEpoch++;
    spacesFetchPromise = null;
    pendingOrders = 0;
    confirmedOrder = [];
    set({ spaces: [], loading: false, hydrated: false, expandedIds: new Set() });
  },
  fetchSpaces: (force = false) => {
    if (spacesFetchPromise) return spacesFetchPromise;
    if (!force && get().hydrated) return Promise.resolve();
    const epoch = spacesEpoch;
    set({ loading: !get().hydrated });
    const request = (async () => {
      try {
        const rows = await listSpaces();
        if (epoch !== spacesEpoch) return;
        const tree = buildTree(rows);
        const next = pendingOrders ? orderRoots(tree, get().spaces.map((space) => space.id)) : tree;
        set({ spaces: next, hydrated: true, loading: false });
      } catch (error) {
        if (epoch === spacesEpoch) set({ loading: false });
        throw error;
      }
    })();
    spacesFetchPromise = request.finally(() => {
      if (epoch === spacesEpoch) spacesFetchPromise = null;
    });
    return spacesFetchPromise;
  },

  reorderSpaces: async (ids) => {
    const current = get().spaces;
    if (ids.length !== current.length || ids.some((id) => !current.some((space) => space.id === id))) {
      throw new Error('A ordem dos Spaces não corresponde à lista atual.');
    }
    if (!pendingOrders) confirmedOrder = current.map((space) => space.id);
    pendingOrders++;
    set({ spaces: orderRoots(current, ids) });
    try {
      await updateSpaceOrder(ids, null);
      confirmedOrder = ids;
    } catch (error) {
      set({ spaces: orderRoots(get().spaces, confirmedOrder) });
      throw error;
    } finally {
      pendingOrders--;
    }
  },

  moveSpace: async (id, direction) => {
    const target = get().findSpace(id);
    if (!target) return;
    const siblings = target.parent_id ? get().findSpace(target.parent_id)?.children || [] : get().spaces;
    const ids = siblings.map((space) => space.id);
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await updateSpaceOrder(ids, target.parent_id);
    await get().fetchSpaces(true);
  },

  toggleExpand: (id) => {
    const next = new Set(get().expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ expandedIds: next });
  },

  createSpace: async (data) => {
    const created = await insertSpace({
      name: data.name?.trim() || i18n.t('spaces.form.newSpaceTitle'),
      parent_id: data.parent_id ?? null,
      icon: data.icon || 'folder-outline',
      color: data.color || 'blue',
      is_favorite: data.is_favorite ?? false,
    });
    await get().fetchSpaces(true);
    return get().findSpace(created.id) || toSpace(created);
  },

  updateSpace: async (id, data) => {
    await persistSpace(id, {
      parent_id: data.parent_id,
      name: data.name,
      icon: data.icon,
      color: data.color,
      is_favorite: data.is_favorite === undefined ? undefined : Number(data.is_favorite),
      position: data.position,
    });
    await get().fetchSpaces(true);
  },

  deleteSpace: async (id) => {
    const rows = await listSpaces();
    const descendantIds = new Set([id]);
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      for (const row of rows) {
        if (row.parent_id && descendantIds.has(row.parent_id) && !descendantIds.has(row.id)) {
          descendantIds.add(row.id);
          foundDescendant = true;
        }
      }
    }
    for (const spaceId of descendantIds) {
      for (const resource of await listResources(spaceId)) await deleteLocalFile(resource.file_uri);
      for (const chat of await listChats(spaceId)) {
        for (const message of await listMessages(chat.id)) {
          for (const attachment of message.attachments) await deleteLocalFile(attachment.uri);
        }
      }
    }
    await removeSpace(id);
    await get().fetchSpaces(true);
  },

  findSpace: (id) => {
    const search = (nodes: Space[]): Space | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = node.children?.length ? search(node.children) : null;
        if (found) return found;
      }
      return null;
    };
    return search(get().spaces);
  },

  getBreadcrumb: (id) => {
    const path: Space[] = [];
    const search = (nodes: Space[], trail: Space[]): boolean => {
      for (const node of nodes) {
        const nextTrail = [...trail, node];
        if (node.id === id) {
          path.push(...nextTrail);
          return true;
        }
        if (node.children && search(node.children, nextTrail)) return true;
      }
      return false;
    };
    search(get().spaces, []);
    return path;
  },

  countDescendants: (id) => {
    const node = get().findSpace(id);
    if (!node) return 0;
    const count = (space: Space): number => (space.children || []).reduce(
      (total, child) => total + 1 + count(child),
      0,
    );
    return count(node);
  },

  getFavorites: () => {
    const favorites: Space[] = [];
    const visit = (nodes: Space[]) => nodes.forEach((node) => {
      if (node.is_favorite) favorites.push(node);
      if (node.children?.length) visit(node.children);
    });
    visit(get().spaces);
    return favorites;
  },
}));

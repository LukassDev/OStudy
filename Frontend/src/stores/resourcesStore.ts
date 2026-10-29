import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import i18n from '../i18n';
import {
  createResource,
  deleteAllResources as removeAllResources,
  deleteResource as removeResource,
  getResource,
  listAllResources,
  listResources,
  reorderResources as persistResourceOrder,
  updateResource,
  type ResourceRow,
} from '../db/repositories/resources.repo';
import { createId } from '../db/ids';
import { deleteLocalFile } from '../services/localFiles';
import { getAppLimits } from '../services/appLimits';

export type ResourceType = 'pdf' | 'image' | 'link' | 'video' | 'document';

export interface Resource {
  id: string;
  space_id: string;
  title: string;
  position?: number;
  type: ResourceType;
  storage_path: string | null;
  file_uri?: string | null;
  text_content?: string | null;
  mime?: string | null;
  size?: number | null;
  original_size_bytes?: number | null;
  stored_size_bytes?: number | null;
  compression?: string | null;
  original_name?: string | null;
  url: string | null;
  topic_id: string | null;
  created_at: string;
}

interface ResourcesState {
  loadedSpaceId: string | null;
  resources: Resource[];
  loading: boolean;
  uploading: boolean;
  fetchResources: (spaceId: string) => Promise<void>;
  addLinkResource: (spaceId: string, title: string, url: string, topicId?: string | null) => Promise<void>;
  uploadFileResource: (
    spaceId: string,
    file: { uri: string; name: string; mimeType?: string | null; size?: number | null },
  ) => Promise<void>;
  deleteResource: (id: string, spaceId: string) => Promise<void>;
  deleteAllResources: () => Promise<void>;
  renameResource: (id: string, spaceId: string, title: string) => Promise<void>;
  moveResource: (id: string, spaceId: string, direction: number) => Promise<void>;
  reorderResources: (spaceId: string, ids: string[]) => Promise<void>;
  getSignedUrl: (storagePath: string) => Promise<string | null>;
}

let fetchVersion = 0;

function toResource(row: ResourceRow): Resource {
  return {
    ...row,
    type: row.type as ResourceType,
    storage_path: row.file_uri || row.storage_path,
  };
}

export const useResourcesStore = create<ResourcesState>((set, get) => ({
  loadedSpaceId: null,
  resources: [],
  loading: false,
  uploading: false,

  fetchResources: async (spaceId) => {
    const version = ++fetchVersion;
    if (get().loadedSpaceId !== spaceId) set({ resources: [], loadedSpaceId: null });
    set({ loading: get().loadedSpaceId !== spaceId });
    try {
      const rows = await listResources(spaceId);
      if (version === fetchVersion) {
        set({ resources: rows.map(toResource), loadedSpaceId: spaceId, loading: false });
      }
    } catch (error) {
      console.error('Could not load local resources:', error);
      if (version === fetchVersion) set({ loading: false });
      throw error;
    }
  },

  addLinkResource: async (spaceId, title, url, topicId = null) => {
    await createResource({ space_id: spaceId, title, type: 'link', url, topic_id: topicId });
    await get().fetchResources(spaceId);
  },

  uploadFileResource: async (spaceId, file) => {
    const limits = await getAppLimits();
    const maxFileBytes = limits.resourceFileMiB * 1024 * 1024;
    const maxWebFileBytes = limits.webResourceFileMiB * 1024 * 1024;
    const tooLarge = () => new Error(i18n.t('resources.uploadError.fileTooLarge', { limit: limits.resourceFileMiB }));
    if (file.size != null && file.size > maxFileBytes) throw tooLarge();
    set({ uploading: true });
    try {
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error(i18n.t('resources.uploadError.genericMessage'));
      const blob = await response.blob();
      if (blob.size > maxFileBytes) throw tooLarge();

      const id = createId();
      let fileUri: string | null = null;
      let textContent: string | null = null;
      let type: ResourceType = getResourceType(file.name, file.mimeType);
      if (Platform.OS === 'web') {
        if (blob.size > maxWebFileBytes || !isTextResource(file.name, file.mimeType)) {
          throw new Error(`Na versão web, só é possível guardar ficheiros de texto até ${limits.webResourceFileMiB} MiB. Use um Space no telemóvel para guardar outros ficheiros.`);
        }
        textContent = await blob.text();
        if (textContent.length > limits.webResourceTextChars) {
          throw new Error(`O texto do recurso excede o limite de ${limits.webResourceTextChars} caracteres.`);
        }
        type = 'document';
      } else {
        if (!FileSystem.documentDirectory) throw new Error('O armazenamento local de ficheiros não está disponível.');
        const directory = `${FileSystem.documentDirectory}resources/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const safeName = file.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
        fileUri = `${directory}${id}-${safeName}`;
        await FileSystem.copyAsync({ from: file.uri, to: fileUri });
      }

      await createResource({
        space_id: spaceId,
        title: file.name,
        type,
        file_uri: fileUri,
        text_content: textContent,
        mime: file.mimeType || blob.type || 'application/octet-stream',
        size: blob.size,
        original_name: file.name,
      });
      await get().fetchResources(spaceId);
    } finally {
      set({ uploading: false });
    }
  },

  deleteResource: async (id, spaceId) => {
    const row = await getResource(id, spaceId);
    await deleteLocalFile(row?.file_uri);
    await removeResource(id, spaceId);
    await get().fetchResources(spaceId);
  },

  deleteAllResources: async () => {
    set({ loading: true });
    try {
      const rows = await listAllResources();
      for (const row of rows) await deleteLocalFile(row.file_uri);
      await removeAllResources();
      set({ resources: [], loadedSpaceId: null });
    } finally {
      set({ loading: false });
    }
  },

  renameResource: async (id, spaceId, title) => {
    const normalized = title.trim();
    if (!normalized || normalized.length > 200) throw new Error(i18n.t('update15.invalidName'));
    await updateResource(id, spaceId, { title: normalized });
    await get().fetchResources(spaceId);
  },

  reorderResources: async (spaceId, ids) => {
    if (get().loadedSpaceId !== spaceId) return;
    const current = get().resources;
    if (ids.length !== current.length || ids.some((id) => !current.some((resource) => resource.id === id))) {
      throw new Error('A ordem dos recursos não corresponde à lista atual.');
    }
    const byId = new Map(current.map((resource) => [resource.id, resource]));
    set({ resources: ids.map((id, position) => ({ ...byId.get(id)!, position })) });
    try {
      await persistResourceOrder(spaceId, ids);
    } catch (error) {
      set({ resources: current });
      throw error;
    }
  },

  moveResource: async (id, spaceId, direction) => {
    const ids = get().resources.map((resource) => resource.id);
    const index = ids.indexOf(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await get().reorderResources(spaceId, ids);
  },

  getSignedUrl: async (storagePath) => {
    const resource = get().resources.find((item) => item.storage_path === storagePath);
    if (!resource) return null;
    if (resource.file_uri) return resource.file_uri;
    return null;
  },
}));

function isTextResource(name: string, mimeType?: string | null): boolean {
  return !!mimeType?.startsWith('text/')
    || /\.(txt|md|csv|json|xml|html)$/i.test(name);
}

function getResourceType(name: string, mimeType?: string | null): ResourceType {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (mimeType?.startsWith('video/')) return 'video';
  return 'document';
}

import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getSetting, setSetting } from '../db/repositories/settings.repo';
import { serializeLocalDatabase } from './localDataTransfer';

export const AUTO_BACKUP_INTERVALS = [1, 6, 12, 24, 168] as const;
export type AutoBackupIntervalHours = typeof AUTO_BACKUP_INTERVALS[number];

const ENABLED_KEY = 'backup.automatic.enabled';
const INTERVAL_KEY = 'backup.automatic.intervalHours';
const LAST_BACKUP_KEY = 'backup.automatic.lastAt';
const LAST_ERROR_KEY = 'backup.automatic.lastError';
const DIRECTORY_DB = 'orenstudy-auto-backup';
const DIRECTORY_STORE = 'handles';
const DIRECTORY_HANDLE_KEY = 'backup-directory';
const BACKUP_FOLDER_NAME = 'OStudy Backups';
const BACKUP_PREFIX = 'ostudy-auto-';
const LEGACY_BACKUP_PREFIX = 'orenstudy-auto-';
const RETAINED_BACKUPS = 10;
const CHECK_INTERVAL_MS = 60_000;

type PermissionState = 'granted' | 'denied' | 'prompt';
type WritableFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort?: () => Promise<void>;
  }>;
};
type DirectoryHandle = {
  name?: string;
  queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WritableFileHandle>;
  entries: () => AsyncIterableIterator<[string, { kind: string }]>;
  removeEntry: (name: string) => Promise<void>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<DirectoryHandle>;
  }
}

let backupInProgress: Promise<string | null> | null = null;

function isAutoBackupInterval(value: number): value is AutoBackupIntervalHours {
  return AUTO_BACKUP_INTERVALS.some(interval => interval === value);
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    encoded += second === undefined ? '=' : alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? '=' : alphabet[third & 63];
  }
  return encoded;
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DIRECTORY_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível guardar a pasta de backup do navegador.'));
  });
}

async function saveDirectoryHandle(handle: DirectoryHandle): Promise<void> {
  const database = await openHandleDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DIRECTORY_STORE, 'readwrite');
      transaction.objectStore(DIRECTORY_STORE).put(handle, DIRECTORY_HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Não foi possível guardar a pasta de backup.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('A gravação da pasta de backup foi cancelada.'));
    });
  } finally {
    database.close();
  }
}

async function readDirectoryHandle(): Promise<DirectoryHandle | null> {
  const database = await openHandleDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DIRECTORY_STORE, 'readonly');
      const request = transaction.objectStore(DIRECTORY_STORE).get(DIRECTORY_HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Não foi possível ler a pasta de backup guardada.'));
    });
  } finally {
    database.close();
  }
}

async function getWritableBackupDirectory(): Promise<DirectoryHandle> {
  const root = await readDirectoryHandle();
  if (!root) throw new Error('Escolhe novamente a pasta de backup do PC nas Definições.');
  if (await root.queryPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new Error('A permissão para a pasta de backup expirou. Escolhe novamente a pasta nas Definições.');
  }
  return root.getDirectoryHandle(BACKUP_FOLDER_NAME, { create: true });
}

function backupFilename(date: Date): string {
  return `${BACKUP_PREFIX}${date.toISOString().replace(/[:.]/g, '-')}.db`;
}

async function pruneWebBackups(directory: DirectoryHandle): Promise<void> {
  const backups: { name: string }[] = [];
  for await (const [name, entry] of directory.entries()) {
    if (entry.kind === 'file'
      && (name.startsWith(BACKUP_PREFIX) || name.startsWith(LEGACY_BACKUP_PREFIX))
      && name.endsWith('.db')) backups.push({ name });
  }
  backups.sort((left, right) => right.name.localeCompare(left.name));
  for (const backup of backups.slice(RETAINED_BACKUPS)) await directory.removeEntry(backup.name);
}

async function writeWebBackup(bytes: Uint8Array, filename: string): Promise<void> {
  const directory = await getWritableBackupDirectory();
  const file = await directory.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
      type: 'application/x-sqlite3',
    }));
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
  await pruneWebBackups(directory);
}

async function pruneDeviceBackups(directory: string): Promise<void> {
  const filenames = (await FileSystem.readDirectoryAsync(directory))
    .filter(name => (name.startsWith(BACKUP_PREFIX) || name.startsWith(LEGACY_BACKUP_PREFIX)) && name.endsWith('.db'))
    .sort()
    .reverse();
  for (const filename of filenames.slice(RETAINED_BACKUPS)) {
    await FileSystem.deleteAsync(`${directory}${filename}`, { idempotent: true });
  }
}

async function writeDeviceBackup(bytes: Uint8Array, filename: string): Promise<void> {
  if (!FileSystem.documentDirectory) throw new Error('A pasta local de documentos não está disponível.');
  const directory = `${FileSystem.documentDirectory}backups/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.writeAsStringAsync(`${directory}${filename}`, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await pruneDeviceBackups(directory);
}

async function writeBackupNow(): Promise<string> {
  const bytes = await serializeLocalDatabase();
  const now = new Date();
  const filename = backupFilename(now);
  if (Platform.OS === 'web') await writeWebBackup(bytes, filename);
  else await writeDeviceBackup(bytes, filename);
  const timestamp = now.toISOString();
  await setSetting(LAST_BACKUP_KEY, timestamp);
  await setSetting(LAST_ERROR_KEY, '');
  return timestamp;
}

export async function getAutomaticBackupSettings(): Promise<{
  enabled: boolean;
  intervalHours: AutoBackupIntervalHours;
  lastAt: string | null;
  lastError: string;
  folderName: string | null;
}> {
  const [enabled, interval, lastAt, lastError] = await Promise.all([
    getSetting(ENABLED_KEY, false),
    getSetting(INTERVAL_KEY, 24),
    getSetting<string | null>(LAST_BACKUP_KEY, null),
    getSetting(LAST_ERROR_KEY, ''),
  ]);
  return {
    enabled: enabled === true,
    intervalHours: isAutoBackupInterval(interval) ? interval : 24,
    lastAt: typeof lastAt === 'string' ? lastAt : null,
    lastError: typeof lastError === 'string' ? lastError : '',
    folderName: Platform.OS === 'web'
      ? typeof indexedDB !== 'undefined' ? (await readDirectoryHandle())?.name ?? null : null
      : 'Neste aparelho',
  };
}

export async function chooseBackupFolderAndEnable(intervalHours: AutoBackupIntervalHours): Promise<string> {
  if (Platform.OS !== 'web' || !window.showDirectoryPicker || typeof indexedDB === 'undefined') {
    throw new Error('A escolha automática de pasta no PC requer Chrome ou Edge atualizado. No mobile, os backups ficam no armazenamento do aparelho.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new Error('É necessário autorizar o acesso à pasta escolhida para guardar backups automáticos.');
  }
  await saveDirectoryHandle(handle);
  await setSetting(INTERVAL_KEY, intervalHours);
  await setSetting(ENABLED_KEY, true);
  try {
    return await writeBackupNow();
  } catch (error) {
    await setSetting(ENABLED_KEY, false);
    throw error;
  }
}

export async function enableDeviceAutomaticBackups(intervalHours: AutoBackupIntervalHours): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Na versão web, escolhe primeiro a pasta do PC onde guardar os backups.');
  await setSetting(INTERVAL_KEY, intervalHours);
  await setSetting(ENABLED_KEY, true);
  try {
    return await writeBackupNow();
  } catch (error) {
    await setSetting(ENABLED_KEY, false);
    throw error;
  }
}

export async function updateAutomaticBackupInterval(intervalHours: AutoBackupIntervalHours): Promise<void> {
  await setSetting(INTERVAL_KEY, intervalHours);
}

export async function disableAutomaticBackups(): Promise<void> {
  await setSetting(ENABLED_KEY, false);
}

export async function createAutomaticBackupNow(): Promise<string> {
  return writeBackupNow();
}

export async function runAutomaticBackupIfDue(): Promise<string | null> {
  if (backupInProgress) return backupInProgress;
  backupInProgress = (async () => {
    try {
      const settings = await getAutomaticBackupSettings();
      if (!settings.enabled) return null;
      const lastTime = settings.lastAt ? Date.parse(settings.lastAt) : 0;
      const dueAt = lastTime + settings.intervalHours * 60 * 60 * 1000;
      if (Date.now() < dueAt) return null;
      return await writeBackupNow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await setSetting(LAST_ERROR_KEY, message);
      } catch (settingError) {
        console.error('Could not record automatic backup failure:', settingError);
      }
      console.error('Automatic local database backup failed:', error);
      return null;
    }
  })().finally(() => {
    backupInProgress = null;
  });
  return backupInProgress;
}

export function startAutomaticBackupScheduler(): () => void {
  void runAutomaticBackupIfDue();
  const timer = setInterval(() => void runAutomaticBackupIfDue(), CHECK_INTERVAL_MS);
  const appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') void runAutomaticBackupIfDue();
  });
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') void runAutomaticBackupIfDue();
  };
  if (Platform.OS === 'web') document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    clearInterval(timer);
    appStateSubscription.remove();
    if (Platform.OS === 'web') document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

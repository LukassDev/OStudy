import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'ostudy.openrouter.api-key';
const LEGACY_API_KEY_STORAGE_KEY = 'orenstudy.openrouter.api-key';

async function readStoredKey(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function writeStoredKey(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('O armazenamento local não está disponível.');
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getApiKey(): Promise<string | null> {
  const key = await readStoredKey(API_KEY_STORAGE_KEY);
  if (key) return key;
  const legacyKey = await readStoredKey(LEGACY_API_KEY_STORAGE_KEY);
  if (!legacyKey) return null;
  await writeStoredKey(API_KEY_STORAGE_KEY, legacyKey);
  await removeStoredKey(LEGACY_API_KEY_STORAGE_KEY);
  return legacyKey;
}

async function removeStoredKey(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function setApiKey(value: string): Promise<void> {
  const key = value.trim();
  if (!key) {
    await removeApiKey();
    return;
  }
  await writeStoredKey(API_KEY_STORAGE_KEY, key);
}

export async function removeApiKey(): Promise<void> {
  await Promise.all([
    removeStoredKey(API_KEY_STORAGE_KEY),
    removeStoredKey(LEGACY_API_KEY_STORAGE_KEY),
  ]);
}

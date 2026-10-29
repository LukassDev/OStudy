import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'orenstudy.openrouter.api-key';

export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(API_KEY_STORAGE_KEY);
  }
  return SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
}

export async function setApiKey(value: string): Promise<void> {
  const key = value.trim();
  if (!key) {
    await removeApiKey();
    return;
  }
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('O armazenamento local não está disponível.');
    window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
    return;
  }
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key);
}

export async function removeApiKey(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

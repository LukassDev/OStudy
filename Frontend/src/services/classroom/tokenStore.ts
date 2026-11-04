import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'ostudy.classroom.tokens';

export interface ClassroomTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  account_email?: string;
}

export async function getClassroomTokens(): Promise<ClassroomTokens | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ClassroomTokens : null;
  }
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? JSON.parse(raw) as ClassroomTokens : null;
}

export async function setClassroomTokens(tokens: ClassroomTokens): Promise<void> {
  const payload = JSON.stringify(tokens);
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('O armazenamento local não está disponível.');
    window.localStorage.setItem(STORAGE_KEY, payload);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, payload);
}

export async function clearClassroomTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

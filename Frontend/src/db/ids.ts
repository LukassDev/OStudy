import * as Crypto from 'expo-crypto';

export const createId = (): string => Crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

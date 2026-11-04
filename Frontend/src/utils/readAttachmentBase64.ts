import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function readAttachmentBase64(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Could not read attachment');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read attachment'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

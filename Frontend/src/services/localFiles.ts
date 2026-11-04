import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export async function deleteLocalFile(uri: string | null | undefined): Promise<void> {
  if (
    Platform.OS === 'web'
    || !uri
    || !FileSystem.documentDirectory
    || !uri.startsWith(FileSystem.documentDirectory)
  ) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

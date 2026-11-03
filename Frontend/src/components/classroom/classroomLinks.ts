import { Linking } from 'react-native';
import { showAppDialog } from '../ui/AppDialog';

export function getClassroomItemUrl(alternateLink: string | undefined, accountEmail: string): string | undefined {
  if (!alternateLink) return undefined;
  try {
    const url = new URL(alternateLink);
    if (url.protocol !== 'https:' || url.hostname !== 'classroom.google.com') return undefined;
    url.searchParams.set('authuser', accountEmail);
    return url.toString();
  } catch {
    return undefined;
  }
}

export function openClassroomItem(url: string): void {
  void Linking.openURL(url).catch(error => {
    showAppDialog(
      'Google Classroom',
      error instanceof Error ? error.message : 'Não foi possível abrir este item no Google Classroom.',
      undefined,
      { variant: 'danger' },
    );
  });
}

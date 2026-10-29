import { LORELEI_AVATARS } from './loreleiAvatars';

export const AVATAR_BACKGROUND = '#f4f1ea';
export const AVATAR_FOREGROUND = '#2f2a24';
export const INITIALS_AVATAR_ID = 'initials';

export interface AvatarPreset {
  id: string;
  label: string;
  colors: [string, string];
}

export const AVATAR_PRESETS: AvatarPreset[] = Object.keys(LORELEI_AVATARS).map((id) => ({
  id, label: '', colors: [AVATAR_BACKGROUND, AVATAR_FOREGROUND],
}));

// Profiles with retired geo-* IDs display the first neutral SVG.
export function getAvatarPreset(id: string | null | undefined): AvatarPreset {
  return AVATAR_PRESETS.find((preset) => preset.id === id) ?? AVATAR_PRESETS[0];
}

export function isInitialsAvatar(id: string | null | undefined): boolean {
  return !id || id === INITIALS_AVATAR_ID;
}

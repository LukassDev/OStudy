import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { DEFAULT_LANGUAGE, type SupportedLanguage } from '../i18n';
import { clearProfile, getProfile, saveProfile, type LocalProfile } from '../db/repositories/profile.repo';

const LEGACY_PROFILE_KEY = 'oren:profile:v1';

interface ProfileState extends LocalProfile {
  loading: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<LocalProfile>) => Promise<void>;
  reset: () => Promise<void>;
}

const defaultProfile: LocalProfile = {
  name: '',
  goal: null,
  onboarding_completed: false,
  avatar_style: 'initials',
  theme: 'light',
  language: DEFAULT_LANGUAGE,
  language_set_manually: false,
};

function normalizeProfile(value: Partial<LocalProfile>): LocalProfile {
  return {
    ...defaultProfile,
    ...value,
    theme: value.theme === 'dark' ? 'dark' : 'light',
    language: (value.language || DEFAULT_LANGUAGE) as SupportedLanguage,
  };
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  ...defaultProfile,
  loading: true,

  fetchProfile: async () => {
    set({ loading: true });
    try {
      let profile = await getProfile();
      if (!profile) {
        const legacy = await AsyncStorage.getItem(LEGACY_PROFILE_KEY);
        profile = legacy ? normalizeProfile(JSON.parse(legacy) as Partial<LocalProfile>) : defaultProfile;
        await saveProfile(profile);
        if (legacy) await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
      }
      set({ ...profile, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  updateProfile: async (updates) => {
    const profile = normalizeProfile({ ...get(), ...updates });
    await saveProfile(profile);
    set(profile);
  },

  reset: async () => {
    await clearProfile();
    set({ ...defaultProfile, loading: false });
  },
}));

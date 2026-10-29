import { getDatabase } from '../client';
import { nowIso } from '../ids';

export interface LocalProfile {
  name: string;
  goal: string | null;
  onboarding_completed: boolean;
  avatar_style: string;
  theme: 'light' | 'dark';
  language: string;
  language_set_manually: boolean;
}

type ProfileRow = Omit<LocalProfile, 'onboarding_completed' | 'language_set_manually'> & {
  onboarding_completed: number;
  language_set_manually: number;
};

export async function getProfile(): Promise<LocalProfile | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ProfileRow>(
    `SELECT name, goal, onboarding_completed, avatar_style, theme, language, language_set_manually
     FROM profile WHERE id = 'local'`,
  );
  return row ? {
    ...row,
    onboarding_completed: row.onboarding_completed === 1,
    language_set_manually: row.language_set_manually === 1,
  } : null;
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  const database = await getDatabase();
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO profile
      (id, name, goal, onboarding_completed, avatar_style, theme, language, language_set_manually, created_at, updated_at)
     VALUES ('local', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, goal = excluded.goal, onboarding_completed = excluded.onboarding_completed,
      avatar_style = excluded.avatar_style, theme = excluded.theme, language = excluded.language,
      language_set_manually = excluded.language_set_manually, updated_at = excluded.updated_at`,
    profile.name,
    profile.goal,
    Number(profile.onboarding_completed),
    profile.avatar_style,
    profile.theme,
    profile.language,
    Number(profile.language_set_manually),
    timestamp,
    timestamp,
  );
}

export async function clearProfile(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM profile WHERE id = 'local'`);
}

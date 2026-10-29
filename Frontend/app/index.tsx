import { useEffect } from 'react';
import { router } from 'expo-router';
import { useProfileStore } from '../src/stores/profileStore';

export default function Index() {
  const { onboarding_completed, loading } = useProfileStore();

  useEffect(() => {
    if (loading) return;
    router.replace(onboarding_completed ? '/(app)/dashboard' : '/onboarding');
  }, [loading, onboarding_completed]);

  return null;
}

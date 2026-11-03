import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getSetting } from '../src/db/repositories/settings.repo';
import { useThemeColors } from '../src/constants/theme';
import { useProfileStore } from '../src/stores/profileStore';

export default function Index() {
  const { onboarding_completed, loading } = useProfileStore();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (Platform.OS !== 'web') {
      router.replace(onboarding_completed ? '/(app)/dashboard' : '/onboarding');
      return;
    }

    let active = true;
    void getSetting('welcome.enabled', true)
      .then((enabled) => {
        if (!active) return;
        router.replace(
          enabled ? '/welcome' : onboarding_completed ? '/(app)/dashboard' : '/onboarding',
        );
      })
      .catch((cause) => {
        console.error('Could not load the welcome screen setting:', cause);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [loading, onboarding_completed, retry]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.textPrimary, textAlign: 'center', marginBottom: 16 }}>
          {t('welcome.loadError')}
        </Text>
        <Text
          accessibilityRole="button"
          onPress={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
          style={{ color: colors.primary, fontWeight: '600' }}
        >
          {t('welcome.retry')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

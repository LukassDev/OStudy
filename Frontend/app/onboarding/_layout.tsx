import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { useThemeColors } from '../../src/constants/theme';

export default function OnboardingLayout() {
  const colors = useThemeColors();
  const screens = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
  if (Platform.OS !== 'web') return screens;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>{screens}</View>
    </View>
  );
}

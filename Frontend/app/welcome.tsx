import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../src/constants/theme';
import { useProfileStore } from '../src/stores/profileStore';

type DayPart = 'dawn' | 'morning' | 'afternoon' | 'night';

function getDayPart(hour: number): DayPart {
  if (hour < 5) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
}

export default function WelcomeScreen({ onComplete }: { onComplete?: () => void }) {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const opacity = useRef(new Animated.Value(1)).current;
  const messageIndex = useRef(Math.floor(Math.random() * 3)).current;
  const colors = useThemeColors();
  const { t } = useTranslation();
  const onboardingCompleted = useProfileStore((state) => state.onboarding_completed);
  const { height } = useWindowDimensions();
  const messages = t(`welcome.messages.${getDayPart(new Date().getHours())}`, { returnObjects: true });
  const message = Array.isArray(messages) && typeof messages[messageIndex] === 'string'
    ? messages[messageIndex]
    : t('welcome.fallback');

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(1500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        if (onComplete) {
          onComplete();
        } else if (next === 'onboarding' || !onboardingCompleted) {
          router.replace('/onboarding?welcomeShown=1');
        } else {
          router.replace('/(app)/dashboard');
        }
      }
    });

    return () => animation.stop();
  }, [next, onComplete, onboardingCompleted, opacity]);

  const compact = height < 700;

  return (
    <View
      accessibilityLabel={message}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: colors.background,
      }}
    >
      <Animated.View style={{ alignItems: 'center', opacity }}>
        <Image
          source={require('../assets/images/ostudyNewIcon.png')}
          resizeMode="contain"
          style={{ width: compact ? 68 : 82, height: compact ? 68 : 82, marginBottom: compact ? 16 : 20 }}
        />
        <Text style={{ color: colors.textPrimary, maxWidth: 320, fontSize: compact ? 19 : 21, fontWeight: '600', textAlign: 'center', lineHeight: compact ? 27 : 30 }}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

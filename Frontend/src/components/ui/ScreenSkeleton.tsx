import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { motion, radius, spacing, useThemeColors } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function ScreenSkeleton({ rows = 3, header = true }: { rows?: number; header?: boolean }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) { opacity.setValue(1); return; }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.6, duration: motion.slow, easing: Easing.bezier(...motion.easing), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: motion.slow, easing: Easing.bezier(...motion.easing), useNativeDriver: true }),
      Animated.delay(motion.slow),
    ]));
    pulse.start();
    return () => { pulse.stop(); opacity.setValue(1); };
  }, [opacity, reducedMotion]);
  const block = { backgroundColor: colors.surfaceElevated, borderRadius: radius.sm };
  return (
    <View accessible accessibilityLabel={t('common.loading')} accessibilityState={{ busy: true }} style={styles.container}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity, gap: spacing.md }}>
        {header && <View style={styles.header}>
          <View style={[block, { height: spacing.xl, width: '56%' }]} />
          <View style={[block, { height: spacing.md, width: '36%' }]} />
        </View>}
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[block, { height: spacing.md, width: '64%' }]} />
            <View style={[block, { height: spacing.compact, width: '88%' }]} />
            <View style={[block, { height: spacing.compact, width: '40%' }]} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  header: { gap: spacing.compact, paddingVertical: spacing.md },
  card: { padding: spacing.md, gap: spacing.compact, borderRadius: radius.md, borderWidth: 1 },
});

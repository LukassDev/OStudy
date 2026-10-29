import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../constants/theme';

interface KeyboardAwareModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  contentStyle?: object;
  cornerRadius?: number;
}

export function KeyboardAwareModal({
  visible,
  onRequestClose,
  children,
  contentStyle,
  cornerRadius = 24,
}: KeyboardAwareModalProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
      <KeyboardAvoidingView
        style={[styles.keyboardArea, { paddingTop: insets.top + 8 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.availableArea, Platform.OS === 'web' && { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius }, Platform.OS === 'web' && { width: '100%', maxWidth: 640, borderRadius: cornerRadius, overflow: 'hidden' }]}>
        <ScrollView
          style={styles.scroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        >
          <View style={[styles.content, { borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius }, contentStyle]}>{children}</View>
        </ScrollView>
        {Platform.OS !== 'web' && <View pointerEvents="none" style={[styles.bottomFill, { height, backgroundColor: colors.background }]} />}
        </View>
        </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  keyboardArea: { flex: 1 },
  sheet: { maxHeight: '100%', flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  bottomFill: { position: 'absolute', top: '100%', left: 0, right: 0 },
  availableArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
  },
  scroll: { flexGrow: 0, maxHeight: '100%' },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
});

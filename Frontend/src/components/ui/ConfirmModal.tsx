import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { useThemeColors, useThemeMode, radius } from '../../constants/theme';

export type ConfirmModalVariant = 'default' | 'warning' | 'danger';

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: ConfirmModalVariant;
  title: string;
  /** One or more paragraphs displayed in the confirmation dialog. */
  messages?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Delay after opening before the confirmation action becomes available. */
  confirmDelayMs?: number;
  /** If set, confirmation stays disabled until the user types this exact text. */
  requireTypedConfirmation?: string;
  secondaryAction?: { label: string; onPress: () => void | Promise<void> };
}


// Alert.alert() nativos (que parecem "sistema operativo", não "app") como os
// antigos modais brancos com só texto e botões. Usado para apagar/renomear
// chats e apagar Spaces.
export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  icon,
  variant = 'default',
  title,
  messages = [],
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  confirmDelayMs = 0,
  requireTypedConfirmation,
  secondaryAction,
}: ConfirmModalProps) {
  const colors = useThemeColors();
  const { mode } = useThemeMode();
  const { t } = useTranslation();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [typedValue, setTypedValue] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(Math.ceil(confirmDelayMs / 1000));
  const confirmAvailableAt = useRef(0);

  useEffect(() => {
    setRemainingSeconds(Math.ceil(confirmDelayMs / 1000));
    confirmAvailableAt.current = visible ? Date.now() + confirmDelayMs : 0;
    if (!visible || confirmDelayMs <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((confirmAvailableAt.current - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [visible, confirmDelayMs]);

  useEffect(() => {
    if (visible) {
      setTypedValue('');
      scale.setValue(0.92);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const accent =
    variant === 'danger' ? colors.error : variant === 'warning' ? colors.warning : colors.primary;
  const accentSoft =
    variant === 'danger' ? colors.errorSoft : variant === 'warning' ? colors.warningSoft : colors.primarySoft;

  const isTypedConfirmDisabled =
    !!requireTypedConfirmation && typedValue.trim() !== requireTypedConfirmation;
  const confirmDisabled = loading || isTypedConfirmDisabled || remainingSeconds > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, opacity }}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 25}
          tint={mode === 'light' ? 'light' : 'dark'}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            backgroundColor: colors.overlay,
          }}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={loading ? undefined : onClose}
          />
          <Animated.View
            style={{
              transform: [{ scale }],
              width: '100%',
              maxWidth: 380,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.25,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            {icon && (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 22,
                  backgroundColor: accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons name={icon} size={26} color={accent} />
              </View>
            )}

            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: messages.length ? 10 : 20 }}>
              {title}
            </Text>

            {messages.map((msg, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.textSecondary,
                  marginBottom: i === messages.length - 1 ? 20 : 8,
                }}
              >
                {msg}
              </Text>
            ))}

            {requireTypedConfirmation && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 6 }}>
                  {t('common.typeToConfirm', { word: requireTypedConfirmation })}
                </Text>
                <TextInput
                  value={typedValue}
                  onChangeText={setTypedValue}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder={requireTypedConfirmation}
                  placeholderTextColor={colors.textTertiary}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: colors.textPrimary,
                    fontSize: 15,
                    backgroundColor: colors.surface,
                  }}
                />
              </View>
            )}

            {secondaryAction && (
              <TouchableOpacity
                onPress={secondaryAction.onPress}
                disabled={loading}
                accessibilityRole="button"
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>{secondaryAction.label}</Text>
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!visible || confirmDisabled || Date.now() < confirmAvailableAt.current) return;
                  void onConfirm();
                }}
                disabled={confirmDisabled}
                accessibilityState={{ disabled: confirmDisabled }}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  backgroundColor: accent,
                  opacity: confirmDisabled ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                  {loading ? 'A processar…' : remainingSeconds > 0 ? `${confirmLabel} (${remainingSeconds}s)` : confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { radius, shadows, typography, useThemeColors, useThemeMode } from '../../constants/theme';

export type AppDialogActionStyle = 'default' | 'cancel' | 'destructive';
export type AppDialogVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

export interface AppDialogAction {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: AppDialogActionStyle;
}

export interface AppDialogOptions {
  variant?: AppDialogVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  dismissible?: boolean;
}

interface DialogPayload {
  title: string;
  message?: string;
  actions: AppDialogAction[];
  options: AppDialogOptions;
}

interface DialogState {
  payload: DialogPayload | null;
  show: (payload: DialogPayload) => void;
  hide: () => void;
}

const useDialogStore = create<DialogState>((set) => ({
  payload: null,
  show: (payload) => set({ payload }),
  hide: () => set({ payload: null }),
}));

/**
 * Substituto visual de Alert.alert. Mantém a assinatura familiar para que os
 * fluxos continuem simples, mas apresenta um modal coerente com o design do
 * Oren em todas as plataformas.
 */
export function showAppDialog(
  title: string,
  message?: string,
  actions?: AppDialogAction[],
  options: AppDialogOptions = {},
): void {
  useDialogStore.getState().show({
    title,
    message,
    actions: actions?.length ? actions : [{ text: 'OK', style: 'default' }],
    options,
  });
}

export function AppDialogHost() {
  const payload = useDialogStore((state) => state.payload);
  const hide = useDialogStore((state) => state.hide);
  const colors = useThemeColors();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const translateY = useRef(new Animated.Value(28)).current;

  const isActionSheet = (payload?.actions.length ?? 0) > 2;
  const variant = useMemo<AppDialogVariant>(() => {
    if (payload?.options.variant) return payload.options.variant;
    return !isActionSheet && payload?.actions.some((action) => action.style === 'destructive')
      ? 'danger'
      : 'default';
  }, [isActionSheet, payload]);

  useEffect(() => {
    if (!payload) return;
    opacity.setValue(0);
    scale.setValue(0.94);
    translateY.setValue(28);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      isActionSheet
        ? Animated.spring(translateY, {
            toValue: 0,
            speed: 18,
            bounciness: 4,
            useNativeDriver: true,
          })
        : Animated.spring(scale, {
            toValue: 1,
            speed: 18,
            bounciness: 5,
            useNativeDriver: true,
          }),
    ]).start();
  }, [isActionSheet, opacity, payload, scale, translateY]);

  if (!payload) return null;

  const variantColor =
    variant === 'danger'
      ? colors.error
      : variant === 'warning'
        ? colors.warning
        : variant === 'success'
          ? colors.success
          : colors.primary;
  const variantSoft =
    variant === 'danger'
      ? colors.errorSoft
      : variant === 'warning'
        ? colors.warningSoft
        : variant === 'success'
          ? colors.successSoft
          : colors.primarySoft;
  const icon =
    payload.options.icon ??
    (variant === 'danger'
      ? 'trash-outline'
      : variant === 'warning'
        ? 'warning-outline'
        : variant === 'success'
          ? 'checkmark-circle-outline'
          : 'information-circle-outline');

  const close = () => {
    if (payload.options.dismissible === false) return;
    hide();
  };

  const runAction = (action: AppDialogAction) => {
    hide();
    requestAnimationFrame(() => {
      try {
        const result = action.onPress?.();
        if (result && typeof result.catch === 'function') {
          result.catch((error) => console.error('[AppDialog] action failed:', error));
        }
      } catch (error) {
        console.error('[AppDialog] action failed:', error);
      }
    });
  };

  const orderedActions = isActionSheet
    ? [
        ...payload.actions.filter((action) => action.style !== 'cancel'),
        ...payload.actions.filter((action) => action.style === 'cancel'),
      ]
    : payload.actions;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.fill, { opacity }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 38 : 24}
          tint={mode === 'light' ? 'light' : 'dark'}
          style={[
            styles.overlay,
            isActionSheet ? styles.sheetOverlay : styles.centerOverlay,
            {
              backgroundColor: colors.overlay,
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
          <Animated.View
            style={[
              styles.card,
              isActionSheet ? styles.sheet : styles.dialog,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                transform: isActionSheet ? [{ translateY }] : [{ scale }],
              },
              shadows.modal,
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: variantSoft }]}>
              <Ionicons name={icon} size={25} color={variantColor} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>{payload.title}</Text>
            {!!payload.message && (
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {payload.message}
              </Text>
            )}

            <View style={isActionSheet ? styles.actionList : styles.actionRow}>
              {orderedActions.map((action, index) => {
                const destructive = action.style === 'destructive';
                const cancel = action.style === 'cancel';
                const primary =
                  payload.actions.length === 1 ||
                  (!cancel && !destructive && payload.actions.length <= 2);
                return (
                  <TouchableOpacity
                    key={`${action.text}-${index}`}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    onPress={() => runAction(action)}
                    style={[
                      isActionSheet ? styles.sheetAction : styles.dialogAction,
                      !isActionSheet && { flex: 1 },
                      {
                        backgroundColor: primary
                          ? colors.primary
                          : destructive
                            ? isActionSheet
                              ? colors.errorSoft
                              : colors.error
                            : colors.surface,
                        borderColor: destructive ? colors.error : colors.border,
                      },
                      isActionSheet && cancel && styles.cancelAction,
                    ]}
                  >
                    {isActionSheet && (
                      <Ionicons
                        name={destructive ? 'trash-outline' : cancel ? 'close-outline' : 'text'}
                        size={20}
                        color={destructive ? colors.error : cancel ? colors.textSecondary : colors.primary}
                      />
                    )}
                    <Text
                      style={[
                        styles.actionText,
                        {
                          color: primary || (destructive && !isActionSheet)
                            ? colors.primaryText
                            : destructive
                              ? colors.error
                              : colors.textPrimary,
                        },
                      ]}
                    >
                      {action.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { flex: 1, paddingHorizontal: 20 },
  centerOverlay: { alignItems: 'center', justifyContent: 'center' },
  sheetOverlay: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: { width: '100%', borderWidth: 1, padding: 22 },
  dialog: { maxWidth: 380, borderRadius: radius.xl },
  sheet: { alignSelf: 'center', maxWidth: 520, borderRadius: radius.xl },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    lineHeight: 24,
  },
  message: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.size.sm,
    lineHeight: 21,
    marginTop: 8,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  actionList: { gap: 9, marginTop: 20 },
  dialogAction: {
    minHeight: 48,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheetAction: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  cancelAction: { marginTop: 4 },
  actionText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.size.base,
  },
});

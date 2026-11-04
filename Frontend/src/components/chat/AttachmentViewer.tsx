import React, { useEffect } from 'react';
import { Image, Modal, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';

type Attachment = { uri: string; name?: never } | { name: string; uri?: never };

export function AttachmentViewer({ attachment, onClose }: { attachment: Attachment | null; onClose: () => void }) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (!attachment || Platform.OS !== 'web') return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [attachment, onClose]);

  return <Modal visible={!!attachment} transparent animationType="fade" onRequestClose={onClose}>
    <View accessibilityViewIsModal style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <Pressable accessibilityLabel={t('attachmentViewer.close')} onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      <View style={{ width: Math.min(width - 32, 960), height: Math.min(height * .8, 760), borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface }}>
        {attachment?.uri ? <Image source={{ uri: attachment.uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
          <Ionicons name="document-text-outline" size={88} color={colors.primary} />
          <Text selectable style={{ color: colors.textPrimary, fontSize: 22, textAlign: 'center' }}>{attachment?.name}</Text>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel={t('attachmentViewer.close')} onPress={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  </Modal>;
}

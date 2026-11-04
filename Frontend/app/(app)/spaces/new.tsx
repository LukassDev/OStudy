import React from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SpaceForm } from '../../../src/components/spaces/SpaceForm';
import { useWebModalLayout } from '../../../src/constants/webModal';
import { useThemeColors } from '../../../src/constants/theme';

export default function NewSpaceModal() {
  const colors = useThemeColors();
  const webModal = useWebModalLayout(600);
  // Suporta criar um Space de topo (sem parentId) ou um sub-Space
  // (quando aberto a partir de dentro de outro Space, via ?parentId=...).
  const { parentId } = useLocalSearchParams<{ parentId?: string }>();

  return (
    <Modal visible transparent={Platform.OS === 'web'} animationType="slide" onRequestClose={() => router.back()}>
      <View style={[{ flex: 1 }, webModal.overlay]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }, webModal.card]}>
        <SpaceForm mode="create" defaultParentId={parentId || null} />
      </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});

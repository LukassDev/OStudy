import React, { useEffect } from 'react';
import { Modal, Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpaceStore } from '../../../../src/stores/spaceStore';
import { SpaceForm } from '../../../../src/components/spaces/SpaceForm';
import { useWebModalLayout } from '../../../../src/constants/webModal';
import { useThemeColors } from '../../../../src/constants/theme';

export default function EditSpaceModal() {
  const colors = useThemeColors();
  const webModal = useWebModalLayout(600);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spaces, fetchSpaces, findSpace } = useSpaceStore();
  const space = findSpace(id);

  useEffect(() => {
    if (spaces.length === 0) fetchSpaces();
  }, [spaces.length, fetchSpaces]);

  return (
    <Modal visible transparent={Platform.OS === 'web'} animationType="slide" onRequestClose={() => router.back()}>
      <View style={[{ flex: 1 }, webModal.overlay]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }, webModal.card]}>
        {space ? (
          <SpaceForm mode="edit" initial={space} />
        ) : (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

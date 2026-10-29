import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { Resource, useResourcesStore } from '../../stores/resourcesStore';
import { useUiStore } from '../../stores/uiStore';
import { showAppDialog } from '../ui/AppDialog';

const ROW = 84;
export function ResourceOrderModal({ resources, spaceId, onClose }: {
  resources: Resource[]; spaceId: string; onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  // Keep a stable snapshot so background refreshes cannot interrupt a gesture.
  const [items] = useState(resources);
  const [dragging, setDragging] = useState(false);
  const order = useSharedValue(items.map(item => item.id));
  const active = useSharedValue<string | null>(null);
  const draft = useRef(items.map(item => item.id));
  useEffect(() => {
    useUiStore.setState({ editingResources: true });
    return () => { useUiStore.setState({ editingResources: false }); };
  }, []);
  const finish = () => {
    if (dragging) return;
    const store = useResourcesStore.getState();
    if (store.loadedSpaceId === spaceId) {
      const existing = new Set(store.resources.map(item => item.id));
      const visible = new Set(draft.current);
      const next = draft.current.filter(id => existing.has(id));
      let index = 0;
      const ids = store.resources.map(item => visible.has(item.id) ? next[index++] : item.id);
      if (ids.some((id, i) => id !== store.resources[i].id)) {
        void store.reorderResources(spaceId, ids).catch(error => showAppDialog(t('update15.error'), String(error)));
      }
    }
    onClose();
  };
  return (
    <Modal visible animationType="slide" onRequestClose={finish}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 800, alignSelf: 'center' } : {}) }}>
          <View style={{ padding: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, fontSize: 20, fontFamily: 'DMSans_700Bold', color: colors.textPrimary }}>{t('studyVisual.editResources')}</Text>
              <TouchableOpacity accessibilityRole="button" disabled={dragging} onPress={finish}
                style={{ padding: 12, borderRadius: 20, backgroundColor: colors.primary, opacity: dragging ? 0.5 : 1 }}>
                <Text style={{ color: '#fff', fontFamily: 'DMSans_700Bold' }}>{t('studyVisual.finishEditing')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('studyVisual.dragResourcesHint')}</Text>
          </View>
          <ScrollView scrollEnabled={!dragging} bounces={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <View style={{ height: items.length * ROW }}>
              {items.map(item => <ResourceRow key={item.id} item={item} order={order} active={active}
                onDragging={setDragging} onReorder={ids => { draft.current = ids; }} />)}
            </View>
          </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ResourceRow({ item, order, active, onDragging, onReorder }: {
  item: Resource; order: SharedValue<string[]>; active: SharedValue<string | null>;
  onDragging: (value: boolean) => void; onReorder: (ids: string[]) => void;
}) {
  const colors = useThemeColors();
  const id = item.id;
  const start = useSharedValue(0);
  const y = useSharedValue(0);
  const before = useSharedValue<string[]>([]);
  const begin = () => {
    onDragging(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const finish = (ids: string[] | null) => {
    onDragging(false);
    if (ids) onReorder(ids);
  };
  const gesture = Gesture.Pan().activateAfterLongPress(350)
    .onStart(() => {
      before.value = [...order.value];
      start.value = order.value.indexOf(id) * ROW;
      y.value = start.value;
      active.value = id;
      runOnJS(begin)();
    })
    .onUpdate(event => {
      y.value = Math.max(0, Math.min((order.value.length - 1) * ROW, start.value + event.translationY));
      const next = Math.round(y.value / ROW);
      const from = order.value.indexOf(id);
      if (next !== from) {
        const ids = [...order.value];
        ids.splice(next, 0, ids.splice(from, 1)[0]);
        order.value = ids;
      }
    })
    .onFinalize((_event, success) => {
      if (active.value !== id) return;
      if (!success) order.value = before.value;
      active.value = null;
      runOnJS(finish)(success ? [...order.value] : null);
    });
  const style = useAnimatedStyle(() => {
    const lifted = active.value === id;
    return { zIndex: lifted ? 10 : 0, elevation: lifted ? 8 : 0, shadowOpacity: lifted ? 0.14 : 0,
      transform: [{ translateY: lifted ? y.value : withTiming(order.value.indexOf(id) * ROW, { duration: 160 }) },
        { scale: withTiming(lifted ? 1.025 : 1, { duration: 120 }) }] };
  });
  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: ROW - 10,
        padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
        shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, style]}>
        <Ionicons name={item.type === 'link' ? 'link-outline' : item.type === 'image' ? 'image-outline' : 'document-text-outline'} size={22} color={colors.primary} />
        <Text numberOfLines={2} style={{ flex: 1, color: colors.textPrimary, fontFamily: 'DMSans_500Medium' }}>{item.title}</Text>
        <Ionicons name="reorder-three" size={24} color={colors.textTertiary} />
      </Animated.View>
    </GestureDetector>
  );
}

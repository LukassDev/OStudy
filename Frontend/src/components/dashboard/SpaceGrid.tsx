import React, { useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { webSpaceColumns } from '../../utils/webLayout';
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useSharedValue, useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Space, useSpaceStore } from "../../stores/spaceStore";
import { useSpaceColorMap, useThemeColors } from "../../constants/theme";
import { SpaceIcon } from "../spaces/SpaceIcon";
import { guardedPush } from "../../utils/navigation";
import { showAppDialog } from "../ui/AppDialog";

const HEIGHT = Platform.OS === 'web' ? 132 : 150;
const GAP = 12;

export function SpaceGrid({ spaces, onDragging, editing = false, onReorder }: {
  spaces: Space[];
  onDragging: (dragging: boolean) => void;
  editing?: boolean;
  onReorder?: (ids: string[]) => void;
}) {
  const [width, setWidth] = useState(0);
  const columns = Platform.OS === 'web' || width >= 600 ? webSpaceColumns(width) : width > 0 && width < 300 ? 1 : 2;
  const order = useSharedValue(spaces.map(space => space.id));
  const active = useSharedValue<string | null>(null);
  useEffect(() => {
    if (active.value === null) order.value = spaces.map(space => space.id);
  }, [spaces, active, order]);
  useEffect(() => () => onDragging(false), [onDragging]);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height: Math.ceil(spaces.length / columns) * (HEIGHT + GAP), marginBottom: 12 }}>
      {width > 0 && spaces.map(space => (
        <DraggableSpace key={space.id} space={space} columns={columns} cell={(width + GAP) / columns} order={order} active={active}
          editing={editing} onDragging={onDragging} onReorder={onReorder} />
      ))}
    </View>
  );
}

function DraggableSpace({ space, cell, columns, order, active, editing, onDragging, onReorder }: {
  space: Space; cell: number; columns: number; order: SharedValue<string[]>; active: SharedValue<string | null>;
  editing: boolean; onDragging: (dragging: boolean) => void; onReorder?: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const palette = useSpaceColorMap();
  const tint = palette[space.color] || colors.primary;
  const start = useSharedValue(0);
  const before = useSharedValue<string[]>([]);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const id = space.id;
  const begin = () => {
    onDragging(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const finish = (ids: string[] | null) => {
    onDragging(false);
    if (ids) onReorder?.(ids);
  };
  const pan = Gesture.Pan().enabled(editing);
  if (Platform.OS === 'web') {
    // Mouse button drags and the OS touchpad tap-tap-hold gesture both arrive
    // as a held pointer. Do not require an extra click in the application.
    pan.minDistance(6).maxPointers(1);
  } else {
    pan.activateAfterLongPress(350);
  }
  const gesture = pan
    .onStart(() => {
      before.value = [...order.value];
      start.value = order.value.indexOf(id);
      x.value = (start.value % columns) * cell;
      y.value = Math.floor(start.value / columns) * (HEIGHT + GAP);
      active.value = id;
      runOnJS(begin)();
    })
    .onUpdate(e => {
      x.value = (start.value % columns) * cell + e.translationX;
      y.value = Math.floor(start.value / columns) * (HEIGHT + GAP) + e.translationY;
      const col = Math.max(0, Math.min(columns - 1, Math.round(x.value / cell)));
      const row = Math.max(0, Math.round(y.value / (HEIGHT + GAP)));
      const next = Math.min(order.value.length - 1, row * columns + col);
      const from = order.value.indexOf(id);
      if (from !== next) {
        const draft = [...order.value];
        draft.splice(next, 0, draft.splice(from, 1)[0]);
        order.value = draft;
      }
    })
    .onFinalize((_e, success) => {
      // A short tap / scroll never activates the drag and must not lock scrolling.
      if (active.value !== id) return;
      if (!success) order.value = before.value;
      active.value = null;
      runOnJS(finish)(success ? [...order.value] : null);
    });
  const animatedStyle = useAnimatedStyle(() => {
    const index = order.value.indexOf(id);
    const lifted = active.value === id;
    return {
      zIndex: lifted ? 10 : 0,
      elevation: lifted ? 10 : 0,
      shadowOpacity: lifted ? 0.16 : 0,
      transform: [
        { translateX: lifted ? x.value : withTiming((index % columns) * cell, { duration: 160 }) },
        { translateY: lifted ? y.value : withTiming(Math.floor(index / columns) * (HEIGHT + GAP), { duration: 160 }) },
        { scale: withTiming(lifted ? 1.045 : 1, { duration: 120 }) },
      ],
    };
  });
  return (
    <GestureDetector gesture={gesture} touchAction="pan-y">
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: cell - GAP, height: HEIGHT,
        shadowColor: "#000", shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }, animatedStyle]}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={editing}
                onPress={() => guardedPush(`/(app)/spaces/${space.id}`)}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: editing ? colors.primary : "transparent",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 15,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: tint + "20",
                      padding: 10,
                      borderRadius: 12,
                    }}
                  >
                    <SpaceIcon
                      name={space.icon || "folder-outline"}
                      size={22}
                      color={tint}
                    />
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={t("update15.favorite")}
                    style={{ transform: [{ translateY: -16 }] }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: space.is_favorite }}
                    hitSlop={10}
                    disabled={editing}
                    onPress={(e) => {
                      e.stopPropagation();
                      void useSpaceStore
                        .getState()
                        .updateSpace(space.id, {
                          is_favorite: !space.is_favorite,
                        })
                        .catch((error) =>
                          showAppDialog(t("update15.error"), String(error)),
                        );
                    }}
                  >
                    <Ionicons
                      name={space.is_favorite ? "star" : "star-outline"}
                      size={20}
                      color={
                        space.is_favorite ? "#EAB308" : colors.textTertiary
                      }
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 16,
                    color: colors.textPrimary,
                  }}
                >
                  {space.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                >
                  {space.children?.length
                    ? t("dashboard.spaceSubLabel", {
                        count: space.children.length,
                      })
                    : t("dashboard.spaceSubDefault")}
                </Text>
              </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

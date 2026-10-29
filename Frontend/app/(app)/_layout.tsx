import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, useWindowDimensions, Animated, PanResponder, Platform } from 'react-native';
import { WebAppShell } from '../../src/components/navigation/WebAppShell';
import { Stack, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Sidebar } from '../../src/components/navigation/Sidebar';
import { useThemeColors } from '../../src/constants/theme';
import { useUiStore } from '../../src/stores/uiStore';
import { isHorizontalSwipe } from '../../src/utils/swipeNavigation';

export default function AppLayout() {
  return <AppLayoutContent />;
}

function AppLayoutContent() {
  const { width } = useWindowDimensions();
  const SIDEBAR_WIDTH = width * 0.8;
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const ui = useUiStore();
  const { sidebarOpen, closeSidebar, openSidebar, toggleSidebar } = ui;
  const showFloatingMenu = pathname === '/dashboard';
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.spring(translateX, {
      toValue: sidebarOpen ? 0 : -SIDEBAR_WIDTH,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  }, [sidebarOpen, SIDEBAR_WIDTH, translateX]);

  // Antes: a sidebar só fechava se tocasses no overlay escuro. Agora fecha-se
  // sozinha sempre que a rota muda — ou seja, ao carregar em qualquer item
  // dela (Space, chat recente, perfil, etc.).
  useEffect(() => {
    if (Platform.OS !== 'web') closeSidebar();
  }, [pathname, closeSidebar]);

  const settleSidebar = (open: boolean) => {
    if (open !== sidebarOpen) {
      if (open) openSidebar();
      else closeSidebar();
    }
    Animated.spring(translateX, {
      toValue: open ? 0 : -SIDEBAR_WIDTH,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  };

  const drawerGesture = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (Platform.OS === 'web') return false;
      if (!showFloatingMenu || ui.selectionOpen || ui.editingSpaces) return false;
      return isHorizontalSwipe(gesture.dx, gesture.dy, gesture.numberActiveTouches)
        && (sidebarOpen ? gesture.dx < 0 : gesture.x0 <= 28 && gesture.dx > 0);
    },
    onPanResponderGrant: () => translateX.stopAnimation(),
    onPanResponderMove: (_, gesture) => translateX.setValue(Math.max(-SIDEBAR_WIDTH, Math.min(0, (sidebarOpen ? 0 : -SIDEBAR_WIDTH) + gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      const completed = Math.abs(gesture.dx) > Math.min(80, SIDEBAR_WIDTH * 0.25) || Math.abs(gesture.vx) > 0.5;
      settleSidebar(completed ? gesture.dx > 0 : sidebarOpen);
    },
    onPanResponderTerminate: () => settleSidebar(sidebarOpen),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {Platform.OS === 'web' ? (
        <WebAppShell>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'none' }}>
            <Stack.Screen name="spaces/new" options={{ presentation: 'transparentModal' }} />
            <Stack.Screen name="spaces/edit/[id]" options={{ presentation: 'transparentModal' }} />
          </Stack>
        </WebAppShell>
      ) : (
      <View {...drawerGesture.panHandlers} className="flex-1" style={{ backgroundColor: colors.background }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right',
          }}
        />

        {showFloatingMenu && (
          <TouchableOpacity
            className="absolute z-10 bg-surfaceElevated rounded-full p-2.5 shadow-md"
            style={{ top: insets.top + 8, left: 16 }}
            onPress={toggleSidebar}
          >
            <Ionicons name="menu" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        {sidebarOpen && (
          <TouchableOpacity
            className="absolute inset-0 bg-black/30 z-20"
            activeOpacity={1}
            onPress={closeSidebar}
          />
        )}

        <Animated.View
          accessibilityElementsHidden={!sidebarOpen}
          importantForAccessibility={sidebarOpen ? 'auto' : 'no-hide-descendants'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_WIDTH,
            transform: [{ translateX }],
            zIndex: 30,
            backgroundColor: colors.surfaceElevated,
          }}
        >
          <Sidebar />
        </Animated.View>
      </View>
      )}

    </GestureHandlerRootView>
  );
}

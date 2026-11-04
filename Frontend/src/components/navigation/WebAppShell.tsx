import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { ThemeProvider, useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { WEB_DOCK_BREAKPOINT, WEB_SIDEBAR_WIDTH, webPageWidth } from '../../utils/webLayout';
import { Sidebar } from './Sidebar';
import { useProfileStore } from '../../stores/profileStore';

// Rendered exclusively by the web branch of AppLayout.
export function WebAppShell({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const navigationTheme = useTheme();
  const theme = useProfileStore(state => state.theme);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const isChat = pathname.startsWith('/chats/');
  const [open, setOpen] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const docked = width >= WEB_DOCK_BREAKPOINT;
  const sidebarWidth = Math.min(WEB_SIDEBAR_WIDTH, Math.max(0, width - 48));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const scrollFromMargin = (event: WheelEvent) => {
      const content = contentRef.current;
      // Leave content, horizontal gestures and browser zoom to the browser.
      // The sidebar and modal portals are outside this listener's boundary.
      if (!content || event.defaultPrevented || event.ctrlKey || event.metaKey
        || event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
        || (event.target instanceof Node && content.contains(event.target))) return;

      // Routes/tabs can retain hidden screens. Pick the largest visible
      // vertical scroll area, never a hidden route or a horizontal carousel.
      let scroller: HTMLElement | null = null;
      let largestArea = 0;
      const bounds = content.getBoundingClientRect();
      for (const element of Array.from(content.querySelectorAll<HTMLElement>('*'))) {
        if (element.clientHeight <= 0 || element.scrollHeight <= element.clientHeight + 1
          || element.closest('[aria-hidden="true"], [inert]')) continue;
        const style = window.getComputedStyle(element);
        if (!['auto', 'scroll'].includes(style.overflowY) || style.visibility === 'hidden') continue;
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.max(0, Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left));
        const visibleHeight = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top));
        const area = visibleWidth * visibleHeight;
        if (area > largestArea) { largestArea = area; scroller = element; }
      }
      if (!scroller) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
      const previousTop = scroller.scrollTop;
      scroller.scrollTop += event.deltaY * unit;
      if (scroller.scrollTop !== previousTop) event.preventDefault();
    };
    main.addEventListener('wheel', scrollFromMargin, { passive: false });
    return () => main.removeEventListener('wheel', scrollFromMargin);
  }, []);

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.background }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('common.menu', { defaultValue: 'Menu' })}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(value => !value)}
          style={{ position: 'absolute', top: 12, left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated }}
        >
          <Ionicons name="menu" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
        <div ref={mainRef} style={{ display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box', flex: 1, minWidth: 0, minHeight: 0, marginLeft: open && docked ? sidebarWidth : 0,
          paddingLeft: isChat ? 0 : width >= 1200 ? 32 : width >= 768 ? 20 : 0,
          paddingRight: isChat ? 0 : width >= 1200 ? 32 : width >= 768 ? 20 : 0,
          paddingTop: isChat ? 0 : docked ? 24 : 60, paddingBottom: isChat ? 0 : 24 }}>
          <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', position: 'relative', flex: 1, minHeight: 0, width: !isChat && docked ? '94%' : '100%', maxWidth: isChat ? undefined : webPageWidth(pathname), alignSelf: 'center', overflow: 'hidden' }}>
            <ThemeProvider value={{
              ...navigationTheme,
              dark: theme === 'dark',
              colors: {
                ...navigationTheme.colors,
                background: colors.background,
                card: colors.surface,
                text: colors.textPrimary,
                border: colors.border,
                primary: colors.primary,
              },
            }}>
              {children}
            </ThemeProvider>
          </div>
        </div>
        {open && !docked && <TouchableOpacity
          accessibilityRole="button" accessibilityLabel={t('common.cancel')}
          onPress={() => setOpen(false)} activeOpacity={1}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: sidebarWidth, backgroundColor: 'rgba(0,0,0,0.18)', zIndex: 1 }}
        />}
        {open && <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0,
          width: sidebarWidth, paddingTop: 48, borderRightWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, zIndex: 2 }}>
          <Sidebar />
        </View>}
      </View>
    </View>
  );
}

export const WEB_SIDEBAR_WIDTH = 280;
export const WEB_DOCK_BREAKPOINT = 960;
export const WEB_PAGE_MAX_WIDTH = 1120;

export function webPageWidth(pathname: string): number {
  const route = pathname.replace(/^\/\(app\)/, '');
  if (route === '/spaces/new' || route.startsWith('/spaces/edit/')) return 720;
  if (route === '/profile') return 880;
  if (route === '/agenda') return 800;
  return WEB_PAGE_MAX_WIDTH;
}

export function webSpaceColumns(width: number): number {
  return Math.max(1, Math.min(4, Math.floor((width + 12) / 240)));
}

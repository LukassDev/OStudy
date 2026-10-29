import { create } from 'zustand';

interface UiState {
  editingSpaces: boolean;
  editingResources: boolean;
  sidebarOpen: boolean;
  selectionOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  openSelection: () => void;
  closeSelection: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  editingSpaces: false,
  editingResources: false,
  sidebarOpen: false,
  selectionOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openSelection: () => set({ selectionOpen: true }),
  closeSelection: () => set({ selectionOpen: false }),
}));

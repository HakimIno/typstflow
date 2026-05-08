import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export type UISlice = Pick<
  DesignerState,
  | 'viewMode'
  | 'zoom'
  | 'activeTab'
  | 'activePageId'
  | 'isSidebarOpen'
  | 'isRightSidebarOpen'
  | 'theme'
  | 'primaryColor'
  | 'canvasLayout'
  | 'aiModel'
  | 'aiMode'
  | '_hasHydrated'
  | 'setZoom'
  | 'setViewMode'
  | 'setActiveTab'
  | 'setActivePage'
  | 'setSidebarOpen'
  | 'toggleSidebar'
  | 'toggleRightSidebar'
  | 'setRightSidebarOpen'
  | 'setTheme'
  | 'setPrimaryColor'
  | 'setCanvasLayout'
  | 'setAiModel'
  | 'setAiMode'
  | 'setHasHydrated'
>;

export const createUISlice: StateCreator<DesignerState, [], [], UISlice> = (set, _get) => ({
  viewMode: 'design' as DesignerState['viewMode'],
  zoom: 1.0,
  activeTab: 'palette' as DesignerState['activeTab'],
  activePageId: 'page-1' as DesignerState['activePageId'],
  isSidebarOpen: true,
  isRightSidebarOpen: true,
  theme: 'dark' as DesignerState['theme'],
  primaryColor: '#8B5CF6',
  canvasLayout: 'vertical' as DesignerState['canvasLayout'],
  aiModel: 'anthropic/claude-sonnet-4-5',
  aiMode: 'plan' as DesignerState['aiMode'],
  _hasHydrated: false,

  setHasHydrated: (state) => set({ _hasHydrated: state }),
  setZoom: (zoom: number) => set({ zoom: Math.max(0.2, Math.min(zoom, 3.0)) }),
  setViewMode: (mode: 'design' | 'preview' | 'split') =>
    set((state) => ({
      viewMode: mode,
      isRightSidebarOpen:
        mode === 'preview' || mode === 'split' ? true : state.isRightSidebarOpen,
    })),
  setActiveTab: (tab: 'palette' | 'outline' | 'data' | 'ai') =>
    set({ activeTab: tab, isSidebarOpen: true }),
  setActivePage: (pageId: string | null) => set({ activePageId: pageId }),
  setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setRightSidebarOpen: (open: boolean) => set({ isRightSidebarOpen: open }),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  setTheme: (theme: 'dark' | 'light') => set({ theme }),
  setPrimaryColor: (color: string) => set({ primaryColor: color }),
  setCanvasLayout: (layout: 'vertical' | 'grid') => set({ canvasLayout: layout }),
  setAiModel: (model: string) => set({ aiModel: model }),
  setAiMode: (mode: 'plan' | 'act') => set({ aiMode: mode }),
});

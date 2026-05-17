import type { ComponentNode, GroupDefinition, LayoutSchema, Zone, ZoneKey } from '@/types/schema';
import type { FontSlice } from './slices/font-slice';

export interface SpacingIndicator {
  side: 'left' | 'right' | 'top' | 'bottom';
  distance: number;
  lineStart: number;
  lineEnd: number;
  crossPos: number;
}

export interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'info' | 'danger' | 'warning' | 'success';
  showInput?: boolean;
  inputPlaceholder?: string;
  initialValue?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

export interface DialogState extends DialogOptions {
  isOpen: boolean;
}

export interface DesignerState extends FontSlice {
  // Schema
  schema: LayoutSchema;

  // App State
  viewMode: 'design' | 'preview' | 'split';
  zoom: number;
  activeTab: 'palette' | 'outline' | 'data' | 'ai';
  activePageId: string | null;
  isSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  theme: 'dark' | 'light';
  primaryColor: string;
  canvasLayout: 'vertical' | 'grid';
  aiModel: string;
  aiMode: 'plan' | 'act';
  scrollToPageId: string | null;

  // Selection
  selectedComponentIds: string[];
  selectedGroupId: string | null;
  selectedZone: ZoneKey | null;
  clipboard: ComponentNode[] | null;
  selectedCell: {
    tableId: string;
    section: 'header' | 'footer' | 'data';
    rowId: string;
    cellIdx: number;
  } | null;
  selectedCells: {
    tableId: string;
    section: 'header' | 'footer' | 'data';
    rowIds: string[];
    cellIndices: number[];
  } | null;

  // Layers
  hiddenComponentIds: string[];
  lockedComponentIds: string[];

  // Preview / Data Binding
  sampleData: Record<string, unknown>;
  previewPages: string[];
  previewStatus: 'idle' | 'compiling' | 'error';
  previewError: string | null;
  componentRegistry: Record<string, ComponentNode>;

  // History
  history: LayoutSchema[];
  historyIndex: number;

  // Drag & Snapping
  dragState: {
    isDragging: boolean;
    draggedComponentId: string | null;
    currentX: number; // mm
    currentY: number; // mm
    startX: number; // mm
    startY: number; // mm
    lastSnappedX: number; // For drop persistence
    lastSnappedY: number; // For drop persistence
    activeGuides: {
      vertical: number[]; // x positions in mm
      horizontal: number[]; // y positions in mm
    };
    spacingIndicators: SpacingIndicator[];
    activePageId: string | null;
  };

  // Actions
  addComponent: (
    zoneKey: ZoneKey,
    component: Partial<ComponentNode>,
    pageId?: string,
    groupId?: string,
    groupType?: 'header' | 'footer'
  ) => void;
  updateComponent: (id: string, updates: Partial<ComponentNode>, skipHistory?: boolean) => void;
  removeComponent: (id: string) => void;
  removeComponents: (ids: string[]) => void;
  moveComponent: (
    id: string,
    fromZone: ZoneKey,
    toZone: ZoneKey,
    newIndex: number,
    x?: number,
    y?: number,
    fromPageId?: string | null,
    toPageId?: string | null,
    skipHistory?: boolean,
    fromGroupId?: string,
    toGroupId?: string,
    fromGroupType?: 'header' | 'footer',
    toGroupType?: 'header' | 'footer'
  ) => void;
  moveComponents: (
    moves: Array<{
      id: string;
      fromZone: ZoneKey;
      toZone: ZoneKey;
      newIndex: number;
      x?: number;
      y?: number;
      fromPageId?: string | null;
      toPageId?: string | null;
      fromGroupId?: string;
      toGroupId?: string;
      fromGroupType?: 'header' | 'footer';
      toGroupType?: 'header' | 'footer';
    }>,
    skipHistory?: boolean
  ) => void;
  batchApplyDrag: (
    updatesMap: Record<string, Partial<ComponentNode>>,
    moves: Array<{
      id: string;
      fromZone: ZoneKey;
      toZone: ZoneKey;
      newIndex: number;
      x?: number;
      y?: number;
      fromPageId?: string | null;
      toPageId?: string | null;
      fromGroupId?: string;
      toGroupId?: string;
      fromGroupType?: 'header' | 'footer';
      toGroupType?: 'header' | 'footer';
    }>,
    skipHistory?: boolean
  ) => void;
  selectComponent: (id: string | null, multi?: boolean) => void;
  toggleComponentSelection: (id: string) => void;
  clearSelection: () => void;
  selectComponentsInRange: (
    rect: { x: number; y: number; width: number; height: number },
    zoneKey: ZoneKey,
    pageId?: string
  ) => void;
  setSelectedCell: (cell: DesignerState['selectedCell']) => void;
  setSelectedCells: (cells: DesignerState['selectedCells']) => void;
  updateZone: (
    zoneKey: ZoneKey,
    updates: Partial<Zone>,
    pageId?: string,
    skipHistory?: boolean,
    groupId?: string,
    groupType?: 'header' | 'footer'
  ) => void;
  setSelectedZone: (zone: ZoneKey | null) => void;
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  updateGroup: (id: string, updates: Partial<GroupDefinition>) => void;
  selectGroup: (id: string | null) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  setDragState: (updates: Partial<DesignerState['dragState']>) => void;
  setSampleData: (data: Record<string, unknown>) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data' | 'ai') => void;
  setActivePage: (pageId: string | null) => void;
  setScrollToPageId: (pageId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  undo: () => void;
  redo: () => void;
  rewindToCheckpoint: (checkpointIndex: number) => void;
  loadTemplate: (
    name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks' | 'tax-invoice' | 'multi-invoice'
  ) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPrimaryColor: (color: string) => void;
  setAiModel: (model: string) => void;
  setAiMode: (mode: 'plan' | 'act') => void;
  loadStressTest: (pages?: number, components?: number) => void;
  setCanvasLayout: (layout: 'vertical' | 'grid') => void;

  // Page Actions
  addPage: () => void;
  removePage: (id: string) => void;
  reorderPage: (id: string, newIndex: number) => void;
  setPageCount: (count: number) => void;
  updatePageDataSource: (pageId: string, dataSource?: string) => void;

  // Layer Actions
  toggleComponentVisibility: (id: string) => void;
  toggleComponentLock: (id: string) => void;
  renameComponent: (id: string, name: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  bringToFrontMany: (ids: string[]) => void;
  sendToBackMany: (ids: string[]) => void;
  moveUpMany: (ids: string[]) => void;
  moveDownMany: (ids: string[]) => void;
  updateLastSnapped: (x: number, y: number, pageId: string | null) => void;
  updateComponents: (
    updatesMap: Record<string, Partial<ComponentNode>>,
    skipHistory?: boolean
  ) => void;
  alignSelected: (
    type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
    pageId?: string
  ) => void;
  distributeSelected: (type: 'dist-h' | 'dist-v', pageId?: string) => void;
  stackSelected: (type: 'stack-h' | 'stack-v', gap: number, pageId?: string) => void;
  alignToPage: (
    type:
      | 'page-left'
      | 'page-center-h'
      | 'page-right'
      | 'page-top'
      | 'page-center-v'
      | 'page-bottom'
      | 'page-center-both',
    pageId?: string
  ) => void;

  // Keyboard/Clipboard Actions
  copySelected: () => void;
  paste: () => void;
  duplicateSelected: () => void;
  // Group Actions
  addGroup: (field: string) => void;
  removeGroup: (id: string) => void;
  // Dialog
  dialog: DialogState;
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;

  // File Operations
  exportSchema: () => void;
  importSchema: (json: string) => void;

  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

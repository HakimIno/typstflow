import { indexedDBStorage } from '@/lib/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COMPLEX_SAMPLE_DATA, COMPLEX_TABLE_TEMPLATE } from '../lib/templates/complex-table';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '../lib/templates/invoice';
import {
  INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA,
  INVOICE_WITH_PAGE_BREAKS_TEMPLATE,
} from '../lib/templates/invoice-with-page-breaks';
import type { ComponentNode, LayoutSchema } from '../types/schema';

type ZoneKey = 'header' | 'body' | 'footer';

interface DesignerState {
  // Schema
  schema: LayoutSchema;

  // App State
  viewMode: 'design' | 'preview' | 'split';
  zoom: number;
  activeTab: 'palette' | 'outline' | 'data';
  activePageId: string | null;
  isSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  theme: 'dark' | 'light';
  primaryColor: string;

  // Selection
  selectedComponentIds: string[];
  selectedZone: ZoneKey | null;
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
  sampleData: Record<string, any>;
  previewPages: string[];
  previewStatus: 'idle' | 'compiling' | 'error';
  previewError: string | null;

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
    activePageId: string | null;
  };

  // Actions
  addComponent: (zoneKey: ZoneKey, component: ComponentNode, pageId?: string) => void;
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
    fromPageId?: string,
    toPageId?: string,
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
    updates: Partial<LayoutSchema['zones']['header']>,
    pageId?: string,
    skipHistory?: boolean
  ) => void;
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  setDragState: (updates: Partial<DesignerState['dragState']>) => void;
  setSampleData: (data: Record<string, any>) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data') => void;
  setActivePage: (pageId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  undo: () => void;
  redo: () => void;
  loadTemplate: (name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPrimaryColor: (color: string) => void;

  // Page Actions
  addPage: () => void;
  removePage: (id: string) => void;
  reorderPage: (id: string, newIndex: number) => void;
  setPageCount: (count: number) => void;

  // Layer Actions
  toggleComponentVisibility: (id: string) => void;
  toggleComponentLock: (id: string) => void;
  renameComponent: (id: string, name: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  moveUp: (id: string) => void;
  moveDown: (id: string) => void;
  updateLastSnapped: (x: number, y: number, pageId: string | null) => void;
}

const MAX_HISTORY = 50;

const pushHistory = (state: DesignerState, newSchema: LayoutSchema) => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(newSchema);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  return {
    schema: newSchema,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
};

const BLANK_SCHEMA: LayoutSchema = {
  id: 'new-report',
  name: 'New Report',
  version: '1.0.0',
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  },
  fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
  zones: {
    header: { id: 'header', minHeight: '30mm', components: [] },
    footer: { id: 'footer', minHeight: '30mm', components: [] },
  },
  pages: [
    {
      id: 'page-1',
      name: 'Page 1',
      body: { id: 'body', minHeight: '237mm', components: [] },
    },
  ],
  variables: [],
  dataSchema: [],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Antigravity',
  },
};

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      schema: BLANK_SCHEMA,
      viewMode: 'design',
      zoom: 1.0,
      activeTab: 'palette',
      activePageId: 'page-1',
      isSidebarOpen: true,
      isRightSidebarOpen: true,
      theme: 'dark',
      primaryColor: '#8B5CF6',
      selectedComponentIds: [],
      selectedZone: null,
      selectedCell: null,
      selectedCells: null,
      hiddenComponentIds: [],
      lockedComponentIds: [],
      sampleData: {},
      previewPages: [],
      previewStatus: 'idle',
      previewError: null,
      history: [BLANK_SCHEMA],
      historyIndex: 0,
      dragState: {
        isDragging: false,
        draggedComponentId: null,
        currentX: 0,
        currentY: 0,
        startX: 0,
        startY: 0,
        lastSnappedX: 0,
        lastSnappedY: 0,
        activeGuides: {
          vertical: [],
          horizontal: [],
        },
        activePageId: null,
      },

      loadTemplate: (name) => {
        if (name === 'invoice') {
          set({
            schema: INVOICE_TEMPLATE,
            sampleData: INVOICE_SAMPLE_DATA,
            history: [INVOICE_TEMPLATE],
            historyIndex: 0,
          });
        } else if (name === 'complex') {
          set({
            schema: COMPLEX_TABLE_TEMPLATE,
            sampleData: COMPLEX_SAMPLE_DATA,
            history: [COMPLEX_TABLE_TEMPLATE],
            historyIndex: 0,
          });
        } else if (name === 'invoice-with-breaks') {
          set({
            schema: INVOICE_WITH_PAGE_BREAKS_TEMPLATE,
            sampleData: INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA,
            history: [INVOICE_WITH_PAGE_BREAKS_TEMPLATE],
            historyIndex: 0,
          });
        } else if (name === ('tax-invoice' as any)) {
          const {
            TAX_INVOICE_TEMPLATE,
            TAX_INVOICE_SAMPLE_DATA,
          } = require('../lib/templates/tax-invoice');
          set({
            schema: TAX_INVOICE_TEMPLATE,
            sampleData: TAX_INVOICE_SAMPLE_DATA,
            history: [TAX_INVOICE_TEMPLATE],
            historyIndex: 0,
          });
        } else {
          set({
            schema: BLANK_SCHEMA,
            sampleData: {},
            history: [BLANK_SCHEMA],
            historyIndex: 0,
          });
        }
      },

      addComponent: (zoneKey, component, pageId) =>
        set((state) => {
          const id = `${component.type}-${Math.random().toString(36).substring(2, 9)}`;
          const newComponent = {
            ...component,
            id,
            x: component.x ?? state.dragState.lastSnappedX ?? 10,
            y: component.y ?? state.dragState.lastSnappedY ?? 10,
            width: component.width ?? 100,
            height: component.height ?? 20,
          };

          const newSchema = { ...state.schema };

          if (zoneKey === 'body') {
            const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;
            newSchema.pages = state.schema.pages.map((p) =>
              p.id === targetPageId
                ? {
                    ...p,
                    body: {
                      ...p.body,
                      components: [...p.body.components, newComponent],
                    },
                  }
                : p
            );
          } else {
            newSchema.zones = {
              ...state.schema.zones,
              [zoneKey]: {
                ...state.schema.zones[zoneKey],
                components: [...state.schema.zones[zoneKey].components, newComponent],
              },
            };
          }

          return { ...pushHistory(state, newSchema), selectedComponentIds: [id] };
        }),

      updateLastSnapped: (x, y, pageId) =>
        set((state) => ({
          dragState: {
            ...state.dragState,
            lastSnappedX: x,
            lastSnappedY: y,
            activePageId: pageId,
          },
        })),

      updateComponent: (id, updates, skipHistory) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Check Global Zones
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const index = newSchema.zones[key].components.findIndex((c) => c.id === id);
            if (index !== -1) {
              const newComponents = [...newSchema.zones[key].components];
              newComponents[index] = { ...newComponents[index], ...updates } as ComponentNode;
              newSchema.zones = {
                ...newSchema.zones,
                [key]: { ...newSchema.zones[key], components: newComponents },
              };
              changed = true;
              break;
            }
          }

          // Check Page Bodies
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1) {
                const newComponents = [...page.body.components];
                newComponents[index] = { ...newComponents[index], ...updates } as ComponentNode;
                changed = true;
                return { ...page, body: { ...page.body, components: newComponents } };
              }
              return page;
            });
          }

          if (!changed) return state;

          if (skipHistory) return { schema: newSchema };
          return pushHistory(state, newSchema);
        }),

      removeComponent: (id) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global Zones
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const original = newSchema.zones[key].components;
            const filtered = original.filter((c) => c.id !== id);
            if (filtered.length !== original.length) {
              newSchema.zones = {
                ...newSchema.zones,
                [key]: { ...newSchema.zones[key], components: filtered },
              };
              changed = true;
            }
          }

          // Pages
          newSchema.pages = newSchema.pages.map((page) => {
            const original = page.body.components;
            const filtered = original.filter((c) => c.id !== id);
            if (filtered.length !== original.length) {
              changed = true;
              return { ...page, body: { ...page.body, components: filtered } };
            }
            return page;
          });

          if (!changed) return state;

          return { ...pushHistory(state, newSchema), selectedComponentIds: [] };
        }),

      removeComponents: (ids) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global Zones
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const original = newSchema.zones[key].components;
            const filtered = original.filter((c) => !ids.includes(c.id));
            if (filtered.length !== original.length) {
              newSchema.zones = {
                ...newSchema.zones,
                [key]: { ...newSchema.zones[key], components: filtered },
              };
              changed = true;
            }
          }

          // Pages
          newSchema.pages = newSchema.pages.map((page) => {
            const original = page.body.components;
            const filtered = original.filter((c) => !ids.includes(c.id));
            if (filtered.length !== original.length) {
              changed = true;
              return { ...page, body: { ...page.body, components: filtered } };
            }
            return page;
          });

          if (!changed) return state;

          return { ...pushHistory(state, newSchema), selectedComponentIds: [] };
        }),

      moveComponent: (
        id,
        fromZone,
        toZone,
        newIndex,
        x,
        y,
        fromPageId,
        toPageId,
        skipHistory
      ) =>
        set((state) => {
          let component: ComponentNode | undefined;

          // 1. Find and Extract Component
          const newSchema = { ...state.schema };

          if (fromZone === 'body') {
            const page = newSchema.pages.find((p) => p.id === fromPageId);
            if (page) {
              component = page.body.components.find((c) => c.id === id);
              if (component) {
                page.body.components = page.body.components.filter((c) => c.id !== id);
              }
            }
          } else {
            component = newSchema.zones[fromZone].components.find((c) => c.id === id);
            if (component) {
              newSchema.zones[fromZone].components = newSchema.zones[fromZone].components.filter(
                (c) => c.id !== id
              );
            }
          }

          if (!component) return state;

          // 2. Update Component Position
          const updatedComponent = {
            ...component,
            ...(x !== undefined ? { x } : {}),
            ...(y !== undefined ? { y } : {}),
          };

          // 3. Insert into Target Zone
          if (toZone === 'body') {
            const targetPageId = toPageId || state.activePageId || newSchema.pages[0]?.id;
            newSchema.pages = newSchema.pages.map((p) => {
              if (p.id === targetPageId) {
                const comps = [...p.body.components];
                const insertAt =
                  newIndex === -1 || newIndex === undefined
                    ? comps.length
                    : Math.max(0, Math.min(newIndex, comps.length));
                comps.splice(insertAt, 0, updatedComponent);
                return { ...p, body: { ...p.body, components: comps } };
              }
              return p;
            });
          } else {
            const comps = [...newSchema.zones[toZone].components];
            const insertAt =
              newIndex === -1 || newIndex === undefined
                ? comps.length
                : Math.max(0, Math.min(newIndex, comps.length));
            comps.splice(insertAt, 0, updatedComponent);
            newSchema.zones[toZone].components = comps;
          }

          if (skipHistory) return { schema: newSchema };
          return pushHistory(state, newSchema);
        }),

      selectComponent: (id, multi) =>
        set((state) => {
          if (!id) return { selectedComponentIds: [], selectedCell: null, selectedCells: null };

          if (multi) {
            // Add to selection if not already there
            if (state.selectedComponentIds.includes(id)) return state;
            return {
              selectedComponentIds: [...state.selectedComponentIds, id],
              selectedCell: null,
              selectedCells: null,
            };
          }

          return { selectedComponentIds: [id], selectedCell: null, selectedCells: null };
        }),

      toggleComponentSelection: (id) =>
        set((state) => {
          const ids = state.selectedComponentIds.includes(id)
            ? state.selectedComponentIds.filter((i) => i !== id)
            : [...state.selectedComponentIds, id];
          return { selectedComponentIds: ids, selectedCell: null, selectedCells: null };
        }),

      clearSelection: () =>
        set({
          selectedComponentIds: [],
          selectedCell: null,
          selectedCells: null,
          selectedZone: null,
        }),

      selectComponentsInRange: (rect, zoneKey, pageId) =>
        set((state) => {
          let components: ComponentNode[] = [];
          if (zoneKey === 'body') {
            const page = state.schema.pages.find((p) => p.id === pageId);
            components = page?.body.components || [];
          } else {
            components = state.schema.zones[zoneKey].components;
          }

          const foundIds = components
            .filter((comp) => {
              if (state.lockedComponentIds.includes(comp.id)) return false;

              const compX = comp.x || 0;
              const compY = comp.y || 0;
              const compW = comp.width || 0;
              const compH = comp.height || 0;

              return (
                compX < rect.x + rect.width &&
                compX + compW > rect.x &&
                compY < rect.y + rect.height &&
                compY + compH > rect.y
              );
            })
            .map((comp) => comp.id);

          const newIds = [...new Set([...state.selectedComponentIds, ...foundIds])];

          return {
            selectedComponentIds: newIds,
            selectedZone: zoneKey,
            selectedCell: null,
            selectedCells: null,
          };
        }),

      setSelectedCell: (cell) =>
        set({
          selectedCell: cell,
          selectedCells: cell
            ? {
                tableId: cell.tableId,
                section: cell.section,
                rowIds: [cell.rowId],
                cellIndices: [cell.cellIdx],
              }
            : null,
        }),

      setSelectedCells: (cells) => set({ selectedCells: cells }),

      updateSchema: (updates: Partial<LayoutSchema>) =>
        set((state) => {
          const newSchema = { ...state.schema, ...updates };
          return pushHistory(state, newSchema);
        }),

      updateZone: (zoneKey, updates, pageId, skipHistory) =>
        set((state) => {
          const newSchema = { ...state.schema };
          if (zoneKey === 'body') {
            const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;
            newSchema.pages = state.schema.pages.map((p) =>
              p.id === targetPageId ? { ...p, body: { ...p.body, ...updates } } : p
            );
          } else {
            newSchema.zones = {
              ...state.schema.zones,
              [zoneKey]: { ...state.schema.zones[zoneKey], ...updates },
            };
          }
          if (skipHistory) return { schema: newSchema };
          return pushHistory(state, newSchema);
        }),

      undo: () =>
        set((state) => {
          if (state.historyIndex <= 0) return state;
          const newIndex = state.historyIndex - 1;
          return {
            schema: state.history[newIndex],
            historyIndex: newIndex,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex >= state.history.length - 1) return state;
          const newIndex = state.historyIndex + 1;
          return {
            schema: state.history[newIndex],
            historyIndex: newIndex,
          };
        }),

      setSampleData: (data) => set({ sampleData: data }),
      setZoom: (zoom) => set({ zoom: Math.max(0.2, Math.min(zoom, 3.0)) }),
      setViewMode: (mode) =>
        set({
          viewMode: mode,
          zoom: mode === 'split' ? 0.65 : 1.0,
        }),
      setActiveTab: (tab) => set({ activeTab: tab, isSidebarOpen: true }),
      setActivePage: (pageId) => set({ activePageId: pageId }),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setRightSidebarOpen: (open) => set({ isRightSidebarOpen: open }),
      toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
      setDragState: (updates) =>
        set((state) => ({
          dragState: { ...state.dragState, ...updates },
        })),
      setTheme: (theme) => set({ theme }),
      setPrimaryColor: (color) => set({ primaryColor: color }),

      toggleComponentVisibility: (id) =>
        set((state) => {
          const isHidden = state.hiddenComponentIds.includes(id);
          const newHidden = isHidden
            ? state.hiddenComponentIds.filter((i) => i !== id)
            : [...state.hiddenComponentIds, id];
          return { hiddenComponentIds: newHidden };
        }),

      toggleComponentLock: (id) =>
        set((state) => {
          const isLocked = state.lockedComponentIds.includes(id);
          const newLocked = isLocked
            ? state.lockedComponentIds.filter((i) => i !== id)
            : [...state.lockedComponentIds, id];
          return { lockedComponentIds: newLocked };
        }),

      renameComponent: (id, name) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const components = newSchema.zones[key].components;
            const index = components.findIndex((c) => c.id === id);
            if (index !== -1) {
              const newComponents = [...components];
              newComponents[index] = { ...newComponents[index], name } as ComponentNode;
              newSchema.zones = {
                ...newSchema.zones,
                [key]: { ...newSchema.zones[key], components: newComponents },
              };
              changed = true;
              break;
            }
          }

          // Pages
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1) {
                const newComponents = [...page.body.components];
                newComponents[index] = { ...newComponents[index], name } as ComponentNode;
                changed = true;
                return { ...page, body: { ...page.body, components: newComponents } };
              }
              return page;
            });
          }

          if (!changed) return state;
          return pushHistory(state, newSchema);
        }),

      addPage: () =>
        set((state) => {
          const newPageId = `page-${state.schema.pages.length + 1}`;
          const newPage = {
            id: newPageId,
            name: `Page ${state.schema.pages.length + 1}`,
            body: { id: 'body', minHeight: '237mm', components: [] },
          };
          const newSchema = {
            ...state.schema,
            pages: [...state.schema.pages, newPage],
          };
          return { ...pushHistory(state, newSchema), activePageId: newPageId };
        }),

      removePage: (id) =>
        set((state) => {
          if (state.schema.pages.length <= 1) return state;
          const newPages = state.schema.pages.filter((p) => p.id !== id);
          const newSchema = { ...state.schema, pages: newPages };
          const newActiveId =
            state.activePageId === id ? newPages[newPages.length - 1].id : state.activePageId;
          return { ...pushHistory(state, newSchema), activePageId: newActiveId };
        }),

      reorderPage: (id, newIndex) =>
        set((state) => {
          const pages = [...state.schema.pages];
          const oldIndex = pages.findIndex((p) => p.id === id);
          if (oldIndex === -1) return state;
          const [page] = pages.splice(oldIndex, 1);
          pages.splice(newIndex, 0, page);
          return pushHistory(state, { ...state.schema, pages });
        }),

      setPageCount: (count) =>
        set((state) => {
          const targetCount = Math.max(1, count);
          const currentCount = state.schema.pages.length;
          if (targetCount === currentCount) return state;

          const newPages = [...state.schema.pages];
          if (targetCount > currentCount) {
            for (let i = currentCount; i < targetCount; i++) {
              newPages.push({
                id: `page-${i + 1}`,
                name: `Page ${i + 1}`,
                body: { id: 'body', minHeight: '237mm', components: [] },
              });
            }
          } else {
            newPages.splice(targetCount);
          }

          const newSchema = { ...state.schema, pages: newPages };
          const newActiveId = newPages.some((p) => p.id === state.activePageId)
            ? state.activePageId
            : (newPages[newPages.length - 1]?.id || null);

          return { ...pushHistory(state, newSchema), activePageId: newActiveId };
        }),

      bringToFront: (id) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const index = newSchema.zones[key].components.findIndex((c) => c.id === id);
            if (index !== -1) {
              const components = [...newSchema.zones[key].components];
              const [component] = components.splice(index, 1);
              components.push(component);
              newSchema.zones[key].components = components;
              changed = true;
              break;
            }
          }

          // Pages
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1) {
                const components = [...page.body.components];
                const [component] = components.splice(index, 1);
                components.push(component);
                changed = true;
                return { ...page, body: { ...page.body, components } };
              }
              return page;
            });
          }

          if (!changed) return state;
          return pushHistory(state, newSchema);
        }),

      sendToBack: (id) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const index = newSchema.zones[key].components.findIndex((c) => c.id === id);
            if (index !== -1) {
              const components = [...newSchema.zones[key].components];
              const [component] = components.splice(index, 1);
              components.unshift(component);
              newSchema.zones[key].components = components;
              changed = true;
              break;
            }
          }

          // Pages
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1) {
                const components = [...page.body.components];
                const [component] = components.splice(index, 1);
                components.unshift(component);
                changed = true;
                return { ...page, body: { ...page.body, components } };
              }
              return page;
            });
          }

          if (!changed) return state;
          return pushHistory(state, newSchema);
        }),

      moveUp: (id) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const index = newSchema.zones[key].components.findIndex((c) => c.id === id);
            if (index !== -1 && index < newSchema.zones[key].components.length - 1) {
              const components = [...newSchema.zones[key].components];
              [components[index], components[index + 1]] = [
                components[index + 1],
                components[index],
              ];
              newSchema.zones[key].components = components;
              changed = true;
              break;
            }
          }

          // Pages
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1 && index < page.body.components.length - 1) {
                const components = [...page.body.components];
                [components[index], components[index + 1]] = [
                  components[index + 1],
                  components[index],
                ];
                changed = true;
                return { ...page, body: { ...page.body, components } };
              }
              return page;
            });
          }

          if (!changed) return state;
          return pushHistory(state, newSchema);
        }),

      moveDown: (id) =>
        set((state) => {
          const newSchema = { ...state.schema };
          let changed = false;

          // Global
          for (const key of ['header', 'footer'] as ('header' | 'footer')[]) {
            const index = newSchema.zones[key].components.findIndex((c) => c.id === id);
            if (index !== -1 && index > 0) {
              const components = [...newSchema.zones[key].components];
              [components[index], components[index - 1]] = [
                components[index - 1],
                components[index],
              ];
              newSchema.zones[key].components = components;
              changed = true;
              break;
            }
          }

          // Pages
          if (!changed) {
            newSchema.pages = newSchema.pages.map((page) => {
              const index = page.body.components.findIndex((c) => c.id === id);
              if (index !== -1 && index > 0) {
                const components = [...page.body.components];
                [components[index], components[index - 1]] = [
                  components[index - 1],
                  components[index],
                ];
                changed = true;
                return { ...page, body: { ...page.body, components } };
              }
              return page;
            });
          }

          if (!changed) return state;
          return pushHistory(state, newSchema);
        }),
    }),
    {
      name: 'typstflow-settings',
      partialize: (state) => ({
        theme: state.theme,
        primaryColor: state.primaryColor,
      }),
    },
    {
      name: 'designer-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => {
        // Exclude dragState from persistence to avoid performance lag
        const { dragState, ...rest } = state;
        return rest;
      },
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          const state = persistedState as any;
          if (state.schema && !state.schema.pages) {
            // Transform legacy zones.body to pages array
            const bodyZone = state.schema.zones.body || { id: 'body', minHeight: '237mm', components: [] };
            state.schema.pages = [
              {
                id: 'page-1',
                name: 'Page 1',
                body: bodyZone,
              },
            ];
            // Remove legacy body zone
            // @ts-ignore - Cleaning up legacy field
            (state.schema.zones as any).body = undefined;
            state.activePageId = 'page-1';
          }
          return state;
        }
        return persistedState;
      },
    }
  )
);

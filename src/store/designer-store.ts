import { indexedDBStorage } from '@/lib/async-storage';
import { agentLogger } from '@/lib/utils/agent-logger';
import { generateStressTestSchema } from '@/lib/utils/performance-test';
import {
  findComponentInSchema,
  getZoneComponents,
  mapComponentInSchema,
  moveComponentInSchema,
  removeComponentFromSchema,
  removeComponentsFromSchema,
  reorderComponentInSchema,
} from '@/lib/utils/schema-mutators';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COMPLEX_SAMPLE_DATA, COMPLEX_TABLE_TEMPLATE } from '../lib/templates/complex-table';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '../lib/templates/invoice';
import {
  INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA,
  INVOICE_WITH_PAGE_BREAKS_TEMPLATE,
} from '../lib/templates/invoice-with-page-breaks';
import { TAX_INVOICE_SAMPLE_DATA, TAX_INVOICE_TEMPLATE } from '../lib/templates/tax-invoice';
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
  loadTemplate: (
    name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks' | 'tax-invoice'
  ) => void;
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

  // Keyboard/Clipboard Actions
  copySelected: () => void;
  paste: () => void;
  duplicateSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
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
    title: 'New Report',
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
      clipboard: null,
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
        agentLogger.log({
          source: 'ai-agent',
          level: 'action',
          message: `Loading template: ${name}`,
        });
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
        } else if (name === 'tax-invoice') {
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

      loadStressTest: (pages?: number, components?: number) => {
        agentLogger.log({
          source: 'system',
          level: 'info',
          message: `Generating stress test schema: ${pages} pages`,
        });
        const schema = generateStressTestSchema(pages, components);
        set({ schema, history: [schema], historyIndex: 0, activePageId: schema.pages[0]?.id });
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
          const { schema, changed } = mapComponentInSchema(
            state.schema,
            id,
            (c) => ({ ...c, ...updates }) as ComponentNode
          );
          if (!changed) return state;
          if (skipHistory) return { schema };
          return pushHistory(state, schema);
        }),

      removeComponent: (id) =>
        set((state) => {
          const { schema, changed } = removeComponentFromSchema(state.schema, id);
          if (!changed) return state;
          return { ...pushHistory(state, schema), selectedComponentIds: [] };
        }),

      removeComponents: (ids) =>
        set((state) => {
          const { schema, changed } = removeComponentsFromSchema(state.schema, ids);
          if (!changed) return state;
          return { ...pushHistory(state, schema), selectedComponentIds: [] };
        }),

      moveComponent: (id, fromZone, toZone, newIndex, x, y, fromPageId, toPageId, skipHistory) =>
        set((state) => {
          const { schema: newSchema, changed } = moveComponentInSchema(
            state.schema,
            id,
            fromZone as any,
            toZone as any,
            newIndex as any,
            x,
            y,
            fromPageId,
            toPageId
          );

          if (!changed) return state;
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
          const components = getZoneComponents(state.schema, zoneKey, pageId);

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
          const { schema, changed } = mapComponentInSchema(
            state.schema,
            id,
            (c) => ({ ...c, name }) as ComponentNode
          );
          if (!changed) return state;
          return pushHistory(state, schema);
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
            : newPages[newPages.length - 1]?.id || null;

          return { ...pushHistory(state, newSchema), activePageId: newActiveId };
        }),

      bringToFront: (id) =>
        set((state) => {
          const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
            const next = [...comps];
            const [c] = next.splice(idx, 1);
            next.push(c);
            return next;
          });
          if (!changed) return state;
          return pushHistory(state, schema);
        }),

      sendToBack: (id) =>
        set((state) => {
          const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
            const next = [...comps];
            const [c] = next.splice(idx, 1);
            next.unshift(c);
            return next;
          });
          if (!changed) return state;
          return pushHistory(state, schema);
        }),

      moveUp: (id) =>
        set((state) => {
          const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
            if (idx >= comps.length - 1) return null;
            const next = [...comps];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return next;
          });
          if (!changed) return state;
          return pushHistory(state, schema);
        }),

      moveDown: (id: string) => {
        set((state) => {
          const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
            if (idx <= 0) return null;
            const next = [...comps];
            [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
            return next;
          });
          if (!changed) return state;
          return pushHistory(state, schema);
        });
      },

      copySelected: () =>
        set((state) => {
          if (state.selectedComponentIds.length === 0) return state;
          const selectedComps = state.selectedComponentIds
            .map((id) => findComponentInSchema(state.schema, id))
            .filter((c): c is ComponentNode => c !== null);

          if (selectedComps.length === 0) return state;
          return { clipboard: selectedComps };
        }),

      paste: () =>
        set((state) => {
          if (!state.clipboard || state.clipboard.length === 0) return state;

          const newSchema = { ...state.schema };
          const targetPageId = state.activePageId || state.schema.pages[0]?.id;
          const newIds: string[] = [];

          // Create copies with new IDs and slight offset
          const copies = state.clipboard.map((c) => {
            const newId = `${c.type}-${Math.random().toString(36).substring(2, 9)}`;
            newIds.push(newId);
            return {
              ...c,
              id: newId,
              x: (c.x || 0) + 5,
              y: (c.y || 0) + 5,
            };
          });

          // Always paste into active page body for now to keep it simple
          newSchema.pages = state.schema.pages.map((p) =>
            p.id === targetPageId
              ? {
                  ...p,
                  body: {
                    ...p.body,
                    components: [...p.body.components, ...copies],
                  },
                }
              : p
          );

          return {
            ...pushHistory(state, newSchema),
            selectedComponentIds: newIds,
            selectedZone: 'body',
          };
        }),

      duplicateSelected: () =>
        set((state) => {
          if (state.selectedComponentIds.length === 0) return state;
          const selectedComps = state.selectedComponentIds
            .map((id) => findComponentInSchema(state.schema, id))
            .filter((c): c is ComponentNode => c !== null);

          if (selectedComps.length === 0) return state;

          const newSchema = { ...state.schema };
          const newIds: string[] = [];

          const copies = selectedComps.map((c) => {
            const newId = `${c.type}-${Math.random().toString(36).substring(2, 9)}`;
            newIds.push(newId);
            return {
              ...c,
              id: newId,
              x: (c.x || 0) + 5,
              y: (c.y || 0) + 5,
            };
          });

          // Duplicate into the same zones/pages they came from would be complex,
          // let's just duplicate into the active page body for now as a baseline
          const targetPageId = state.activePageId || state.schema.pages[0]?.id;
          newSchema.pages = state.schema.pages.map((p) =>
            p.id === targetPageId
              ? {
                  ...p,
                  body: {
                    ...p.body,
                    components: [...p.body.components, ...copies],
                  },
                }
              : p
          );

          return {
            ...pushHistory(state, newSchema),
            selectedComponentIds: newIds,
            selectedZone: 'body',
          };
        }),

      nudgeSelected: (dx, dy) =>
        set((state) => {
          if (state.selectedComponentIds.length === 0) return state;

          let newSchema = state.schema;
          let anyChanged = false;

          for (const id of state.selectedComponentIds) {
            const { schema: updatedSchema, changed } = mapComponentInSchema(
              newSchema,
              id,
              (c) =>
                ({
                  ...c,
                  x: (c.x || 0) + dx,
                  y: (c.y || 0) + dy,
                }) as ComponentNode
            );
            if (changed) {
              newSchema = updatedSchema;
              anyChanged = true;
            }
          }

          if (!anyChanged) return state;
          // We don't push to history for every nudge step (high frequency)
          // But nudge via keyboard is usually 1 step at a time, so maybe we should?
          // Let's push to history to allow undoing nudges.
          return pushHistory(state, newSchema);
        }),
    }),
    {
      name: 'designer-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state: DesignerState) => {
        // Exclude dragState from persistence to avoid performance lag
        const { dragState, history, historyIndex, ...rest } = state;
        return rest;
      },
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          const state = persistedState as any;
          if (state.schema && !state.schema.pages) {
            // Transform legacy zones.body to pages array
            const bodyZone = state.schema.zones.body || {
              id: 'body',
              minHeight: '237mm',
              components: [],
            };
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
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Validate and repair schema on load
          const validSchema = validateAndRepairSchema(state.schema, BLANK_SCHEMA);
          if (validSchema !== state.schema) {
            agentLogger.log({
              source: 'system',
              level: 'warn',
              message: 'Corrupted schema detected and repaired on load',
            });
            state.schema = validSchema;
          }
          agentLogger.log({
            source: 'system',
            level: 'info',
            message: 'Designer state rehydrated',
          });
        }
      },
    }
  )
);

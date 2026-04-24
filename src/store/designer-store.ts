import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '../lib/templates/invoice';
import { COMPLEX_SAMPLE_DATA, COMPLEX_TABLE_TEMPLATE } from '../lib/templates/complex-table';
import { INVOICE_WITH_MANY_ITEMS_SAMPLE_DATA, INVOICE_WITH_PAGE_BREAKS_TEMPLATE } from '../lib/templates/invoice-with-page-breaks';
import type { ComponentNode, LayoutSchema } from '../types/schema';

type ZoneKey = 'header' | 'body' | 'footer';

interface DesignerState {
  // Schema
  schema: LayoutSchema;

  // App State
  viewMode: 'design' | 'preview' | 'split';
  zoom: number;
  activeTab: 'palette' | 'outline' | 'data';
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
  };

  // Actions
  addComponent: (zoneKey: ZoneKey, component: ComponentNode) => void;
  updateComponent: (id: string, updates: Partial<ComponentNode>, skipHistory?: boolean) => void;
  removeComponent: (id: string) => void;
  removeComponents: (ids: string[]) => void;
  moveComponent: (
    id: string,
    fromZone: ZoneKey,
    toZone: ZoneKey,
    newIndex: number,
    x?: number,
    y?: number
  ) => void;
  selectComponent: (id: string | null, multi?: boolean) => void;
  toggleComponentSelection: (id: string) => void;
  clearSelection: () => void;
  selectComponentsInRange: (rect: { x: number; y: number; width: number; height: number }, zoneKey: ZoneKey) => void;
  setSelectedCell: (cell: DesignerState['selectedCell']) => void;
  setSelectedCells: (cells: DesignerState['selectedCells']) => void;
  updateZone: (zoneKey: ZoneKey, updates: Partial<LayoutSchema['zones']['header']>, skipHistory?: boolean) => void;
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  setDragState: (updates: Partial<DesignerState['dragState']>) => void;
  setSampleData: (data: Record<string, any>) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data') => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  undo: () => void;
  redo: () => void;
  loadTemplate: (name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setPrimaryColor: (color: string) => void;
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
    body: { id: 'body', minHeight: '237mm', components: [] },
    footer: { id: 'footer', minHeight: '30mm', components: [] },
  },
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
      isSidebarOpen: true,
      isRightSidebarOpen: true,
      theme: 'dark',
      primaryColor: '#8B5CF6',
      selectedComponentIds: [],
      selectedZone: null,
      selectedCell: null,
      selectedCells: null,
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
        } else if (name === 'tax-invoice' as any) {
          const { TAX_INVOICE_TEMPLATE, TAX_INVOICE_SAMPLE_DATA } = require('../lib/templates/tax-invoice');
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

      addComponent: (zoneKey, component) =>
        set((state) => {
          const id = `${component.type}-${Math.random().toString(36).substring(2, 9)}`;
          const newComponent = {
            ...component,
            id,
            x: component.x ?? 10,
            y: component.y ?? 10,
            width: component.width ?? 100,
            height: component.height ?? 20,
          };
          const newSchema = {
            ...state.schema,
            zones: {
              ...state.schema.zones,
              [zoneKey]: {
                ...state.schema.zones[zoneKey],
                components: [...state.schema.zones[zoneKey].components, newComponent],
              },
            },
          };
          return pushHistory(state, newSchema);
        }),

      updateComponent: (id, updates, skipHistory) =>
        set((state) => {
          const zones = state.schema.zones;
          let foundKey: ZoneKey | null = null;
          let newComponents: ComponentNode[] | null = null;

          for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
            const components = zones[key].components;
            const index = components.findIndex((c) => c.id === id);
            if (index !== -1) {
              foundKey = key;
              newComponents = [...components];
              newComponents[index] = { ...newComponents[index], ...updates } as ComponentNode;
              break;
            }
          }

          if (!foundKey || !newComponents) return state;

          const newSchema = {
            ...state.schema,
            zones: {
              ...zones,
              [foundKey]: {
                ...zones[foundKey],
                components: newComponents,
              },
            },
          };

          if (skipHistory) return { schema: newSchema };
          return pushHistory(state, newSchema);
        }),

      removeComponent: (id) =>
        set((state) => {
          const zones = { ...state.schema.zones };
          let changed = false;

          for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
            const originalComponents = zones[key].components;
            const newComponents = originalComponents.filter((c) => c.id !== id);
            
            if (newComponents.length !== originalComponents.length) {
              zones[key] = {
                ...zones[key],
                components: newComponents,
              };
              changed = true;
            }
          }

          if (!changed) return state;

          const newSchema = { ...state.schema, zones };
          return { ...pushHistory(state, newSchema), selectedComponentIds: [] };
        }),

      removeComponents: (ids) =>
        set((state) => {
          const zones = { ...state.schema.zones };
          let changed = false;

          for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
            const originalComponents = zones[key].components;
            const newComponents = originalComponents.filter((c) => !ids.includes(c.id));
            
            if (newComponents.length !== originalComponents.length) {
              zones[key] = {
                ...zones[key],
                components: newComponents,
              };
              changed = true;
            }
          }

          if (!changed) return state;

          const newSchema = { ...state.schema, zones };
          return { ...pushHistory(state, newSchema), selectedComponentIds: [] };
        }),

      moveComponent: (id, fromZone, toZone, newIndex, x?: number, y?: number) =>
        set((state) => {
          const zones = state.schema.zones;
          const component = zones[fromZone].components.find((c) => c.id === id);
          if (!component) return state;

          // Create new component with updated position
          const updatedComponent = {
            ...component,
            ...(x !== undefined ? { x } : {}),
            ...(y !== undefined ? { y } : {}),
          };

          // Prepare new zones object
          const newZones = { ...zones };

          if (fromZone === toZone) {
            // Move within same zone
            const components = [...zones[fromZone].components].filter((c) => c.id !== id);
            components.splice(newIndex, 0, updatedComponent);
            newZones[fromZone] = {
              ...zones[fromZone],
              components,
            };
          } else {
            // Move between zones
            const fromComponents = [...zones[fromZone].components].filter((c) => c.id !== id);
            const toComponents = [...zones[toZone].components];
            toComponents.splice(newIndex, 0, updatedComponent);

            newZones[fromZone] = {
              ...zones[fromZone],
              components: fromComponents,
            };
            newZones[toZone] = {
              ...zones[toZone],
              components: toComponents,
            };
          }

          const newSchema = { ...state.schema, zones: newZones };
          return pushHistory(state, newSchema);
        }),

      selectComponent: (id, multi) =>
        set((state) => {
          if (!id) return { selectedComponentIds: [], selectedCell: null, selectedCells: null };
          
          if (multi) {
            // Add to selection if not already there
            if (state.selectedComponentIds.includes(id)) return state;
            return { selectedComponentIds: [...state.selectedComponentIds, id], selectedCell: null, selectedCells: null };
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

      clearSelection: () => set({ selectedComponentIds: [], selectedCell: null, selectedCells: null, selectedZone: null }),

      selectComponentsInRange: (rect, zoneKey) =>
        set((state) => {
          const zone = state.schema.zones[zoneKey];
          const foundIds = zone.components
            .filter((comp) => {
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

          // For range selection, we usually want to ADD to existing selection if we are looping through zones
          // but we'll handle the clearing at the start of the marquee drag.
          const newIds = [...new Set([...state.selectedComponentIds, ...foundIds])];

          return { 
            selectedComponentIds: newIds, 
            selectedZone: zoneKey, 
            selectedCell: null, 
            selectedCells: null 
          };
        }),

      setSelectedCell: (cell) => set({ selectedCell: cell, selectedCells: cell ? { 
        tableId: cell.tableId, 
        section: cell.section, 
        rowIds: [cell.rowId], 
        cellIndices: [cell.cellIdx] 
      } : null }),

      setSelectedCells: (cells) => set({ selectedCells: cells }),

      updateSchema: (updates: Partial<LayoutSchema>) =>
        set((state) => {
          const newSchema = { ...state.schema, ...updates };
          return pushHistory(state, newSchema);
        }),

      updateZone: (zoneKey, updates, skipHistory) =>
        set((state) => {
          const newSchema = {
            ...state.schema,
            zones: {
              ...state.schema.zones,
              [zoneKey]: {
                ...state.schema.zones[zoneKey],
                ...updates,
              },
            },
          };
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
      setViewMode: (mode) => set({ 
        viewMode: mode,
        zoom: mode === 'split' ? 0.65 : 1.0 
      }),
      setActiveTab: (tab) => set({ activeTab: tab, isSidebarOpen: true }),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setRightSidebarOpen: (open) => set({ isRightSidebarOpen: open }),
      toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
      setDragState: (updates) => set((state) => ({ 
        dragState: { ...state.dragState, ...updates } 
      })),
      setTheme: (theme) => set({ theme }),
      setPrimaryColor: (color) => set({ primaryColor: color }),
    }),
    {
      name: 'typstflow-settings',
      partialize: (state) => ({ 
        theme: state.theme, 
        primaryColor: state.primaryColor 
      }),
    }
  )
);

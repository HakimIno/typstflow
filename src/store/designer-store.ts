import { create } from 'zustand';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '../lib/templates/invoice';
import { COMPLEX_SAMPLE_DATA, COMPLEX_TABLE_TEMPLATE } from '../lib/templates/complex-table';
import type { ComponentNode, LayoutSchema } from '../types/schema';

type ZoneKey = 'header' | 'body' | 'footer';

interface DesignerState {
  // Schema
  schema: LayoutSchema;

  // App State
  viewMode: 'design' | 'preview' | 'split';
  activeTab: 'palette' | 'outline' | 'data';
  isSidebarOpen: boolean;

  // Selection
  selectedComponentId: string | null;
  selectedZone: ZoneKey | null;

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
    lastSnappedX: number; // For drop persistence
    lastSnappedY: number; // For drop persistence
    activeGuides: {
      vertical: number[]; // x positions in mm
      horizontal: number[]; // y positions in mm
    };
  };

  // Actions
  addComponent: (zoneKey: ZoneKey, component: ComponentNode) => void;
  updateComponent: (id: string, updates: Partial<ComponentNode>) => void;
  removeComponent: (id: string) => void;
  moveComponent: (
    id: string,
    fromZone: ZoneKey,
    toZone: ZoneKey,
    newIndex: number,
    x?: number,
    y?: number
  ) => void;
  selectComponent: (id: string | null) => void;
  updateZone: (zoneKey: ZoneKey, updates: Partial<LayoutSchema['zones']['header']>) => void;
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  setDragState: (updates: Partial<DesignerState['dragState']>) => void;
  setSampleData: (data: Record<string, any>) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data') => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  undo: () => void;
  redo: () => void;
  loadTemplate: (name: 'blank' | 'invoice' | 'complex') => void;
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
    body: { id: 'body', minHeight: '150mm', components: [] },
    footer: { id: 'footer', minHeight: '20mm', components: [] },
  },
  variables: [],
  dataSchema: [],
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Antigravity',
  },
};

export const useDesignerStore = create<DesignerState>((set) => ({
  schema: BLANK_SCHEMA,
  viewMode: 'design',
  activeTab: 'palette',
  isSidebarOpen: true,
  selectedComponentId: null,
  selectedZone: null,
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

  updateComponent: (id, updates) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
        const components = [...newZones[key].components];
        const index = components.findIndex((c) => c.id === id);
        if (index !== -1) {
          components[index] = { ...components[index], ...updates } as ComponentNode;
          newZones[key].components = components;
          break;
        }
      }
      const newSchema = { ...state.schema, zones: newZones };
      return pushHistory(state, newSchema);
    }),

  removeComponent: (id) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
        newZones[key].components = newZones[key].components.filter((c) => c.id !== id);
      }
      const newSchema = { ...state.schema, zones: newZones };
      return { ...pushHistory(state, newSchema), selectedComponentId: null };
    }),

  moveComponent: (id, fromZone, toZone, newIndex, x?: number, y?: number) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      const component = newZones[fromZone].components.find((c) => c.id === id);
      if (!component) return state;

      // Remove from source
      newZones[fromZone].components = newZones[fromZone].components.filter((c) => c.id !== id);

      // Update coordinates if provided
      const updatedComponent = {
        ...component,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
      };

      // Add to target
      newZones[toZone].components.splice(newIndex, 0, updatedComponent);

      const newSchema = { ...state.schema, zones: newZones };
      return pushHistory(state, newSchema);
    }),

  selectComponent: (id: string | null) => set({ selectedComponentId: id }),

  updateSchema: (updates: Partial<LayoutSchema>) =>
    set((state) => {
      const newSchema = { ...state.schema, ...updates };
      return pushHistory(state, newSchema);
    }),

  updateZone: (zoneKey: ZoneKey, updates: Partial<LayoutSchema['zones']['header']>) =>
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
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab, isSidebarOpen: true }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setDragState: (updates) => set((state) => ({ 
    dragState: { ...state.dragState, ...updates } 
  })),
}));

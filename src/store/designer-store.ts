import { create } from 'zustand';
import { INVOICE_SAMPLE_DATA, INVOICE_TEMPLATE } from '../lib/templates/invoice';
import type { ComponentNode, LayoutSchema } from '../types/schema';

type ZoneKey = 'header' | 'body' | 'footer';

interface DesignerState {
  // Schema
  schema: LayoutSchema;

  // App State
  viewMode: 'design' | 'preview' | 'split';
  activeTab: 'palette' | 'outline' | 'data';

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
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  setSampleData: (data: Record<string, any>) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data') => void;
  loadTemplate: (name: 'blank' | 'invoice') => void;
}

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
    header: { id: 'header', components: [] },
    body: { id: 'body', components: [] },
    footer: { id: 'footer', components: [] },
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
  selectedComponentId: null,
  selectedZone: null,
  sampleData: {},
  previewPages: [],
  previewStatus: 'idle',
  previewError: null,
  history: [BLANK_SCHEMA],
  historyIndex: 0,

  loadTemplate: (name) => {
    if (name === 'invoice') {
      set({
        schema: INVOICE_TEMPLATE,
        sampleData: INVOICE_SAMPLE_DATA,
        history: [INVOICE_TEMPLATE],
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
      return {
        schema: {
          ...state.schema,
          zones: {
            ...state.schema.zones,
            [zoneKey]: {
              ...state.schema.zones[zoneKey],
              components: [...state.schema.zones[zoneKey].components, newComponent],
            },
          },
        },
      };
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
      return { schema: { ...state.schema, zones: newZones } };
    }),

  removeComponent: (id) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
        newZones[key].components = newZones[key].components.filter((c) => c.id !== id);
      }
      return { schema: { ...state.schema, zones: newZones }, selectedComponentId: null };
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

      return { schema: { ...state.schema, zones: newZones } };
    }),

  selectComponent: (id) => set({ selectedComponentId: id }),

  updateSchema: (updates) => set((state) => ({ schema: { ...state.schema, ...updates } })),

  setSampleData: (data) => set({ sampleData: data }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

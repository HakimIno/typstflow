import { create } from 'zustand';
import { LayoutSchema, ComponentNode, Zone } from '../types/schema';

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
  moveComponent: (id: string, fromZone: ZoneKey, toZone: ZoneKey, newIndex: number) => void;
  selectComponent: (id: string | null) => void;
  updateSchema: (updates: Partial<LayoutSchema>) => void;
  setSampleData: (data: Record<string, any>) => void;
  setViewMode: (mode: 'design' | 'preview' | 'split') => void;
  setActiveTab: (tab: 'palette' | 'outline' | 'data') => void;
}

const initialSchema: LayoutSchema = {
  id: 'new-report',
  name: 'New Report',
  version: '1.0.0',
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
  },
  fonts: [
    { family: 'Sarabun', role: 'body', size: 10, embedded: true },
  ],
  zones: {
    header: { id: 'header', components: [] },
    body: { id: 'body', components: [] },
    footer: { id: 'footer', components: [] },
  },
  variables: [],
  dataSchema: [],
  metadata: {
    createdAt: '2024-04-09T00:00:00Z',
    updatedAt: '2024-04-09T00:00:00Z',
    author: 'Antigravity',
  },
};

export const useDesignerStore = create<DesignerState>((set) => ({
  schema: initialSchema,
  viewMode: 'design',
  activeTab: 'palette',
  selectedComponentId: null,
  selectedZone: null,
  sampleData: {},
  previewPages: [],
  previewStatus: 'idle',
  previewError: null,
  history: [initialSchema],
  historyIndex: 0,

  addComponent: (zoneKey, component) => 
    set((state) => ({
      schema: {
        ...state.schema,
        zones: {
          ...state.schema.zones,
          [zoneKey]: {
            ...state.schema.zones[zoneKey],
            components: [...state.schema.zones[zoneKey].components, component],
          },
        },
      },
    })),

  updateComponent: (id, updates) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      for (const key of ['header', 'body', 'footer'] as ZoneKey[]) {
        const index = newZones[key].components.findIndex((c) => c.id === id);
        if (index !== -1) {
          newZones[key].components[index] = { ...newZones[key].components[index], ...updates } as any;
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

  moveComponent: (id, fromZone, toZone, newIndex) =>
    set((state) => {
      const newZones = { ...state.schema.zones };
      const component = newZones[fromZone].components.find(c => c.id === id);
      if (!component) return state;

      // Remove from source
      newZones[fromZone].components = newZones[fromZone].components.filter(c => c.id !== id);
      // Add to target
      newZones[toZone].components.splice(newIndex, 0, component);

      return { schema: { ...state.schema, zones: newZones } };
    }),

  selectComponent: (id) => set({ selectedComponentId: id }),

  updateSchema: (updates) =>
    set((state) => ({ schema: { ...state.schema, ...updates } })),

  setSampleData: (data) => set({ sampleData: data }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

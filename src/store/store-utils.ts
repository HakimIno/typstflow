import type { ComponentNode, LayoutSchema, Zone } from '@/types/schema';
import type { DesignerState } from './store-types';

export const MAX_HISTORY = 50;

export const buildComponentRegistry = (schema: LayoutSchema): Record<string, ComponentNode> => {
  const registry: Record<string, ComponentNode> = {};
  const processZone = (zone: Zone) => {
    for (const comp of zone.components) {
      registry[comp.id] = comp;
    }
  };

  processZone(schema.zones.header);
  processZone(schema.zones.footer);
  for (const page of schema.pages) {
    processZone(page.body);
  }
  for (const group of schema.groups || []) {
    processZone(group.header);
    processZone(group.footer);
  }
  return registry;
};

export const pushHistory = (
  state: Pick<DesignerState, 'history' | 'historyIndex' | 'schema'>,
  newSchema: LayoutSchema
): {
  schema: LayoutSchema;
  componentRegistry: Record<string, ComponentNode>;
  history: LayoutSchema[];
  historyIndex: number;
} => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(newSchema);
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  return {
    schema: newSchema,
    componentRegistry: buildComponentRegistry(newSchema),
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
};

export const BLANK_SCHEMA: LayoutSchema = {
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
  groups: [],
  variables: [],
  dataSchema: [],
  metadata: {
    title: 'New Report',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: 'Antigravity',
  },
};

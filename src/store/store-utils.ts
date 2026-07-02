import type { ComponentNode, LayoutSchema, Zone } from '@/types/schema';
import type { DesignerState } from './store-types';

export const MAX_HISTORY = 50;

/** Returns a smaller history limit for large schemas to prevent memory buildup. */
export const getMaxHistory = (schema: LayoutSchema): number => {
  const componentCount =
    schema.zones.header.components.length +
    schema.zones.footer.components.length +
    schema.pages.reduce((sum, p) => sum + p.body.components.length, 0) +
    (schema.groups ?? []).reduce(
      (sum, g) => sum + g.header.components.length + g.footer.components.length,
      0
    );
  if (componentCount > 500) return 10;
  if (componentCount > 200) return 20;
  if (componentCount > 100) return 30;
  return MAX_HISTORY;
};

/**
 * Returns a history-safe copy of the schema with `srcData` stripped from all
 * image components.  The live `schema` keeps srcData for canvas preview; history
 * entries only need layout/positioning data (src is retained for display URL).
 *
 * This avoids storing potentially hundreds of MBs of base64 strings in the
 * undo/redo stack and in IndexedDB persistence.
 */
export const stripSrcDataForHistory = (schema: LayoutSchema): LayoutSchema => {
  const stripComp = (comp: ComponentNode): ComponentNode => {
    if (comp.type === 'image' && (comp as any).srcData) {
      const { srcData: _dropped, ...rest } = comp as any;
      return rest as ComponentNode;
    }
    // Recurse into column layouts
    if (comp.type === 'columns' && (comp as any).columns) {
      return {
        ...comp,
        columns: (comp as any).columns.map((col: any) => ({
          ...col,
          components: (col.components ?? []).map(stripComp),
        })),
      } as ComponentNode;
    }
    if (comp.type === 'form-box' && comp.components) {
      return {
        ...comp,
        components: comp.components.map(stripComp),
      } as ComponentNode;
    }
    return comp;
  };

  const stripZone = (zone: Zone): Zone => ({
    ...zone,
    components: zone.components.map(stripComp),
  });

  return {
    ...schema,
    zones: {
      header: stripZone(schema.zones.header),
      footer: stripZone(schema.zones.footer),
    },
    pages: schema.pages.map((page) => ({
      ...page,
      body: stripZone(page.body),
    })),
    groups: (schema.groups ?? []).map((g) => ({
      ...g,
      header: stripZone(g.header),
      footer: stripZone(g.footer),
    })),
  };
};

export const buildComponentRegistry = (schema: LayoutSchema): Record<string, ComponentNode> => {
  const registry: Record<string, ComponentNode> = {};

  const processComponent = (comp: ComponentNode) => {
    registry[comp.id] = comp;
    if (comp.type === 'columns' && comp.columns) {
      for (const col of comp.columns) {
        if (col.components) {
          for (const child of col.components) {
            processComponent(child);
          }
        }
      }
    } else if (comp.type === 'repeater' && (comp as any).children) {
      for (const child of (comp as any).children) {
        processComponent(child);
      }
    } else if (comp.type === 'form-box' && comp.components) {
      for (const child of comp.components) {
        processComponent(child);
      }
    }
  };

  const processZone = (zone: Zone) => {
    for (const comp of zone.components) {
      processComponent(comp);
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
  // Strip srcData before pushing to history to avoid unbounded memory growth
  // from large base64 image data in every undo/redo snapshot.
  const historyEntry = stripSrcDataForHistory(newSchema);
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(historyEntry);
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

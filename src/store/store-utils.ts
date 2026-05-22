import { buildComponentRegistry, patchComponentRegistry } from '@/lib/utils/component-registry';
import { shareSchemaStructure } from '@/lib/utils/schema-structure';
import { syncHistoryMeta, wasmSchemaStore } from '@/lib/wasm-schema-store';
import type { ComponentNode, LayoutSchema } from '@/types/schema';
import type { DesignerState } from './store-types';

export { buildComponentRegistry } from '@/lib/utils/component-registry';

export const MAX_HISTORY = 50;

/** Adaptive undo depth — scales down for large page counts and component counts. */
export const getMaxHistory = (schema: LayoutSchema): number => {
  const pageCount = schema.pages.length;
  if (pageCount > 500) return 5;
  if (pageCount > 200) return 10;
  if (pageCount > 100) return 15;

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

export const pushHistory = (
  state: Pick<DesignerState, 'schema' | 'componentRegistry'>,
  newSchema: LayoutSchema
): {
  schema: LayoutSchema;
  componentRegistry: Record<string, ComponentNode>;
  historyIndex: number;
  historyLength: number;
} => {
  const sharedSchema = shareSchemaStructure(state.schema, newSchema);

  if (wasmSchemaStore.isReady()) {
    wasmSchemaStore.pushSync(sharedSchema);
  } else {
    void wasmSchemaStore.push(sharedSchema);
  }

  const meta = syncHistoryMeta();

  return {
    schema: sharedSchema,
    componentRegistry: patchComponentRegistry(
      state.componentRegistry,
      state.schema,
      sharedSchema
    ),
    ...meta,
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

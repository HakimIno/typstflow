import { agentLogger } from '@/lib/utils/agent-logger';
import {
  SchemaImportError,
  countSchemaComponents,
  parseImportBundle,
} from '@/lib/utils/schema-import';
import { resetWasmSchemaStore, syncHistoryMeta } from '@/lib/wasm-schema-store';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { buildComponentRegistry } from '../store-utils';

export type IOSlice = Pick<DesignerState, 'exportSchema' | 'importSchema'>;

// Reference to the store instance — set after store creation to allow exportSchema to call getState()
let _storeRef: (() => DesignerState) | null = null;

export const setStoreRef = (getState: () => DesignerState) => {
  _storeRef = getState;
};

export const createIOSlice: StateCreator<DesignerState, [], [], IOSlice> = (set, get) => ({
  exportSchema: () => {
    const state = get();

    // Bundle schema with sample data for a complete export
    const exportBundle = {
      schema: state.schema,
      data: state.sampleData,
      exportedAt: new Date().toISOString(),
      version: state.schema.version,
    };

    const data = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `${state.schema.name.toLowerCase().replace(/\s+/g, '-')}-bundle-${
      new Date().toISOString().split('T')[0]
    }.json`;

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    agentLogger.log({
      source: 'ai-agent',
      level: 'action',
      message: `Exported complete bundle: ${filename}`,
    });
  },

  importSchema: (json: string) => {
    const state = get();
    try {
      const { schema: validSchema, data: sampleData } = parseImportBundle(json);
      const componentCount = countSchemaComponents(validSchema);
      const firstPageId = validSchema.pages[0]?.id ?? null;

      set({
        schema: validSchema,
        componentRegistry: buildComponentRegistry(validSchema),
        sampleData: sampleData ?? state.sampleData,
        selectedComponentIds: [],
        selectedGroupId: null,
        selectedZone: null,
        activePageId: firstPageId,
        scrollToPageId: firstPageId,
        historyIndex: 0,
        historyLength: 1,
      });

      resetWasmSchemaStore(validSchema);
      set(syncHistoryMeta());

      agentLogger.log({
        source: 'ai-agent',
        level: 'action',
        message: `Imported schema: ${validSchema.name} (${componentCount} components)`,
      });

      state.showDialog({
        title: 'Import Successful',
        message: `Loaded "${validSchema.name}" with ${componentCount} components across ${validSchema.pages.length} page(s).`,
        variant: 'success',
        confirmLabel: 'OK',
        onConfirm: () => get().hideDialog(),
      });
    } catch (error) {
      console.error('Failed to import schema:', error);
      const message =
        error instanceof SchemaImportError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown import error';

      agentLogger.log({
        source: 'system',
        level: 'error',
        message: `Import failed: ${message}`,
      });

      get().showDialog({
        title: 'Import Failed',
        message,
        variant: 'danger',
        confirmLabel: 'OK',
        onConfirm: () => get().hideDialog(),
      });
    }
  },
});

import { agentLogger } from '@/lib/utils/agent-logger';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { BLANK_SCHEMA, pushHistory } from '../store-utils';

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
    try {
      const rawData = JSON.parse(json);
      // Handle bundled format: { "schema": ..., "data": ... }
      const schemaToValidate = rawData.schema || rawData;
      const sampleData = rawData.data ?? rawData.sampleData ?? null;

      const validSchema = validateAndRepairSchema(schemaToValidate, BLANK_SCHEMA);

      set((state) => ({
        ...pushHistory(state, validSchema),
        sampleData: sampleData || state.sampleData,
        selectedComponentIds: [],
        selectedGroupId: null,
        selectedZone: null,
        activePageId: validSchema.pages[0]?.id || null,
      }));

      agentLogger.log({
        source: 'ai-agent',
        level: 'action',
        message: `Imported schema: ${validSchema.name}`,
      });
    } catch (error) {
      console.error('Failed to import schema:', error);
      agentLogger.log({
        source: 'system',
        level: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
});

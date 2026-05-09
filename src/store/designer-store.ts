// Re-export types so existing imports still work
export type { DialogOptions } from './store-types';

import { indexedDBStorage } from '@/lib/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import { agentLogger } from '@/lib/utils/agent-logger';
import { buildComponentRegistry, BLANK_SCHEMA } from './store-utils';
import type { DesignerState } from './store-types';
import { createSchemaSlice } from './slices/schema-slice';
import { createSelectionSlice } from './slices/selection-slice';
import { createLayerSlice } from './slices/layer-slice';
import { createPageSlice } from './slices/page-slice';
import { createUISlice } from './slices/ui-slice';
import { createPreviewSlice } from './slices/preview-slice';
import { createTemplateSlice } from './slices/template-slice';
import { createIOSlice } from './slices/io-slice';
import { createDialogSlice } from './slices/dialog-slice';
import { createFontSlice } from './slices/font-slice';

export const useDesignerStore = create<DesignerState>()(
  persist(
    (...a) => ({
      ...createSchemaSlice(...a),
      ...createSelectionSlice(...a),
      ...createLayerSlice(...a),
      ...createPageSlice(...a),
      ...createUISlice(...a),
      ...createPreviewSlice(...a),
      ...createTemplateSlice(...a),
      ...createIOSlice(...a),
      ...createDialogSlice(...a),
      ...createFontSlice()(...a),
      // Override schema/history/componentRegistry with proper initial values
      schema: BLANK_SCHEMA,
      componentRegistry: buildComponentRegistry(BLANK_SCHEMA),
      history: [BLANK_SCHEMA],
      historyIndex: 0,
    }),
    {
      name: 'designer-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state: DesignerState) => {
        const { dragState, history, historyIndex, _hasHydrated, dialog, componentRegistry, loadingFonts, ...rest } = state;
        return rest;
      },
      version: 3,
      migrate: (persistedState: any, version: number) => {
        const state = persistedState as any;
        if (version < 2) {
          if (state.schema && !state.schema.pages) {
            const bodyZone = state.schema.zones.body || { id: 'body', minHeight: '237mm', components: [] };
            state.schema.pages = [{ id: 'page-1', name: 'Page 1', body: bodyZone, footer: { id: 'footer', minHeight: '20mm', components: [] } }];
            (state.schema.zones as any).body = undefined;
            state.activePageId = 'page-1';
          }
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const validSchema = validateAndRepairSchema(state.schema, BLANK_SCHEMA);
          if (validSchema !== state.schema) state.schema = validSchema;
          state.componentRegistry = buildComponentRegistry(state.schema);
          agentLogger.log({ source: 'system', level: 'info', message: 'Designer state rehydrated' });
          state.setHasHydrated(true);
        }
      },
    }
  )
);

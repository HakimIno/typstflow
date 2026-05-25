// Re-export types so existing imports still work
export type { DialogOptions } from './store-types';

import { indexedDBStorage } from '@/lib/async-storage';
import { agentLogger } from '@/lib/utils/agent-logger';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createBlocksSlice } from './slices/blocks-slice';
import { createDialogSlice } from './slices/dialog-slice';
import { createFontSlice } from './slices/font-slice';
import { createGuidesSlice } from './slices/guides-slice';
import { createIOSlice } from './slices/io-slice';
import { createLayerSlice } from './slices/layer-slice';
import { createPageSlice } from './slices/page-slice';
import { createPreviewSlice } from './slices/preview-slice';
import { createSchemaSlice } from './slices/schema-slice';
import { createSelectionSlice } from './slices/selection-slice';
import { createTemplateSlice } from './slices/template-slice';
import { createUISlice } from './slices/ui-slice';
import type { DesignerState } from './store-types';
import { BLANK_SCHEMA, buildComponentRegistry } from './store-utils';

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
      ...createGuidesSlice(...a),
      ...createBlocksSlice(...a),
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
        const { dragState, _hasHydrated, dialog, componentRegistry, loadingFonts, ...rest } = state;
        return rest;
      },
      version: 4,
      migrate: (persistedState: any, version: number) => {
        const state = persistedState as any;
        if (version < 2) {
          if (state.schema && !state.schema.pages) {
            const bodyZone = state.schema.zones.body || {
              id: 'body',
              minHeight: '237mm',
              components: [],
            };
            state.schema.pages = [
              {
                id: 'page-1',
                name: 'Page 1',
                body: bodyZone,
                footer: { id: 'footer', minHeight: '20mm', components: [] },
              },
            ];
            (state.schema.zones as any).body = undefined;
            state.activePageId = 'page-1';
          }
        }
        if (version < 4) {
          // history was not persisted before v4 — seed from current schema
          if (!Array.isArray(state.history) || state.history.length === 0) {
            state.history = state.schema ? [state.schema] : [];
            state.historyIndex = Math.max(0, state.history.length - 1);
          }
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const validSchema = validateAndRepairSchema(state.schema, BLANK_SCHEMA);
          if (validSchema !== state.schema) state.schema = validSchema;
          state.componentRegistry = buildComponentRegistry(state.schema);
          // Validate persisted history — clamp index or seed from schema if corrupt/empty.
          if (!Array.isArray(state.history) || state.history.length === 0) {
            state.history = [state.schema];
            state.historyIndex = 0;
          } else {
            state.historyIndex = Math.min(
              Math.max(0, state.historyIndex),
              state.history.length - 1
            );
          }
          // Keep localStorage in sync so the blocking theme script has correct
          // values on the very next page load (avoids flash even before React mounts).
          try {
            localStorage.setItem('typstflow-theme', state.theme);
            localStorage.setItem('typstflow-primary-color', state.primaryColor);
          } catch {}
          agentLogger.log({
            source: 'system',
            level: 'info',
            message: 'Designer state rehydrated',
          });
          state.setHasHydrated(true);
        }
      },
    }
  )
);

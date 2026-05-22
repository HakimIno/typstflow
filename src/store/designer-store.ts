// Re-export types so existing imports still work
export type { DialogOptions } from './store-types';

import { msgpackIndexedDBStorage } from '@/lib/msgpack-storage';
import { initWasmSchemaStore, syncHistoryMeta } from '@/lib/wasm-schema-store';
import { agentLogger } from '@/lib/utils/agent-logger';
import { validateAndRepairSchema } from '@/lib/utils/schema-validator';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
      // Override schema/history metadata/componentRegistry with proper initial values
      schema: BLANK_SCHEMA,
      componentRegistry: buildComponentRegistry(BLANK_SCHEMA),
      historyIndex: 0,
      historyLength: 1,
    }),
    {
      name: 'designer-storage',
      storage: createJSONStorage(() => msgpackIndexedDBStorage),
      partialize: (state: DesignerState) => {
        const {
          dragState,
          _hasHydrated,
          dialog,
          componentRegistry,
          loadingFonts,
          historyIndex: _historyIndex,
          historyLength: _historyLength,
          ...rest
        } = state;
        // Persist current schema only — undo stack lives in WASM (in-memory).
        return rest;
      },
      version: 7,
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
        if (version < 5) {
          state.history = undefined;
          state.historyIndex = undefined;
        }
        if (version < 6) {
          // v6: IndexedDB payload migrated from JSON objects to MessagePack (TFMP) on next save.
        }
        if (version < 7) {
          delete state.history;
          state.historyIndex = 0;
          state.historyLength = 1;
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          const validSchema = validateAndRepairSchema(state.schema, BLANK_SCHEMA);
          if (validSchema !== state.schema) state.schema = validSchema;
          state.componentRegistry = buildComponentRegistry(state.schema);
          state.historyIndex = 0;
          state.historyLength = 1;
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
          // Unblock UI immediately — WASM schema store initializes in background.
          state.setHasHydrated(true);
          void initWasmSchemaStore(state.schema).then(() => {
            const meta = syncHistoryMeta();
            state.historyIndex = meta.historyIndex;
            state.historyLength = meta.historyLength;
          });
        }
      },
    }
  )
);

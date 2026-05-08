import { mapComponentInSchema, reorderComponentInSchema } from '@/lib/utils/schema-mutators';
import type { ComponentNode } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { pushHistory } from '../store-utils';

export type LayerSlice = Pick<
  DesignerState,
  | 'hiddenComponentIds'
  | 'lockedComponentIds'
  | 'toggleComponentVisibility'
  | 'toggleComponentLock'
  | 'renameComponent'
  | 'bringToFront'
  | 'sendToBack'
  | 'moveUp'
  | 'moveDown'
  | 'bringToFrontMany'
  | 'sendToBackMany'
  | 'moveUpMany'
  | 'moveDownMany'
>;

export const createLayerSlice: StateCreator<DesignerState, [], [], LayerSlice> = (set, _get) => ({
  hiddenComponentIds: [],
  lockedComponentIds: [],

  toggleComponentVisibility: (id: string) =>
    set((state) => {
      const isHidden = state.hiddenComponentIds.includes(id);
      const newHidden = isHidden
        ? state.hiddenComponentIds.filter((i) => i !== id)
        : [...state.hiddenComponentIds, id];
      return { hiddenComponentIds: newHidden };
    }),

  toggleComponentLock: (id: string) =>
    set((state) => {
      const isLocked = state.lockedComponentIds.includes(id);
      const newLocked = isLocked
        ? state.lockedComponentIds.filter((i) => i !== id)
        : [...state.lockedComponentIds, id];
      return { lockedComponentIds: newLocked };
    }),

  renameComponent: (id: string, name: string) =>
    set((state) => {
      const { schema, changed } = mapComponentInSchema(
        state.schema,
        id,
        (c) => ({ ...c, name }) as ComponentNode
      );
      if (!changed) return state;
      return pushHistory(state, schema);
    }),

  bringToFront: (id: string) =>
    set((state) => {
      const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
        const next = [...comps];
        const [c] = next.splice(idx, 1);
        next.push(c);
        return next;
      });
      if (!changed) return state;
      return pushHistory(state, schema);
    }),

  sendToBack: (id: string) =>
    set((state) => {
      const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
        const next = [...comps];
        const [c] = next.splice(idx, 1);
        next.unshift(c);
        return next;
      });
      if (!changed) return state;
      return pushHistory(state, schema);
    }),

  moveUp: (id: string) =>
    set((state) => {
      const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
        if (idx >= comps.length - 1) return null;
        const next = [...comps];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      if (!changed) return state;
      return pushHistory(state, schema);
    }),

  moveDown: (id: string) => {
    set((state) => {
      const { schema, changed } = reorderComponentInSchema(state.schema, id, (comps, idx) => {
        if (idx <= 0) return null;
        const next = [...comps];
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
        return next;
      });
      if (!changed) return state;
      return pushHistory(state, schema);
    });
  },

  bringToFrontMany: (ids) =>
    set((state) => {
      let currentSchema = state.schema;
      let anyChanged = false;
      for (const id of ids) {
        const { schema, changed } = reorderComponentInSchema(currentSchema, id, (comps, idx) => {
          const next = [...comps];
          const [c] = next.splice(idx, 1);
          next.push(c);
          return next;
        });
        if (changed) {
          currentSchema = schema;
          anyChanged = true;
        }
      }
      if (!anyChanged) return state;
      return pushHistory(state, currentSchema);
    }),

  sendToBackMany: (ids) =>
    set((state) => {
      let currentSchema = state.schema;
      let anyChanged = false;
      for (const id of ids) {
        const { schema, changed } = reorderComponentInSchema(currentSchema, id, (comps, idx) => {
          const next = [...comps];
          const [c] = next.splice(idx, 1);
          next.unshift(c);
          return next;
        });
        if (changed) {
          currentSchema = schema;
          anyChanged = true;
        }
      }
      if (!anyChanged) return state;
      return pushHistory(state, currentSchema);
    }),

  moveUpMany: (ids) =>
    set((state) => {
      let currentSchema = state.schema;
      let anyChanged = false;
      // Sort IDs by their current index to avoid jumping (if they are in the same zone)
      // For simplicity, we just loop for now as reorderComponentInSchema handles zones separately.
      for (const id of ids) {
        const { schema, changed } = reorderComponentInSchema(currentSchema, id, (comps, idx) => {
          if (idx >= comps.length - 1) return null;
          const next = [...comps];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          return next;
        });
        if (changed) {
          currentSchema = schema;
          anyChanged = true;
        }
      }
      if (!anyChanged) return state;
      return pushHistory(state, currentSchema);
    }),

  moveDownMany: (ids) =>
    set((state) => {
      let currentSchema = state.schema;
      let anyChanged = false;
      for (const id of ids) {
        const { schema, changed } = reorderComponentInSchema(currentSchema, id, (comps, idx) => {
          if (idx <= 0) return null;
          const next = [...comps];
          [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
          return next;
        });
        if (changed) {
          currentSchema = schema;
          anyChanged = true;
        }
      }
      if (!anyChanged) return state;
      return pushHistory(state, currentSchema);
    }),
});

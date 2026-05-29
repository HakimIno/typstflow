import type { ComponentNode, SavedBlock } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export type BlocksSlice = Pick<
  DesignerState,
  'savedBlocks' | 'saveBlock' | 'deleteBlock' | 'insertBlock' | 'renameBlock'
>;

function randomId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function cloneComponent(comp: ComponentNode): ComponentNode {
  const newId = `${comp.type}-${Math.random().toString(36).slice(2, 9)}`;
  if (comp.type === 'columns') {
    return {
      ...comp,
      id: newId,
      columns: comp.columns.map((col) => ({
        ...col,
        components: (col.components || []).map(cloneComponent),
      })),
    };
  }
  if (comp.type === 'repeater') {
    return {
      ...comp,
      id: newId,
      children: (comp.children || []).map(cloneComponent),
    };
  }
  return { ...comp, id: newId };
}

/** Reassign new ids to all components recursively so pasted blocks don't collide with originals. */
function cloneWithNewIds(components: ComponentNode[]): ComponentNode[] {
  return components.map(cloneComponent);
}

export const createBlocksSlice: StateCreator<DesignerState, [], [], BlocksSlice> = (set, get) => ({
  savedBlocks: [],

  saveBlock: (name, components, sourceZone) => {
    const block: SavedBlock = {
      id: randomId(),
      name,
      components: cloneWithNewIds(components),
      sourceZone,
      createdAt: Date.now(),
    };
    set((state) => ({ savedBlocks: [...state.savedBlocks, block] }));
  },

  deleteBlock: (id) => {
    set((state) => ({ savedBlocks: state.savedBlocks.filter((b) => b.id !== id) }));
  },

  renameBlock: (id, name) => {
    set((state) => ({
      savedBlocks: state.savedBlocks.map((b) => (b.id === id ? { ...b, name } : b)),
    }));
  },

  insertBlock: (blockId, targetZone, targetPageId) => {
    const state = get();
    const block = state.savedBlocks.find((b) => b.id === blockId);
    if (!block) return;

    const cloned = cloneWithNewIds(block.components);
    for (const comp of cloned) {
      state.addComponent(targetZone, comp, targetPageId);
    }
  },
});

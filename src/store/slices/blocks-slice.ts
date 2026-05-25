import type { ComponentNode, SavedBlock, ZoneKey } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export type BlocksSlice = Pick<
  DesignerState,
  'savedBlocks' | 'saveBlock' | 'deleteBlock' | 'insertBlock'
>;

function randomId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Reassign new ids to all components so pasted blocks don't collide with originals. */
function cloneWithNewIds(components: ComponentNode[]): ComponentNode[] {
  return components.map((c) => ({ ...c, id: `${c.type}-${randomId()}` }));
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

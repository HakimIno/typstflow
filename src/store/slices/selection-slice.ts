import {
  findComponentInSchema,
  findComponentZone,
  getZoneComponents,
} from '@/lib/utils/schema-mutators';
import type { ComponentNode, ZoneKey } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { pushHistory } from '../store-utils';

export type SelectionSlice = Pick<
  DesignerState,
  | 'selectedComponentIds'
  | 'selectedGroupId'
  | 'selectedZone'
  | 'clipboard'
  | 'selectedCell'
  | 'selectedCells'
  | 'dragState'
  | 'selectComponent'
  | 'toggleComponentSelection'
  | 'clearSelection'
  | 'selectComponentsInRange'
  | 'setSelectedCell'
  | 'setSelectedCells'
  | 'selectGroup'
  | 'setDragState'
  | 'copySelected'
  | 'paste'
  | 'duplicateSelected'
>;

export const createSelectionSlice: StateCreator<DesignerState, [], [], SelectionSlice> = (
  set,
  _get
) => ({
  selectedComponentIds: [],
  selectedGroupId: null as DesignerState['selectedGroupId'],
  selectedZone: null as DesignerState['selectedZone'],
  clipboard: null as DesignerState['clipboard'],
  selectedCell: null as DesignerState['selectedCell'],
  selectedCells: null as DesignerState['selectedCells'],
  dragState: {
    isDragging: false,
    draggedComponentId: null,
    currentX: 0,
    currentY: 0,
    startX: 0,
    startY: 0,
    lastSnappedX: 0,
    lastSnappedY: 0,
    activeGuides: {
      vertical: [],
      horizontal: [],
    },
    spacingIndicators: [],
    activePageId: null,
  },

  selectComponent: (id, multi) =>
    set((state) => {
      if (!id)
        return {
          selectedComponentIds: [],
          selectedCell: null,
          selectedCells: null,
          selectedZone: null,
        };

      const zoneInfo = findComponentZone(state.schema, id);
      const zoneKey = zoneInfo?.zoneKey || null;

      if (multi) {
        // Add to selection if not already there
        if (state.selectedComponentIds.includes(id)) return state;
        return {
          selectedComponentIds: [...state.selectedComponentIds, id],
          selectedCell: null,
          selectedCells: null,
          selectedZone: zoneKey,
        };
      }

      return {
        selectedComponentIds: [id],
        selectedCell: null,
        selectedCells: null,
        selectedZone: zoneKey,
      };
    }),

  toggleComponentSelection: (id) =>
    set((state) => {
      const ids = state.selectedComponentIds.includes(id)
        ? state.selectedComponentIds.filter((i) => i !== id)
        : [...state.selectedComponentIds, id];
      return { selectedComponentIds: ids, selectedCell: null, selectedCells: null };
    }),

  clearSelection: () =>
    set({
      selectedComponentIds: [],
      selectedCell: null,
      selectedCells: null,
      selectedZone: null,
    }),

  selectComponentsInRange: (rect, zoneKey, pageId) =>
    set((state) => {
      const components = getZoneComponents(state.schema, zoneKey, pageId);

      const foundIds = components
        .filter((comp) => {
          if (state.lockedComponentIds.includes(comp.id)) return false;

          const compX = comp.x || 0;
          const compY = comp.y || 0;
          const compW = comp.width || 0;
          const compH = comp.height || 0;

          return (
            compX < rect.x + rect.width &&
            compX + compW > rect.x &&
            compY < rect.y + rect.height &&
            compY + compH > rect.y
          );
        })
        .map((comp) => comp.id);

      const newIds = [...new Set([...state.selectedComponentIds, ...foundIds])];

      return {
        selectedComponentIds: newIds,
        selectedZone: zoneKey,
        selectedCell: null,
        selectedCells: null,
      };
    }),

  setSelectedCell: (cell) =>
    set({
      selectedCell: cell,
      selectedCells: cell
        ? {
            tableId: cell.tableId,
            section: cell.section,
            rowIds: [cell.rowId],
            cellIndices: [cell.cellIdx],
          }
        : null,
    }),

  setSelectedCells: (cells) => set({ selectedCells: cells }),

  selectGroup: (id) =>
    set((state) => ({
      selectedGroupId: id,
      selectedComponentIds: id ? [] : state.selectedComponentIds,
      selectedZone: null,
    })),

  setDragState: (updates: Partial<DesignerState['dragState']>) =>
    set((state) => ({
      dragState: { ...state.dragState, ...updates },
    })),

  copySelected: () =>
    set((state) => {
      if (state.selectedComponentIds.length === 0) return state;
      const selectedComps = state.selectedComponentIds
        .map((id) => findComponentInSchema(state.schema, id))
        .filter((c): c is ComponentNode => c !== null);

      if (selectedComps.length === 0) return state;
      return { clipboard: selectedComps };
    }),

  paste: () =>
    set((state) => {
      if (!state.clipboard || state.clipboard.length === 0) return state;

      const newSchema = { ...state.schema };
      const targetPageId = state.activePageId || state.schema.pages[0]?.id;
      const newIds: string[] = [];

      // Create copies with new IDs and slight offset
      const copies = state.clipboard.map((c) => {
        const newId = `${c.type}-${Math.random().toString(36).substring(2, 9)}`;
        newIds.push(newId);
        return {
          ...c,
          id: newId,
          x: (c.x || 0) + 5,
          y: (c.y || 0) + 5,
        };
      });

      // Always paste into active page body for now to keep it simple
      newSchema.pages = state.schema.pages.map((p) =>
        p.id === targetPageId
          ? {
              ...p,
              body: {
                ...p.body,
                components: [...p.body.components, ...copies],
              },
            }
          : p
      );

      return {
        ...pushHistory(state, newSchema),
        selectedComponentIds: newIds,
        selectedZone: 'body' as ZoneKey,
      };
    }),

  duplicateSelected: () =>
    set((state) => {
      if (state.selectedComponentIds.length === 0) return state;
      const selectedComps = state.selectedComponentIds
        .map((id) => findComponentInSchema(state.schema, id))
        .filter((c): c is ComponentNode => c !== null);

      if (selectedComps.length === 0) return state;

      const newSchema = { ...state.schema };
      const newIds: string[] = [];

      const copies = selectedComps.map((c) => {
        const newId = `${c.type}-${Math.random().toString(36).substring(2, 9)}`;
        newIds.push(newId);
        return {
          ...c,
          id: newId,
          x: (c.x || 0) + 5,
          y: (c.y || 0) + 5,
        };
      });

      // Duplicate into the same zones/pages they came from would be complex,
      // let's just duplicate into the active page body for now as a baseline
      const targetPageId = state.activePageId || state.schema.pages[0]?.id;
      newSchema.pages = state.schema.pages.map((p) =>
        p.id === targetPageId
          ? {
              ...p,
              body: {
                ...p.body,
                components: [...p.body.components, ...copies],
              },
            }
          : p
      );

      return {
        ...pushHistory(state, newSchema),
        selectedComponentIds: newIds,
        selectedZone: 'body' as ZoneKey,
      };
    }),
});

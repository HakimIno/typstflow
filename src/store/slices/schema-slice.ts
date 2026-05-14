import {
  findComponentInSchema,
  findComponentZone,
  getZoneComponents,
  mapComponentInSchema,
  removeComponentFromSchema,
  removeComponentsFromSchema,
  reorderComponentInSchema,
} from '@/lib/utils/schema-mutators';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import type { ComponentNode, GroupDefinition, LayoutSchema, Zone, ZoneKey } from '@/types/schema';
import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { buildComponentRegistry, pushHistory } from '../store-utils';

export type SchemaSlice = Pick<
  DesignerState,
  | 'schema'
  | 'history'
  | 'historyIndex'
  | 'componentRegistry'
  | 'addComponent'
  | 'updateComponent'
  | 'removeComponent'
  | 'removeComponents'
  | 'moveComponent'
  | 'moveComponents'
  | 'batchApplyDrag'
  | 'updateZone'
  | 'updateSchema'
  | 'updateGroup'
  | 'addGroup'
  | 'removeGroup'
  | 'undo'
  | 'redo'
  | 'rewindToCheckpoint'
  | 'nudgeSelected'
  | 'updateLastSnapped'
  | 'setSelectedZone'
  | 'updateComponents'
>;

export const createSchemaSlice: StateCreator<DesignerState, [], [], SchemaSlice> = (set, get) => ({
  schema: {} as LayoutSchema, // initialized in designer-store.ts
  history: [],
  historyIndex: 0,
  componentRegistry: {},

  addComponent: (zoneKey, component, pageId, groupId, groupType) =>
    set((state) => {
      const id = `${component.type}-${Math.random().toString(36).substring(2, 9)}`;
      const newComponent = {
        ...component,
        id,
        x: component.x ?? state.dragState.lastSnappedX ?? 10,
        y: component.y ?? state.dragState.lastSnappedY ?? 10,
        width: component.width ?? 100,
        height: component.height ?? 20,
      } as ComponentNode;

      const newSchema = { ...state.schema };

      if (groupId && groupType) {
        newSchema.groups = state.schema.groups.map((g) => {
          if (g.id !== groupId) return g;
          const zone = groupType === 'header' ? g.header : g.footer;
          return {
            ...g,
            [groupType]: {
              ...zone,
              components: [...zone.components, newComponent],
            },
          };
        });
      } else if (zoneKey === 'body') {
        const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;
        newSchema.pages = state.schema.pages.map((p) =>
          p.id === targetPageId
            ? { ...p, body: { ...p.body, components: [...p.body.components, newComponent] } }
            : p
        );
      } else {
        newSchema.zones = {
          ...state.schema.zones,
          [zoneKey]: {
            ...state.schema.zones[zoneKey],
            components: [...state.schema.zones[zoneKey].components, newComponent],
          },
        };
      }

      return { ...pushHistory(state, newSchema), selectedComponentIds: [id] };
    }),

  updateLastSnapped: (x, y, pageId) =>
    set((state) => {
      // Optimization: Only update if the change is significant (> 0.01mm)
      // or if the page changed. This drastically reduces React re-renders during high-frequency drags.
      const dx = Math.abs(x - (state.dragState.lastSnappedX || 0));
      const dy = Math.abs(y - (state.dragState.lastSnappedY || 0));
      if (dx < 0.01 && dy < 0.01 && pageId === state.dragState.activePageId) {
        return state;
      }

      return {
        dragState: {
          ...state.dragState,
          lastSnappedX: x,
          lastSnappedY: y,
          activePageId: pageId,
        },
      };
    }),

  updateComponent: (id, updates, skipHistory) =>
    set((state) => {
      const { schema, changed } = mapComponentInSchema(
        state.schema,
        id,
        (c) => ({ ...c, ...updates }) as ComponentNode
      );
      if (!changed) return state;
      if (skipHistory) {
        const updatedComponent = { ...state.componentRegistry[id], ...updates } as ComponentNode;
        return {
          schema,
          componentRegistry: {
            ...state.componentRegistry,
            [id]: updatedComponent,
          },
        };
      }
      return pushHistory(state, schema);
    }),

  updateComponents: (updatesMap, skipHistory) =>
    set((state) => {
      let currentSchema = state.schema;
      let anyChanged = false;
      const newRegistry = { ...state.componentRegistry };

      for (const [id, updates] of Object.entries(updatesMap)) {
        const { schema, changed } = mapComponentInSchema(
          currentSchema,
          id,
          (c) => ({ ...c, ...updates }) as ComponentNode
        );
        if (changed) {
          currentSchema = schema;
          anyChanged = true;
          if (skipHistory) {
            newRegistry[id] = { ...newRegistry[id], ...updates } as ComponentNode;
          }
        }
      }

      if (!anyChanged) return state;
      if (skipHistory) {
        return {
          schema: currentSchema,
          componentRegistry: newRegistry,
        };
      }
      return pushHistory(state, currentSchema);
    }),

  alignSelected: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', pageId?: string) =>
    set((state) => {
      if (state.selectedComponentIds.length <= 1) return state;
      const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;

      const selectedComps = state.selectedComponentIds
        .map((id) => {
          const comp = findComponentInSchema(state.schema, id);
          if (!comp) return null;
          const zoneInfo = findComponentZone(state.schema, id);
          const zoneOffset = LayoutEngine.calculateZoneOffset(
            zoneInfo?.zoneKey || 'body',
            state.schema,
            targetPageId
          );
          return { ...comp, absY: (comp.y || 0) + zoneOffset };
        })
        .filter((c): c is any => c !== null);

      if (selectedComps.length <= 1) return state;

      const minX = Math.min(...selectedComps.map((c) => c.x || 0));
      const maxX = Math.max(...selectedComps.map((c) => (c.x || 0) + (c.width || 40)));
      const minY = Math.min(...selectedComps.map((c) => c.absY || 0));
      const maxY = Math.max(...selectedComps.map((c) => (c.absY || 0) + (c.height || 10)));
      const selW = maxX - minX;
      const selH = maxY - minY;

      const updates: Record<string, Partial<ComponentNode>> = {};
      for (const comp of selectedComps) {
        const cw = comp.width || 40;
        const ch = comp.height || 10;
        switch (type) {
          case 'left': updates[comp.id] = { x: minX }; break;
          case 'center': updates[comp.id] = { x: minX + selW / 2 - cw / 2 }; break;
          case 'right': updates[comp.id] = { x: maxX - cw }; break;
          case 'top': updates[comp.id] = { y: (comp.y || 0) - (comp.absY - minY) }; break;
          case 'middle': updates[comp.id] = { y: (comp.y || 0) + (minY + selH / 2 - (comp.absY + ch / 2)) }; break;
          case 'bottom': updates[comp.id] = { y: (comp.y || 0) + (maxY - (comp.absY + ch)) }; break;
        }
      }

      // Re-use updateComponents logic but as a direct mutation for history atomicity
      let currentSchema = state.schema;
      for (const [id, u] of Object.entries(updates)) {
        const { schema } = mapComponentInSchema(currentSchema, id, (c) => ({ ...c, ...u }) as ComponentNode);
        currentSchema = schema;
      }
      return pushHistory(state, currentSchema);
    }),

  distributeSelected: (type: 'dist-h' | 'dist-v', pageId?: string) =>
    set((state) => {
      if (state.selectedComponentIds.length <= 2) return state;
      const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;

      const selectedComps = state.selectedComponentIds
        .map((id) => {
          const comp = findComponentInSchema(state.schema, id);
          if (!comp) return null;
          const zoneInfo = findComponentZone(state.schema, id);
          const zoneOffset = LayoutEngine.calculateZoneOffset(
            zoneInfo?.zoneKey || 'body',
            state.schema,
            targetPageId
          );
          return { ...comp, absY: (comp.y || 0) + zoneOffset };
        })
        .filter((c): c is any => c !== null);

      const minX = Math.min(...selectedComps.map((c) => c.x || 0));
      const maxX = Math.max(...selectedComps.map((c) => (c.x || 0) + (c.width || 40)));
      const minY = Math.min(...selectedComps.map((c) => c.absY || 0));
      const maxY = Math.max(...selectedComps.map((c) => (c.absY || 0) + (c.height || 10)));
      const selW = maxX - minX;
      const selH = maxY - minY;

      const updates: Record<string, Partial<ComponentNode>> = {};
      if (type === 'dist-h') {
        const sorted = [...selectedComps].sort((a, b) => (a.x || 0) - (b.x || 0));
        const totalW = sorted.reduce((sum, c) => sum + (c.width || 40), 0);
        const gap = (selW - totalW) / (sorted.length - 1);
        let curX = minX;
        for (const c of sorted) {
          updates[c.id] = { x: curX };
          curX += (c.width || 40) + gap;
        }
      } else {
        const sorted = [...selectedComps].sort((a, b) => (a.absY || 0) - (b.absY || 0));
        const totalH = sorted.reduce((sum, c) => sum + (c.height || 10), 0);
        const gap = (selH - totalH) / (sorted.length - 1);
        let curAbsY = minY;
        for (const c of sorted) {
          const diff = curAbsY - c.absY;
          updates[c.id] = { y: (c.y || 0) + diff };
          curAbsY += (c.height || 10) + gap;
        }
      }

      let currentSchema = state.schema;
      for (const [id, u] of Object.entries(updates)) {
        const { schema } = mapComponentInSchema(currentSchema, id, (c) => ({ ...c, ...u }) as ComponentNode);
        currentSchema = schema;
      }
      return pushHistory(state, currentSchema);
    }),

  stackSelected: (type: 'stack-h' | 'stack-v', gap: number, pageId?: string) =>
    set((state) => {
      if (state.selectedComponentIds.length <= 1) return state;
      const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;

      const selectedComps = state.selectedComponentIds
        .map((id) => {
          const comp = findComponentInSchema(state.schema, id);
          if (!comp) return null;
          const zoneInfo = findComponentZone(state.schema, id);
          const zoneOffset = LayoutEngine.calculateZoneOffset(
            zoneInfo?.zoneKey || 'body',
            state.schema,
            targetPageId
          );
          return { ...comp, absY: (comp.y || 0) + zoneOffset };
        })
        .filter((c): c is any => c !== null);

      const minX = Math.min(...selectedComps.map((c) => c.x || 0));
      const minY = Math.min(...selectedComps.map((c) => c.absY || 0));

      const updates: Record<string, Partial<ComponentNode>> = {};
      if (type === 'stack-h') {
        const sorted = [...selectedComps].sort((a, b) => (a.x || 0) - (b.x || 0));
        let curX = minX;
        for (const c of sorted) {
          updates[c.id] = { x: curX };
          curX += (c.width || 40) + gap;
        }
      } else {
        const sorted = [...selectedComps].sort((a, b) => (a.absY || 0) - (b.absY || 0));
        let curAbsY = minY;
        for (const c of sorted) {
          const diff = curAbsY - c.absY;
          updates[c.id] = { y: (c.y || 0) + diff };
          curAbsY += (c.height || 10) + gap;
        }
      }

      let currentSchema = state.schema;
      for (const [id, u] of Object.entries(updates)) {
        const { schema } = mapComponentInSchema(currentSchema, id, (c) => ({ ...c, ...u }) as ComponentNode);
        currentSchema = schema;
      }
      return pushHistory(state, currentSchema);
    }),

  alignToPage: (type: 'page-left' | 'page-center-h' | 'page-right' | 'page-top' | 'page-center-v' | 'page-bottom' | 'page-center-both', pageId?: string) =>
    set((state) => {
      if (state.selectedComponentIds.length === 0) return state;
      const targetPageId = pageId || state.activePageId || state.schema.pages[0]?.id;
      const { width: pageW, height: pageH } = getPaperDimensions(state.schema.page.size, state.schema.page.orientation);
      const mTop = parseTypstUnit(state.schema.page.margin.top);
      const mBottom = parseTypstUnit(state.schema.page.margin.bottom);
      const contentH = pageH - mTop - mBottom;

      const updates: Record<string, Partial<ComponentNode>> = {};
      for (const id of state.selectedComponentIds) {
        const comp = state.componentRegistry[id];
        if (!comp) continue;
        const cw = comp.width || 40;
        const ch = comp.height || 10;

        switch (type) {
          case 'page-left': updates[id] = { x: 0 }; break;
          case 'page-center-h': updates[id] = { x: (pageW - cw) / 2 }; break;
          case 'page-right': updates[id] = { x: pageW - cw }; break;
          case 'page-top': updates[id] = { y: 0 }; break;
          case 'page-center-v': updates[id] = { y: (contentH - ch) / 2 }; break;
          case 'page-bottom': updates[id] = { y: contentH - ch }; break;
          case 'page-center-both':
            updates[id] = { x: (pageW - cw) / 2, y: (contentH - ch) / 2 };
            break;
        }
      }

      let currentSchema = state.schema;
      for (const [id, u] of Object.entries(updates)) {
        const { schema } = mapComponentInSchema(currentSchema, id, (c) => ({ ...c, ...u }) as ComponentNode);
        currentSchema = schema;
      }
      return pushHistory(state, currentSchema);
    }),

  setSelectedZone: (zone: ZoneKey | null) => set({ selectedZone: zone }),

  removeComponent: (id) =>
    set((state) => {
      const { schema, changed } = removeComponentFromSchema(state.schema, id);
      if (!changed) return state;
      return { ...pushHistory(state, schema), selectedComponentIds: [] };
    }),

  removeComponents: (ids) =>
    set((state) => {
      const { schema, changed } = removeComponentsFromSchema(state.schema, ids);
      if (!changed) return state;
      return { ...pushHistory(state, schema), selectedComponentIds: [] };
    }),

  moveComponent: (id, fromZone, toZone, newIndex, x, y, fromPageId, toPageId, skipHistory, fromGroupId, toGroupId, fromGroupType, toGroupType) =>
    get().moveComponents([{
      id, fromZone, toZone, newIndex, x, y, fromPageId, toPageId, fromGroupId, toGroupId, fromGroupType, toGroupType
    }], skipHistory),

  moveComponents: (moves, skipHistory = false) =>
    get().batchApplyDrag({}, moves, skipHistory),

  batchApplyDrag: (updatesMap, moves, skipHistory = false) =>
    set((state) => {
      let currentSchema = state.schema;

      // 1. Handle zone moves first
      for (const move of moves) {
        const { id, toZone, newIndex, x, y, toPageId, toGroupId, toGroupType } = move;
        const { schema: schemaWithoutComp } = removeComponentFromSchema(currentSchema, id);
        const component = state.componentRegistry[id];
        if (!component) continue;

        const updatedComp: ComponentNode = {
          ...component,
          ...(x !== undefined ? { x } : {}),
          ...(y !== undefined ? { y } : {}),
        };

        const nextSchema = { ...schemaWithoutComp };

        if (toGroupId && toGroupType) {
          nextSchema.groups = schemaWithoutComp.groups.map((g) => {
            if (g.id !== toGroupId) return g;
            const zone = toGroupType === 'header' ? g.header : g.footer;
            const nextComps = [...zone.components];
            const insertAt = newIndex === -1 ? nextComps.length : Math.max(0, Math.min(newIndex, nextComps.length));
            nextComps.splice(insertAt, 0, updatedComp);
            return { ...g, [toGroupType]: { ...zone, components: nextComps } };
          });
        } else if (toZone === 'body') {
          const targetPageId = toPageId || state.activePageId || state.schema.pages[0]?.id;

          const targetIdx = schemaWithoutComp.pages.findIndex((p) => p.id === targetPageId);
          if (targetIdx !== -1) {
            const targetPage = schemaWithoutComp.pages[targetIdx];
            const nextComps = [...targetPage.body.components];
            const insertAt = newIndex === -1 ? nextComps.length : Math.max(0, Math.min(newIndex, nextComps.length));
            nextComps.splice(insertAt, 0, updatedComp);
            const newPages = [...schemaWithoutComp.pages];
            newPages[targetIdx] = { ...targetPage, body: { ...targetPage.body, components: nextComps } };
            nextSchema.pages = newPages;
          } else {
            nextSchema.pages = schemaWithoutComp.pages;
          }
        } else {
          const nextComps = [...schemaWithoutComp.zones[toZone as 'header' | 'footer'].components];
          const insertAt = newIndex === -1 ? nextComps.length : Math.max(0, Math.min(newIndex, nextComps.length));
          nextComps.splice(insertAt, 0, updatedComp);
          nextSchema.zones = {
            ...schemaWithoutComp.zones,
            [toZone as 'header' | 'footer']: { ...schemaWithoutComp.zones[toZone as 'header' | 'footer'], components: nextComps },
          };
        }
        currentSchema = nextSchema;
      }

      // 2. Handle property updates for remaining components
      if (Object.keys(updatesMap).length > 0) {
        currentSchema = mapSchemaComponents(currentSchema, (c) => {
          const updates = updatesMap[c.id];
          if (updates) return { ...c, ...updates } as ComponentNode;
          return c;
        });
      }

      if (skipHistory) return { schema: currentSchema, componentRegistry: buildComponentRegistry(currentSchema) };
      return pushHistory(state, currentSchema);
    }),

  updateZone: (
    zoneKey: ZoneKey,
    updates: Partial<Zone>,
    pageId?: string,
    skipHistory?: boolean,
    groupId?: string,
    groupType?: 'header' | 'footer'
  ) =>
    set((state) => {
      if (groupId) {
        // Update group zone
        const newGroups = state.schema.groups.map((g) => {
          if (g.id === groupId) {
            const zone = groupType === 'header' ? g.header : g.footer;
            return {
              ...g,
              [groupType || 'header']: { ...zone, ...updates },
            };
          }
          return g;
        });
        const newSchema = { ...state.schema, groups: newGroups };
        if (skipHistory) return { schema: newSchema };
        return pushHistory(state, newSchema);
      }

      const schema = { ...state.schema };
      if (zoneKey === 'body') {
        const targetPageId = pageId || state.activePageId || state.schema.pages[0].id;
        schema.pages = state.schema.pages.map((p) =>
          p.id === targetPageId ? { ...p, body: { ...p.body, ...updates } } : p
        );
      } else {
        schema.zones = {
          ...state.schema.zones,
          [zoneKey]: { ...state.schema.zones[zoneKey as 'header' | 'footer'], ...updates },
        };
      }

      if (skipHistory) return { schema };
      return pushHistory(state, schema);
    }),

  updateSchema: (updates) =>
    set((state) => pushHistory(state, { ...state.schema, ...updates })),

  updateGroup: (id, updates) =>
    set((state) => {
      const newGroups = state.schema.groups.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      );
      return pushHistory(state, { ...state.schema, groups: newGroups });
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const restoredSchema = state.history[newIndex];
      return {
        schema: restoredSchema,
        componentRegistry: buildComponentRegistry(restoredSchema),
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const restoredSchema = state.history[newIndex];
      return {
        schema: restoredSchema,
        componentRegistry: buildComponentRegistry(restoredSchema),
        historyIndex: newIndex,
      };
    }),

  rewindToCheckpoint: (checkpointIndex: number) =>
    set((state) => {
      const target = Math.max(0, Math.min(checkpointIndex, state.history.length - 1));
      const restoredSchema = state.history[target];
      return {
        schema: restoredSchema,
        componentRegistry: buildComponentRegistry(restoredSchema),
        historyIndex: target,
        selectedComponentIds: [],
      };
    }),

  nudgeSelected: (dx: number, dy: number) =>
    set((state) => {
      if (state.selectedComponentIds.length === 0) return state;

      let newSchema = state.schema;
      let anyChanged = false;

      for (const id of state.selectedComponentIds) {
        const { schema: updatedSchema, changed } = mapComponentInSchema(
          newSchema,
          id,
          (c) =>
            ({
              ...c,
              x: (c.x || 0) + dx,
              y: (c.y || 0) + dy,
            }) as ComponentNode
        );
        if (changed) {
          newSchema = updatedSchema;
          anyChanged = true;
        }
      }

      if (!anyChanged) return state;
      return pushHistory(state, newSchema);
    }),

  addGroup: (field: string) =>
    set((state) => {
      const groupId = `group-${Math.random().toString(36).substring(2, 9)}`;
      const newGroup: GroupDefinition = {
        id: groupId,
        name: `Group by ${field.split('.').pop()}`,
        field,
        header: { id: `${groupId}-header`, components: [], minHeight: '15mm' },
        footer: { id: `${groupId}-footer`, components: [], minHeight: '15mm' },
        sortBy: 'asc' as const,
      };

      const newSchema = {
        ...state.schema,
        groups: [...(state.schema.groups || []), newGroup],
      };

      return pushHistory(state, newSchema);
    }),

  removeGroup: (id: string) =>
    set((state) => {
      const newSchema = {
        ...state.schema,
        groups: state.schema.groups.filter((g) => g.id !== id),
      };
      return pushHistory(state, newSchema);
    }),
});

/**
 * Maps over all components in the schema across all zones, pages, and groups.
 */
function mapSchemaComponents(
  schema: LayoutSchema,
  mapFn: (c: ComponentNode) => ComponentNode
): LayoutSchema {
  const nextSchema = { ...schema };

  // 1. Zones
  nextSchema.zones = {
    header: {
      ...schema.zones.header,
      components: schema.zones.header.components.map(mapFn),
    },
    footer: {
      ...schema.zones.footer,
      components: schema.zones.footer.components.map(mapFn),
    },
  };

  // 2. Pages
  nextSchema.pages = schema.pages.map((p) => ({
    ...p,
    body: {
      ...p.body,
      components: p.body.components.map(mapFn),
    },
  }));

  // 3. Groups
  if (schema.groups) {
    nextSchema.groups = schema.groups.map((g) => ({
      ...g,
      header: {
        ...g.header,
        components: g.header.components.map(mapFn),
      },
      footer: {
        ...g.footer,
        components: g.footer.components.map(mapFn),
      },
    }));
  }

  return nextSchema;
}



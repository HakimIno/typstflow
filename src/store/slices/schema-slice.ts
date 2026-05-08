import {
  findComponentInSchema,
  findComponentZone,
  getZoneComponents,
  mapComponentInSchema,
  removeComponentFromSchema,
  removeComponentsFromSchema,
  reorderComponentInSchema,
} from '@/lib/utils/schema-mutators';
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

export const createSchemaSlice: StateCreator<DesignerState, [], [], SchemaSlice> = (set, _get) => ({
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

  moveComponent: (
    id,
    _fromZone,
    toZone,
    newIndex,
    x,
    y,
    _fromPageId,
    toPageId,
    skipHistory = false,
    _fromGroupId = undefined,
    toGroupId = undefined,
    _fromGroupType = undefined,
    toGroupType = undefined
  ) =>
    set((state) => {
      // 1. Remove from source (handled by helper)
      const { schema: schemaWithoutComp } = removeComponentFromSchema(state.schema, id);

      // 2. Find component to get its data
      const component = findComponentInSchema(state.schema, id);
      if (!component) return state;

      const updatedComp: ComponentNode = {
        ...component,
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
      };

      // 3. Insert into destination
      const newSchema = { ...schemaWithoutComp };

      if (toGroupId && toGroupType) {
        newSchema.groups = schemaWithoutComp.groups.map((g) => {
          if (g.id !== toGroupId) return g;
          const zone = toGroupType === 'header' ? g.header : g.footer;
          const nextComps = [...zone.components];
          const insertAt =
            newIndex === -1
              ? nextComps.length
              : Math.max(0, Math.min(newIndex, nextComps.length));
          nextComps.splice(insertAt, 0, updatedComp);
          return {
            ...g,
            [toGroupType]: { ...zone, components: nextComps },
          };
        });
      } else if (toZone === 'body') {
        const targetPageId = toPageId || state.activePageId || state.schema.pages[0]?.id;
        newSchema.pages = schemaWithoutComp.pages.map((p) => {
          if (p.id !== targetPageId) return p;
          const nextComps = [...p.body.components];
          const insertAt =
            newIndex === -1
              ? nextComps.length
              : Math.max(0, Math.min(newIndex, nextComps.length));
          nextComps.splice(insertAt, 0, updatedComp);
          return { ...p, body: { ...p.body, components: nextComps } };
        });
      } else {
        const nextComps = [...schemaWithoutComp.zones[toZone].components];
        const insertAt =
          newIndex === -1
            ? nextComps.length
            : Math.max(0, Math.min(newIndex, nextComps.length));
        nextComps.splice(insertAt, 0, updatedComp);
        newSchema.zones = {
          ...schemaWithoutComp.zones,
          [toZone]: { ...schemaWithoutComp.zones[toZone], components: nextComps },
        };
      }

      if (skipHistory) return { schema: newSchema };
      return pushHistory(state, newSchema);
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
      return {
        schema: state.history[newIndex],
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        schema: state.history[newIndex],
        historyIndex: newIndex,
      };
    }),

  rewindToCheckpoint: (checkpointIndex: number) =>
    set((state) => {
      const target = Math.max(0, Math.min(checkpointIndex, state.history.length - 1));
      return {
        schema: state.history[target],
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

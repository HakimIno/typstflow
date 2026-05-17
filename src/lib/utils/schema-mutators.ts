/**
 * @file schema-mutators.ts
 *
 * Pure, immutable utility functions for mutating LayoutSchema.
 *
 * Eliminates the repeated zone-loop + pages.map pattern that was duplicated
 * 8+ times in designer-store.ts, replacing them with a single tested API.
 *
 * Design principles:
 * - Pure: no side-effects, no DOM access
 * - Immutable: always return new objects, never mutate input
 * - Tested: all functions have unit tests in schema-mutators.test.ts
 */
import type { ComponentNode, LayoutSchema, ZoneKey } from '@/types/schema';

// ─── Internal ──────────────────────────────────────────────────────────────

type GlobalZoneKey = 'header' | 'footer';
const GLOBAL_ZONE_KEYS: readonly GlobalZoneKey[] = ['header', 'footer'] as const;

// ─── Public Types ──────────────────────────────────────────────────────────

/** Returned by every schema mutation function. */
export interface MutationResult {
  /** New schema reference (same ref as input if `changed` is false) */
  schema: LayoutSchema;
  /** Whether the operation found and modified anything */
  changed: boolean;
}

// ─── Zone Access ───────────────────────────────────────────────────────────

/**
 * Get components from a specific zone (page-aware for 'body').
 * Falls back to the first page when pageId is omitted.
 *
 * @example
 * const comps = getZoneComponents(schema, 'body', activePageId);
 */
export function getZoneComponents(
  schema: LayoutSchema,
  zoneKey: ZoneKey,
  pageId?: string | null
): ComponentNode[] {
  if (zoneKey === 'body') {
    const page = pageId ? schema.pages.find((p) => p.id === pageId) : schema.pages[0];
    return page?.body.components ?? [];
  }
  return schema.zones[zoneKey].components;
}

// ─── Find ──────────────────────────────────────────────────────────────────

/**
 * Find the zone information for a given component ID.
 */
export function findComponentZone(
  schema: LayoutSchema,
  id: string
): {
  component: ComponentNode;
  zoneKey: ZoneKey;
  pageId?: string;
  groupId?: string;
  groupType?: 'header' | 'footer';
} | null {
  const searchNested = (components: ComponentNode[]): ComponentNode | null => {
    for (const c of components) {
      if (c.id === id) return c;
      if (c.type === 'columns' && c.columns) {
        for (const col of c.columns) {
          const found = searchNested(col.components || []);
          if (found) return found;
        }
      } else if (c.type === 'repeater' && (c as any).children) {
        const found = searchNested((c as any).children);
        if (found) return found;
      }
    }
    return null;
  };

  for (const key of GLOBAL_ZONE_KEYS) {
    const found = searchNested(schema.zones[key].components);
    if (found) return { component: found, zoneKey: key };
  }
  for (const page of schema.pages) {
    const found = searchNested(page.body.components);
    if (found) return { component: found, zoneKey: 'body', pageId: page.id };
  }
  for (const group of schema.groups || []) {
    const headerFound = searchNested(group.header.components);
    if (headerFound)
      return { component: headerFound, zoneKey: 'body', groupId: group.id, groupType: 'header' };
    const footerFound = searchNested(group.footer.components);
    if (footerFound)
      return { component: footerFound, zoneKey: 'body', groupId: group.id, groupType: 'footer' };
  }
  return null;
}

/**
 * Find a component by ID anywhere in the schema.
 * Checks global zones (header, footer) first, then all page bodies.
 * Returns null when not found.
 */
export function findComponentInSchema(schema: LayoutSchema, id: string): ComponentNode | null {
  const result = findComponentZone(schema, id);
  return result?.component ?? null;
}

// ─── Map (Transform) ───────────────────────────────────────────────────────

/**
 * Apply an immutable transform to a single component identified by id.
 * Short-circuits on first match (global zones searched before page bodies).
 *
 * @example
 * const { schema, changed } = mapComponentInSchema(state.schema, id, (c) => ({
 *   ...c, x: newX, y: newY,
 * }));
 * if (!changed) return state;
 * return pushHistory(state, schema);
 */
export function mapComponentInSchema(
  schema: LayoutSchema,
  id: string,
  transform: (comp: ComponentNode) => ComponentNode
): MutationResult {
  const mapNested = (
    components: ComponentNode[]
  ): { components: ComponentNode[]; changed: boolean } => {
    let changed = false;
    const nextComps = components.map((c) => {
      if (c.id === id) {
        changed = true;
        return transform(c);
      }
      if (c.type === 'columns' && c.columns) {
        let colsChanged = false;
        const newCols = c.columns.map((col) => {
          const res = mapNested(col.components || []);
          if (res.changed) {
            colsChanged = true;
            return { ...col, components: res.components };
          }
          return col;
        });
        if (colsChanged) {
          changed = true;
          return { ...c, columns: newCols };
        }
      } else if (c.type === 'repeater' && (c as any).children) {
        const res = mapNested((c as any).children);
        if (res.changed) {
          changed = true;
          return { ...c, children: res.components };
        }
      }
      return c;
    });
    return { components: nextComps, changed };
  };

  // 1. Global zones — short-circuit on first match
  for (const key of GLOBAL_ZONE_KEYS) {
    const res = mapNested(schema.zones[key].components);
    if (res.changed) {
      return {
        schema: {
          ...schema,
          zones: { ...schema.zones, [key]: { ...schema.zones[key], components: res.components } },
        },
        changed: true,
      };
    }
  }

  // 2. Page bodies — early exit on first match; avoids allocating 1000 page objects
  for (let i = 0; i < schema.pages.length; i++) {
    const page = schema.pages[i];
    const res = mapNested(page.body.components);
    if (res.changed) {
      const newPages = [...schema.pages];
      newPages[i] = { ...page, body: { ...page.body, components: res.components } };
      return { schema: { ...schema, pages: newPages }, changed: true };
    }
  }

  // 3. Group bands
  let groupChanged = false;
  const newGroups = (schema.groups || []).map((group) => {
    const hRes = mapNested(group.header.components);
    if (hRes.changed) {
      groupChanged = true;
      return { ...group, header: { ...group.header, components: hRes.components } };
    }
    const fRes = mapNested(group.footer.components);
    if (fRes.changed) {
      groupChanged = true;
      return { ...group, footer: { ...group.footer, components: fRes.components } };
    }
    return group;
  });

  if (!groupChanged) return { schema, changed: false };
  return { schema: { ...schema, groups: newGroups }, changed: true };
}

// ─── Remove ────────────────────────────────────────────────────────────────

/**
 * Remove a single component by ID from any zone in the schema.
 * Checks global zones first, then page bodies.
 */
export function removeComponentFromSchema(schema: LayoutSchema, id: string): MutationResult {
  return removeComponentsFromSchema(schema, [id]);
}

/**
 * Remove multiple components by their IDs in a single schema pass.
 * More efficient than calling removeComponentFromSchema multiple times.
 */
export function removeComponentsFromSchema(schema: LayoutSchema, ids: string[]): MutationResult {
  if (ids.length === 0) return { schema, changed: false };

  const idSet = new Set(ids);
  let anyChanged = false;

  const removeNested = (
    components: ComponentNode[],
    idSet: Set<string>
  ): { components: ComponentNode[]; changed: boolean } => {
    let changed = false;
    const filtered = components.filter((c) => {
      if (idSet.has(c.id)) {
        changed = true;
        return false;
      }
      return true;
    });

    const nextComps = filtered.map((c) => {
      if (c.type === 'columns' && c.columns) {
        let colsChanged = false;
        const newCols = c.columns.map((col) => {
          const res = removeNested(col.components || [], idSet);
          if (res.changed) {
            colsChanged = true;
            return { ...col, components: res.components };
          }
          return col;
        });
        if (colsChanged) {
          changed = true;
          return { ...c, columns: newCols };
        }
      } else if (c.type === 'repeater' && (c as any).children) {
        const res = removeNested((c as any).children, idSet);
        if (res.changed) {
          changed = true;
          return { ...c, children: res.components };
        }
      }
      return c;
    });

    return { components: nextComps, changed };
  };

  // 1. Global zones
  let updatedZones = schema.zones;
  for (const key of GLOBAL_ZONE_KEYS) {
    const original = updatedZones[key].components;
    const res = removeNested(original, idSet);
    if (res.changed) {
      anyChanged = true;
      updatedZones = {
        ...updatedZones,
        [key]: { ...updatedZones[key], components: res.components },
      };
    }
  }

  // 2. Page bodies
  const newPages = schema.pages.map((page) => {
    const res = removeNested(page.body.components, idSet);
    if (res.changed) {
      anyChanged = true;
      return { ...page, body: { ...page.body, components: res.components } };
    }
    return page;
  });

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    const hRes = removeNested(group.header.components, idSet);
    const fRes = removeNested(group.footer.components, idSet);

    if (hRes.changed || fRes.changed) {
      anyChanged = true;
      return {
        ...group,
        header: { ...group.header, components: hRes.components },
        footer: { ...group.footer, components: fRes.components },
      };
    }
    return group;
  });

  if (!anyChanged) return { schema, changed: false };
  return {
    schema: { ...schema, zones: updatedZones, pages: newPages, groups: newGroups },
    changed: true,
  };
}

// ─── Batch Map ─────────────────────────────────────────────────────────────

/**
 * Apply per-component transforms to multiple components in a single schema pass.
 * Only zones/pages that actually contain a targeted component are reallocated,
 * making this O(total_components) with minimal GC pressure — far more efficient
 * than calling mapComponentInSchema N times (which is O(N × pages)).
 *
 * @example
 * const transforms = new Map([
 *   [id1, (c) => ({ ...c, x: newX })],
 *   [id2, (c) => ({ ...c, y: newY })],
 * ]);
 * const { schema } = batchMapComponentsInSchema(state.schema, transforms);
 */
export function batchMapComponentsInSchema(
  schema: LayoutSchema,
  transforms: Map<string, (comp: ComponentNode) => ComponentNode>
): MutationResult {
  if (transforms.size === 0) return { schema, changed: false };

  let anyChanged = false;

  // 1. Global zones — only reallocate a zone when it contains a targeted component
  let updatedZones = schema.zones;
  for (const key of GLOBAL_ZONE_KEYS) {
    const components = updatedZones[key].components;
    let zoneChanged = false;
    const next = components.map((c) => {
      const t = transforms.get(c.id);
      if (!t) return c;
      zoneChanged = true;
      return t(c);
    });
    if (zoneChanged) {
      anyChanged = true;
      updatedZones = { ...updatedZones, [key]: { ...updatedZones[key], components: next } };
    }
  }

  // 2. Page bodies — only reallocate pages that contain a targeted component
  const newPages = schema.pages.map((page) => {
    let pageChanged = false;
    const next = page.body.components.map((c) => {
      const t = transforms.get(c.id);
      if (!t) return c;
      pageChanged = true;
      return t(c);
    });
    if (!pageChanged) return page;
    anyChanged = true;
    return { ...page, body: { ...page.body, components: next } };
  });

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    let groupChanged = false;
    const nextHeader = group.header.components.map((c) => {
      const t = transforms.get(c.id);
      if (!t) return c;
      groupChanged = true;
      return t(c);
    });
    const nextFooter = group.footer.components.map((c) => {
      const t = transforms.get(c.id);
      if (!t) return c;
      groupChanged = true;
      return t(c);
    });
    if (!groupChanged) return group;
    anyChanged = true;
    return {
      ...group,
      header: { ...group.header, components: nextHeader },
      footer: { ...group.footer, components: nextFooter },
    };
  });

  if (!anyChanged) return { schema, changed: false };
  return {
    schema: { ...schema, zones: updatedZones, pages: newPages, groups: newGroups },
    changed: true,
  };
}

// ─── Reorder ───────────────────────────────────────────────────────────────

/**
 * Reorder a component within its zone using a transform callback.
 */
export function reorderComponentInSchema(
  schema: LayoutSchema,
  id: string,
  reorder: (components: ComponentNode[], index: number) => ComponentNode[] | null
): MutationResult {
  // 1. Global zones
  for (const key of GLOBAL_ZONE_KEYS) {
    const components = schema.zones[key].components;
    const idx = components.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const result = reorder([...components], idx);
      if (result === null) return { schema, changed: false };
      return {
        schema: {
          ...schema,
          zones: { ...schema.zones, [key]: { ...schema.zones[key], components: result } },
        },
        changed: true,
      };
    }
  }

  // 2. Page bodies
  let changed = false;
  const newPages = schema.pages.map((page) => {
    const components = page.body.components;
    const idx = components.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const result = reorder([...components], idx);
      if (result !== null) {
        changed = true;
        return { ...page, body: { ...page.body, components: result } };
      }
    }
    return page;
  });

  if (changed) return { schema: { ...schema, pages: newPages }, changed: true };

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    const hIdx = group.header.components.findIndex((c) => c.id === id);
    if (hIdx !== -1) {
      const result = reorder([...group.header.components], hIdx);
      if (result !== null) {
        changed = true;
        return { ...group, header: { ...group.header, components: result } };
      }
    }
    const fIdx = group.footer.components.findIndex((c) => c.id === id);
    if (fIdx !== -1) {
      const result = reorder([...group.footer.components], fIdx);
      if (result !== null) {
        changed = true;
        return { ...group, footer: { ...group.footer, components: result } };
      }
    }
    return group;
  });

  if (!changed) return { schema, changed: false };
  return { schema: { ...schema, groups: newGroups }, changed: true };
}

/**
 * Move a component from one zone/page to another, or reorder within the same zone.
 */
export function moveComponentInSchema(
  schema: LayoutSchema,
  id: string,
  _fromZone: ZoneKey,
  toZone: ZoneKey,
  newIndex: number,
  x?: number,
  y?: number,
  _fromPageId?: string | null,
  toPageId?: string | null
): MutationResult {
  let component: ComponentNode | null = null;
  const { schema: schemaWithoutComp, changed: removed } = removeComponentFromSchema(schema, id);

  if (!removed) return { schema, changed: false };

  component = findComponentInSchema(schema, id);
  if (!component) return { schema, changed: false };

  const updatedComp: ComponentNode = {
    ...component,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
  };

  const nextSchema = { ...schemaWithoutComp };

  if (toZone === 'body') {
    const targetPageId = toPageId || schema.pages[0]?.id;
    nextSchema.pages = schemaWithoutComp.pages.map((p) => {
      if (p.id !== targetPageId) return p;
      const nextComps = [...p.body.components];
      const insertAt = Math.max(0, Math.min(newIndex, nextComps.length));
      nextComps.splice(insertAt, 0, updatedComp);
      return { ...p, body: { ...p.body, components: nextComps } };
    });
  } else {
    const nextComps = [...schemaWithoutComp.zones[toZone].components];
    const insertAt = Math.max(0, Math.min(newIndex, nextComps.length));
    nextComps.splice(insertAt, 0, updatedComp);
    nextSchema.zones = {
      ...schemaWithoutComp.zones,
      [toZone]: { ...schemaWithoutComp.zones[toZone], components: nextComps },
    };
  }

  return { schema: nextSchema, changed: true };
}

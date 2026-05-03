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
 * Find a component by ID anywhere in the schema.
 * Checks global zones (header, footer) first, then all page bodies.
 * Returns null when not found.
 */
export function findComponentInSchema(schema: LayoutSchema, id: string): ComponentNode | null {
  for (const key of GLOBAL_ZONE_KEYS) {
    const found = schema.zones[key].components.find((c) => c.id === id);
    if (found) return found;
  }
  for (const page of schema.pages) {
    const found = page.body.components.find((c) => c.id === id);
    if (found) return found;
  }
  for (const group of schema.groups || []) {
    const headerFound = group.header.components.find((c) => c.id === id);
    if (headerFound) return headerFound;
    const footerFound = group.footer.components.find((c) => c.id === id);
    if (footerFound) return footerFound;
  }
  return null;
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
  // 1. Global zones — short-circuit on first match
  for (const key of GLOBAL_ZONE_KEYS) {
    const components = schema.zones[key].components;
    const idx = components.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const next = [...components];
      next[idx] = transform(components[idx]);
      return {
        schema: {
          ...schema,
          zones: { ...schema.zones, [key]: { ...schema.zones[key], components: next } },
        },
        changed: true,
      };
    }
  }

  // 2. Page bodies and per-page footers
  let changed = false;
  const newPages = schema.pages.map((page) => {
    const bodyIdx = page.body.components.findIndex((c) => c.id === id);
    if (bodyIdx !== -1) {
      const next = [...page.body.components];
      next[bodyIdx] = transform(page.body.components[bodyIdx]);
      changed = true;
      return { ...page, body: { ...page.body, components: next } };
    }
    return page;
  });

  if (changed) return { schema: { ...schema, pages: newPages }, changed: true };

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    const hIdx = group.header.components.findIndex((c) => c.id === id);
    if (hIdx !== -1) {
      const next = [...group.header.components];
      next[hIdx] = transform(group.header.components[hIdx]);
      changed = true;
      return { ...group, header: { ...group.header, components: next } };
    }
    const fIdx = group.footer.components.findIndex((c) => c.id === id);
    if (fIdx !== -1) {
      const next = [...group.footer.components];
      next[fIdx] = transform(group.footer.components[fIdx]);
      changed = true;
      return { ...group, footer: { ...group.footer, components: next } };
    }
    return group;
  });

  if (!changed) return { schema, changed: false };
  return { schema: { ...schema, groups: newGroups }, changed: true };
}

// ─── Remove ────────────────────────────────────────────────────────────────

/**
 * Remove a single component by ID from any zone in the schema.
 * Checks global zones first, then page bodies.
 */
export function removeComponentFromSchema(schema: LayoutSchema, id: string): MutationResult {
  // 1. Global zones
  for (const key of GLOBAL_ZONE_KEYS) {
    const original = schema.zones[key].components;
    if (original.some((c) => c.id === id)) {
      return {
        schema: {
          ...schema,
          zones: {
            ...schema.zones,
            [key]: { ...schema.zones[key], components: original.filter((c) => c.id !== id) },
          },
        },
        changed: true,
      };
    }
  }

  // 2. Page bodies and per-page footers
  let changed = false;
  const newPages = schema.pages.map((page) => {
    if (page.body.components.some((c) => c.id === id)) {
      changed = true;
      return {
        ...page,
        body: { ...page.body, components: page.body.components.filter((c) => c.id !== id) },
      };
    }
    return page;
  });

  if (changed) return { schema: { ...schema, pages: newPages }, changed: true };

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    if (group.header.components.some((c) => c.id === id)) {
      changed = true;
      return {
        ...group,
        header: { ...group.header, components: group.header.components.filter((c) => c.id !== id) },
      };
    }
    if (group.footer.components.some((c) => c.id === id)) {
      changed = true;
      return {
        ...group,
        footer: { ...group.footer, components: group.footer.components.filter((c) => c.id !== id) },
      };
    }
    return group;
  });

  if (!changed) return { schema, changed: false };
  return { schema: { ...schema, groups: newGroups }, changed: true };
}

/**
 * Remove multiple components by their IDs in a single schema pass.
 * More efficient than calling removeComponentFromSchema multiple times.
 */
export function removeComponentsFromSchema(schema: LayoutSchema, ids: string[]): MutationResult {
  if (ids.length === 0) return { schema, changed: false };

  const idSet = new Set(ids);
  let anyChanged = false;

  // 1. Global zones
  let updatedZones = schema.zones;
  for (const key of GLOBAL_ZONE_KEYS) {
    const original = updatedZones[key].components;
    const filtered = original.filter((c) => !idSet.has(c.id));
    if (filtered.length !== original.length) {
      anyChanged = true;
      updatedZones = { ...updatedZones, [key]: { ...updatedZones[key], components: filtered } };
    }
  }

  // 2. Page bodies
  const newPages = schema.pages.map((page) => {
    const filteredBody = page.body.components.filter((c) => !idSet.has(c.id));
    if (filteredBody.length !== page.body.components.length) {
      anyChanged = true;
      return { ...page, body: { ...page.body, components: filteredBody } };
    }
    return page;
  });

  // 3. Group bands
  const newGroups = (schema.groups || []).map((group) => {
    const nextHeader = group.header.components.filter((c) => !idSet.has(c.id));
    const nextFooter = group.footer.components.filter((c) => !idSet.has(c.id));

    if (
      nextHeader.length !== group.header.components.length ||
      nextFooter.length !== group.footer.components.length
    ) {
      anyChanged = true;
      return {
        ...group,
        header: { ...group.header, components: nextHeader },
        footer: { ...group.footer, components: nextFooter },
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

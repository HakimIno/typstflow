import type { ComponentNode, LayoutSchema, Zone } from '@/types/schema';

function walkComponent(comp: ComponentNode, visit: (c: ComponentNode) => void): void {
  visit(comp);
  if (comp.type === 'columns' && comp.columns) {
    for (const col of comp.columns) {
      for (const child of col.components ?? []) {
        walkComponent(child, visit);
      }
    }
  } else if (comp.type === 'repeater' && comp.children) {
    for (const child of comp.children) {
      walkComponent(child, visit);
    }
  }
}

/** Collect all component IDs in a zone tree (including nested columns/repeaters). */
export function collectZoneComponentIds(zone: Zone): string[] {
  const ids: string[] = [];
  for (const comp of zone.components) {
    walkComponent(comp, (c) => ids.push(c.id));
  }
  return ids;
}

function addZoneToRegistry(
  registry: Record<string, ComponentNode>,
  zone: Zone
): void {
  for (const comp of zone.components) {
    walkComponent(comp, (c) => {
      registry[c.id] = c;
    });
  }
}

function patchZoneInRegistry(
  registry: Record<string, ComponentNode>,
  oldZone: Zone,
  newZone: Zone
): boolean {
  if (oldZone === newZone) return false;

  for (const id of collectZoneComponentIds(oldZone)) {
    delete registry[id];
  }
  addZoneToRegistry(registry, newZone);
  return true;
}

/**
 * Incrementally update the component registry when zones use structural sharing.
 * Falls back to a full rebuild when page count or group structure changes.
 */
export function patchComponentRegistry(
  prev: Record<string, ComponentNode>,
  oldSchema: LayoutSchema,
  newSchema: LayoutSchema
): Record<string, ComponentNode> {
  if (
    oldSchema.pages.length !== newSchema.pages.length ||
    (oldSchema.groups?.length ?? 0) !== (newSchema.groups?.length ?? 0)
  ) {
    return buildComponentRegistry(newSchema);
  }

  let registry: Record<string, ComponentNode> | null = null;
  let mutated = false;

  const ensureMutable = (): Record<string, ComponentNode> => {
    if (!registry) {
      registry = { ...prev };
    }
    return registry;
  };

  const patch = (oldZone: Zone, newZone: Zone) => {
    if (oldZone === newZone) return;
    const target = ensureMutable();
    if (patchZoneInRegistry(target, oldZone, newZone)) {
      mutated = true;
    }
  };

  patch(oldSchema.zones.header, newSchema.zones.header);
  patch(oldSchema.zones.footer, newSchema.zones.footer);

  for (let i = 0; i < newSchema.pages.length; i++) {
    patch(oldSchema.pages[i].body, newSchema.pages[i].body);
  }

  const oldGroups = oldSchema.groups ?? [];
  const newGroups = newSchema.groups ?? [];
  for (let i = 0; i < newGroups.length; i++) {
    patch(oldGroups[i].header, newGroups[i].header);
    patch(oldGroups[i].footer, newGroups[i].footer);
  }

  if (!mutated) return prev;
  return registry ?? prev;
}

export const buildComponentRegistry = (schema: LayoutSchema): Record<string, ComponentNode> => {
  const registry: Record<string, ComponentNode> = {};

  const processZone = (zone: Zone) => {
    addZoneToRegistry(registry, zone);
  };

  processZone(schema.zones.header);
  processZone(schema.zones.footer);
  for (const page of schema.pages) {
    processZone(page.body);
  }
  for (const group of schema.groups || []) {
    processZone(group.header);
    processZone(group.footer);
  }
  return registry;
};

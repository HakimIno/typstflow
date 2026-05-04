import type { LayoutSchema } from '@/types/schema';

// ✅ Helper: Get component position from schema
export function getComponentPosition(id: string, schema: LayoutSchema): { x: number; y: number } | null {
  // Check global zones
  for (const zKey of ['header', 'footer'] as const) {
    const found = schema.zones[zKey].components.find((c: any) => c.id === id);
    if (found) return { x: found.x || 0, y: found.y || 0 };
  }

  // Check pages
  for (const page of schema.pages) {
    const found = page.body.components.find((c: any) => c.id === id);
    if (found) return { x: found.x || 0, y: found.y || 0 };
  }

  return null;
}

// ✅ Helper: Get full component data from schema
export function getComponentById(
  id: string,
  schema: LayoutSchema
): { component: any; zoneKey: string; pageId?: string } | null {
  // Check global zones
  for (const zKey of ['header', 'footer'] as const) {
    const found = schema.zones[zKey].components.find((c: any) => c.id === id);
    if (found) return { component: found, zoneKey: zKey };
  }

  // Check pages
  for (const page of schema.pages) {
    const found = page.body.components.find((c: any) => c.id === id);
    if (found) return { component: found, zoneKey: 'body', pageId: page.id };
  }

  return null;
}

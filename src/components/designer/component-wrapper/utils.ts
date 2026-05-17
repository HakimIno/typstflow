import type { LayoutSchema } from '@/types/schema';

// ✅ Helper: Get component position from schema
export function getComponentPosition(
  id: string,
  schema: LayoutSchema
): { x: number; y: number } | null {
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

  // Check groups
  if (schema.groups) {
    for (const group of schema.groups) {
      const hFound = group.header.components.find((c: any) => c.id === id);
      if (hFound) return { x: hFound.x || 0, y: hFound.y || 0 };
      const fFound = group.footer.components.find((c: any) => c.id === id);
      if (fFound) return { x: fFound.x || 0, y: fFound.y || 0 };
    }
  }

  return null;
}

// ✅ Helper: Get full component data from schema
export function getComponentById(
  id: string,
  schema: LayoutSchema
): {
  component: any;
  zoneKey: string;
  pageId?: string;
  groupId?: string;
  groupType?: 'header' | 'footer';
} | null {
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

  // Check groups
  if (schema.groups) {
    for (const group of schema.groups) {
      const headerFound = group.header.components.find((c: any) => c.id === id);
      if (headerFound)
        return {
          component: headerFound,
          zoneKey: 'header',
          groupId: group.id,
          groupType: 'header',
        };

      const footerFound = group.footer.components.find((c: any) => c.id === id);
      if (footerFound)
        return {
          component: footerFound,
          zoneKey: 'footer',
          groupId: group.id,
          groupType: 'footer',
        };
    }
  }

  return null;
}

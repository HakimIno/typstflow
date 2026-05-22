import type { ComponentNode, LayoutSchema, Zone } from '@/types/schema';

function visitComponent(comp: ComponentNode, visit: (c: ComponentNode) => void): void {
  visit(comp);
  if (comp.type === 'repeater') {
    for (const child of comp.children ?? []) visitComponent(child, visit);
  } else if (comp.type === 'columns') {
    for (const col of comp.columns ?? []) {
      for (const child of col.components ?? []) visitComponent(child, visit);
    }
  }
}

function visitZone(zone: Zone | undefined, visit: (c: ComponentNode) => void): void {
  if (!zone?.components) return;
  for (const comp of zone.components) visitComponent(comp, visit);
}

/** Walk every component in the schema (zones, pages, groups). */
export function walkSchemaComponents(schema: LayoutSchema, visit: (c: ComponentNode) => void): void {
  visitZone(schema.zones.header, visit);
  visitZone(schema.zones.footer, visit);
  for (const page of schema.pages) visitZone(page.body, visit);
  for (const group of schema.groups ?? []) {
    visitZone(group.header, visit);
    visitZone(group.footer, visit);
  }
}

function usesFormatHelper(comp: ComponentNode): boolean {
  if (comp.type === 'text') {
    const format = comp.format;
    return !!format && format !== 'text';
  }
  if (comp.type === 'table') {
    return (comp.columns ?? []).some((col) => col.format && col.format !== 'text');
  }
  return false;
}

export function schemaNeedsCodetasticImports(schema: LayoutSchema): boolean {
  let found = false;
  walkSchemaComponents(schema, (comp) => {
    if (comp.type === 'qr' || comp.type === 'barcode') found = true;
  });
  return found;
}

export function schemaNeedsFormatHelpers(schema: LayoutSchema): boolean {
  let found = false;
  walkSchemaComponents(schema, (comp) => {
    if (usesFormatHelper(comp)) found = true;
  });
  return found;
}

function shouldRenderZone(
  zone: Zone,
  pageIndex: number,
  totalPages: number
): boolean {
  if (zone.repeatOnEveryPage) return true;
  if (zone.showOnFirstPageOnly) return pageIndex === 0;
  if (zone.showOnLastPageOnly) return pageIndex === totalPages - 1;
  return pageIndex === 0;
}

function zoneHasComponents(zone: Zone | undefined): boolean {
  return (zone?.components?.length ?? 0) > 0;
}

/** True when a page has no body/header/footer content to emit. */
export function isPageEmptyForExport(schema: LayoutSchema, pageIndex: number): boolean {
  const totalPages = schema.pages.length;
  const pageDef = schema.pages[pageIndex];
  if (zoneHasComponents(pageDef.body)) return false;

  const header = schema.zones.header;
  if (
    !header.repeatOnEveryPage &&
    shouldRenderZone(header, pageIndex, totalPages) &&
    zoneHasComponents(header)
  ) {
    return false;
  }

  const footer = schema.zones.footer;
  if (
    !footer.repeatOnEveryPage &&
    shouldRenderZone(footer, pageIndex, totalPages) &&
    zoneHasComponents(footer)
  ) {
    return false;
  }

  return true;
}

import type { GroupDefinition, LayoutSchema, PageDefinition, Zone } from '@/types/schema';

function zoneMetaEqual(a: Zone, b: Zone): boolean {
  return (
    a.id === b.id &&
    a.minHeight === b.minHeight &&
    a.layoutMode === b.layoutMode &&
    a.flowGap === b.flowGap &&
    a.background === b.background &&
    a.padding === b.padding &&
    a.showOnFirstPageOnly === b.showOnFirstPageOnly &&
    a.showOnLastPageOnly === b.showOnLastPageOnly &&
    a.repeatOnEveryPage === b.repeatOnEveryPage
  );
}

function shareZone(prev: Zone, next: Zone): Zone {
  if (prev === next) return next;
  if (prev.components === next.components && zoneMetaEqual(prev, next)) {
    return prev;
  }
  if (prev.components === next.components) {
    return zoneMetaEqual(prev, next) ? prev : next;
  }
  return next;
}

function sharePage(prev: PageDefinition, next: PageDefinition): PageDefinition {
  if (prev === next) return next;
  if (prev.id !== next.id) return next;

  const body = shareZone(prev.body, next.body);
  if (body === prev.body && next.name === prev.name && next.dataSource === prev.dataSource) {
    return prev;
  }
  if (body === next.body) return next;
  return { ...next, body };
}

function sharePages(prev: PageDefinition[], next: PageDefinition[]): PageDefinition[] {
  if (prev === next) return next;
  if (prev.length !== next.length) return next;

  let changed = false;
  const pages = next.map((page, i) => {
    const shared = sharePage(prev[i], page);
    if (shared !== page) changed = true;
    return shared;
  });
  return changed ? pages : next;
}

function shareGroups(prev: GroupDefinition[], next: GroupDefinition[]): GroupDefinition[] {
  if (prev === next) return next;
  if (prev.length !== next.length) return next;

  let changed = false;
  const groups = next.map((group, i) => {
    const p = prev[i];
    if (p === group) return group;
    if (p?.id !== group.id) return group;

    const header = shareZone(p.header, group.header);
    const footer = shareZone(p.footer, group.footer);
    if (
      header === p.header &&
      footer === p.footer &&
      group.name === p.name &&
      group.field === p.field
    ) {
      return p;
    }
    if (header === group.header && footer === group.footer) return group;
    changed = true;
    return { ...group, header, footer };
  });
  return changed ? groups : next;
}

/**
 * Maximize structural sharing between schema versions for undo history.
 * Unchanged pages/zones keep the same object references → less GC pressure
 * with 1000+ page documents.
 */
export function shareSchemaStructure(
  prev: LayoutSchema | undefined,
  next: LayoutSchema
): LayoutSchema {
  if (!prev || prev === next) return next;

  let result = next;

  const pages = sharePages(prev.pages, next.pages);
  if (pages !== next.pages) result = { ...result, pages };

  const header = shareZone(prev.zones.header, next.zones.header);
  const footer = shareZone(prev.zones.footer, next.zones.footer);
  if (header !== next.zones.header || footer !== next.zones.footer) {
    result = { ...result, zones: { header, footer } };
  } else if (prev.zones !== next.zones) {
    result = { ...result, zones: prev.zones };
  }

  const groups = shareGroups(prev.groups ?? [], next.groups ?? []);
  if (groups !== next.groups) result = { ...result, groups };

  if (prev.page === next.page) result = { ...result, page: prev.page };
  if (prev.fonts === next.fonts) result = { ...result, fonts: prev.fonts };
  if (prev.variables === next.variables) result = { ...result, variables: prev.variables };
  if (prev.dataSchema === next.dataSchema) result = { ...result, dataSchema: prev.dataSchema };

  return result;
}

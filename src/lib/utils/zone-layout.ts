import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import type { LayoutSchema, ZoneKey } from '@/types/schema';

export interface GroupLayoutInput {
  id: string;
  headerHeightMm: number;
  footerHeightMm: number;
}

/** Compact layout config — parsed once, no schema traversal on hot path. */
export interface ZoneLayoutConfig {
  pageHeightMm: number;
  headerHeightMm: number;
  footerHeightMm: number;
  headerRepeat: boolean;
  footerRepeat: boolean;
  footerLastPageOnly: boolean;
  totalPages: number;
  groups: GroupLayoutInput[];
}

export interface PageZoneOffsets {
  pageIndex: number;
  header: number;
  body: number;
  footer: number;
  headerVisible: boolean;
  footerVisible: boolean;
}

export function buildZoneLayoutConfig(schema: LayoutSchema): ZoneLayoutConfig {
  const { height: pageHeightMm } = getPaperDimensions(schema.page.size, schema.page.orientation);

  return {
    pageHeightMm,
    headerHeightMm: parseTypstUnit(schema.zones.header?.minHeight || '0mm'),
    footerHeightMm: parseTypstUnit(schema.zones.footer?.minHeight || '0mm'),
    headerRepeat: schema.zones.header?.repeatOnEveryPage === true,
    footerRepeat: schema.zones.footer?.repeatOnEveryPage === true,
    footerLastPageOnly: schema.zones.footer?.showOnLastPageOnly === true,
    totalPages: schema.pages.length,
    groups: (schema.groups || []).map((g) => ({
      id: g.id,
      headerHeightMm: parseTypstUnit(g.header?.minHeight || '0mm'),
      footerHeightMm: parseTypstUnit(g.footer?.minHeight || '0mm'),
    })),
  };
}

export function isHeaderVisible(config: ZoneLayoutConfig, pageIndex: number): boolean {
  return config.headerRepeat || pageIndex === 0;
}

export function isFooterVisible(config: ZoneLayoutConfig, pageIndex: number): boolean {
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === config.totalPages - 1;
  return (
    config.footerRepeat ||
    (config.footerLastPageOnly && isLastPage) ||
    (!config.footerRepeat && !config.footerLastPageOnly && isFirstPage)
  );
}

export function sumGroupHeaderHeights(config: ZoneLayoutConfig): number {
  let sum = 0;
  for (const g of config.groups) {
    sum += g.headerHeightMm;
  }
  return sum;
}

/** Pure zone offset math — mirrors Rust `zone_layout.rs`. */
export function computeZoneOffset(
  config: ZoneLayoutConfig,
  zoneKey: ZoneKey | string,
  pageIndex: number
): number {
  if (zoneKey === 'header') return 0;

  if (zoneKey === 'footer') {
    if (!isFooterVisible(config, pageIndex)) return 0;
    return config.pageHeightMm - config.footerHeightMm;
  }

  let offset = 0;
  if (isHeaderVisible(config, pageIndex)) {
    offset += config.headerHeightMm;
  }

  if (zoneKey === 'body') {
    offset += sumGroupHeaderHeights(config);
  }

  return offset;
}

export function computeBandOffset(
  config: ZoneLayoutConfig,
  groupId: string,
  groupType: 'header' | 'footer',
  pageIndex: number
): number {
  let offset = 0;
  if (isHeaderVisible(config, pageIndex)) {
    offset += config.headerHeightMm;
  }

  if (groupType === 'header') {
    for (const group of config.groups) {
      if (group.id === groupId) return offset;
      offset += group.headerHeightMm;
    }
    return offset;
  }

  let bottomOffset = config.pageHeightMm;

  if (isFooterVisible(config, pageIndex)) {
    bottomOffset -= config.footerHeightMm;
  }

  for (let i = config.groups.length - 1; i >= 0; i--) {
    const group = config.groups[i];
    bottomOffset -= group.footerHeightMm;
    if (group.id === groupId) return bottomOffset;
  }

  return bottomOffset;
}

export function buildPageZoneOffsets(config: ZoneLayoutConfig, pageIndex: number): PageZoneOffsets {
  const headerVisible = isHeaderVisible(config, pageIndex);
  const footerVisible = isFooterVisible(config, pageIndex);

  return {
    pageIndex,
    header: 0,
    body: computeZoneOffset(config, 'body', pageIndex),
    footer: footerVisible ? config.pageHeightMm - config.footerHeightMm : 0,
    headerVisible,
    footerVisible,
  };
}

/**
 * Precomputed zone offsets for all pages — O(1) lookup during drag.
 * Invalidated when schema reference changes.
 */
export class ZoneLayoutCache {
  private config: ZoneLayoutConfig;
  private pageIndexById = new Map<string, number>();
  private offsetsByPageId = new Map<string, PageZoneOffsets>();
  private offsetsByIndex: PageZoneOffsets[] = [];

  constructor(schema: LayoutSchema) {
    this.config = buildZoneLayoutConfig(schema);
    for (let i = 0; i < schema.pages.length; i++) {
      const page = schema.pages[i];
      if (!page) continue;
      const offsets = buildPageZoneOffsets(this.config, i);
      this.pageIndexById.set(page.id, i);
      this.offsetsByPageId.set(page.id, offsets);
      this.offsetsByIndex[i] = offsets;
    }
  }

  getConfig(): ZoneLayoutConfig {
    return this.config;
  }

  getPageIndex(pageId?: string): number {
    if (!pageId) return 0;
    return this.pageIndexById.get(pageId) ?? 0;
  }

  getPageOffsets(pageId?: string): PageZoneOffsets {
    if (!pageId) return this.offsetsByIndex[0] ?? buildPageZoneOffsets(this.config, 0);
    return this.offsetsByPageId.get(pageId) ?? buildPageZoneOffsets(this.config, 0);
  }

  getZoneOffset(zoneKey: ZoneKey | string, pageId?: string): number {
    const pageIndex = this.getPageIndex(pageId);
    return computeZoneOffset(this.config, zoneKey, pageIndex);
  }

  getBandOffset(groupId: string, groupType: 'header' | 'footer', pageId?: string): number {
    const pageIndex = this.getPageIndex(pageId);
    return computeBandOffset(this.config, groupId, groupType, pageIndex);
  }

  getPageAbsOffsetMm(pageId?: string): number {
    return this.getPageIndex(pageId) * this.config.pageHeightMm;
  }
}

let activeCache: ZoneLayoutCache | null = null;
let activeSchemaRef: LayoutSchema | null = null;

/** Returns a cached ZoneLayoutCache, rebuilding only when schema reference changes. */
export function getZoneLayoutCache(schema: LayoutSchema): ZoneLayoutCache {
  if (activeSchemaRef !== schema || !activeCache) {
    activeCache = new ZoneLayoutCache(schema);
    activeSchemaRef = schema;
  }
  return activeCache;
}

/** Force cache invalidation (e.g. after schema clone mutations). */
export function invalidateZoneLayoutCache(): void {
  activeCache = null;
  activeSchemaRef = null;
}

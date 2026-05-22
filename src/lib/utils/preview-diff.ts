import type { LayoutSchema } from '@/types/schema';

export interface PreviewStaleResult {
  /** Recompile every page (global layout/fonts/groups changed). */
  allPages: boolean;
  /** Zero-based page indices that need recompilation. */
  indices: number[];
}

/**
 * Determine which preview pages are stale using structural-sharing references.
 * Unchanged pages keep the same object identity from shareSchemaStructure().
 */
export function computeStalePageIndices(
  prev: LayoutSchema | undefined,
  next: LayoutSchema,
  activePageId?: string | null
): PreviewStaleResult {
  const all = next.pages.map((_, i) => i);

  if (!prev) {
    return { allPages: true, indices: all };
  }

  const globalChanged =
    prev.page !== next.page ||
    prev.fonts !== next.fonts ||
    prev.variables !== next.variables ||
    prev.dataSchema !== next.dataSchema ||
    prev.zones.header !== next.zones.header ||
    prev.zones.footer !== next.zones.footer ||
    prev.groups !== next.groups ||
    prev.groupDataSource !== next.groupDataSource ||
    prev.batchDataSource !== next.batchDataSource ||
    prev.pages.length !== next.pages.length ||
    (next.groups?.length ?? 0) > 0 ||
    Boolean(next.batchDataSource);

  if (globalChanged) {
    return { allPages: true, indices: all };
  }

  const indices: number[] = [];
  for (let i = 0; i < next.pages.length; i++) {
    if (prev.pages[i] !== next.pages[i]) {
      indices.push(i);
    }
  }

  if (activePageId) {
    const activeIdx = next.pages.findIndex((p) => p.id === activePageId);
    if (activeIdx >= 0 && !indices.includes(activeIdx)) {
      indices.push(activeIdx);
    }
  }

  indices.sort((a, b) => a - b);
  return { allPages: false, indices };
}

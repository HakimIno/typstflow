import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { WasmLayoutEngine } from '@/lib/wasm-layout-engine';
import type { LayoutSchema } from '@/types/schema';

export type WasmSnapNode = Parameters<WasmLayoutEngine['loadNodes']>[0][number];

const PAGE_EDGE_PREFIX = '__page-edge__';
const GUIDE_PREFIX = '__guide__';

export interface BuildWasmSnapNodesOptions {
  excludeIds?: Set<string> | string[];
  pageStartIdx: number;
  pageEndIdx: number;
  maxComponentsPerPage?: number;
  manualGuides?: { vertical: number[]; horizontal: number[] };
  /** When false, Y coords are page-local (no page stacking). Default: true. */
  stackPages?: boolean;
}

/**
 * Build RTree nodes for WASM snap in document-absolute coordinates.
 * Y includes page stacking (pageIndex × pageHeight); X is page-local.
 * Zone offsets are applied via LayoutEngine.calculateZoneOffset at load time.
 */
export function buildWasmSnapNodes(
  schema: LayoutSchema,
  options: BuildWasmSnapNodesOptions
): WasmSnapNode[] {
  const excludeIds = new Set(options.excludeIds ?? []);
  const maxPerPage = options.maxComponentsPerPage ?? 100;
  const stackPages = options.stackPages !== false;
  const { width: pageWidth, height: pageHeight } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  const nodes: WasmSnapNode[] = [];

  const addComponent = (
    c: { id: string; x?: number; y?: number; width?: number; height?: number },
    zoneOffset: number,
    zone: string,
    pageId: string,
    pageAbsY: number
  ) => {
    if (excludeIds.has(c.id)) return;
    nodes.push({
      id: c.id,
      zone,
      pageId,
      x: c.x || 0,
      y: (c.y || 0) + zoneOffset + pageAbsY,
      width: c.width || 0,
      height: c.height || 0,
    });
  };

  for (let i = options.pageStartIdx; i <= options.pageEndIdx; i++) {
    const page = schema.pages[i];
    if (!page) continue;

    const pageAbsY = stackPages ? i * pageHeight : 0;
    const pageId = page.id;
    const isFirstPage = i === 0;
    const isLastPage = i === schema.pages.length - 1;

    const isHeaderRepeated = schema.zones.header?.repeatOnEveryPage === true;
    if (isHeaderRepeated || isFirstPage) {
      let count = 0;
      for (const c of schema.zones.header.components) {
        if (count++ >= maxPerPage) break;
        addComponent(c, 0, `header:${pageId}`, pageId, pageAbsY);
      }
    }

    const bodyOffset = LayoutEngine.calculateZoneOffset('body', schema, pageId);
    let count = 0;
    for (const c of page.body.components) {
      if (count++ >= maxPerPage) break;
      addComponent(c, bodyOffset, `body:${pageId}`, pageId, pageAbsY);
    }

    const isFooterRepeated = schema.zones.footer?.repeatOnEveryPage === true;
    const showOnLastPageOnly = schema.zones.footer?.showOnLastPageOnly === true;
    const isFooterVisible =
      isFooterRepeated ||
      (showOnLastPageOnly && isLastPage) ||
      (!isFooterRepeated && !showOnLastPageOnly && isFirstPage);

    if (isFooterVisible) {
      const footerOffset = LayoutEngine.calculateZoneOffset('footer', schema, pageId);
      count = 0;
      for (const c of schema.zones.footer.components) {
        if (count++ >= maxPerPage) break;
        addComponent(c, footerOffset, `footer:${pageId}`, pageId, pageAbsY);
      }
    }

    const edgeZone = `page:${pageId}`;
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-l-${pageId}`,
      zone: edgeZone,
      pageId,
      x: 0,
      y: pageAbsY,
      width: 0.01,
      height: pageHeight,
    });
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-r-${pageId}`,
      zone: edgeZone,
      pageId,
      x: pageWidth - 0.01,
      y: pageAbsY,
      width: 0.01,
      height: pageHeight,
    });
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-t-${pageId}`,
      zone: edgeZone,
      pageId,
      x: 0,
      y: pageAbsY,
      width: pageWidth,
      height: 0.01,
    });
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-b-${pageId}`,
      zone: edgeZone,
      pageId,
      x: 0,
      y: pageAbsY + pageHeight - 0.01,
      width: pageWidth,
      height: 0.01,
    });
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-cx-${pageId}`,
      zone: edgeZone,
      pageId,
      x: pageWidth / 2 - 0.005,
      y: pageAbsY,
      width: 0.01,
      height: pageHeight,
    });
    nodes.push({
      id: `${PAGE_EDGE_PREFIX}-cy-${pageId}`,
      zone: edgeZone,
      pageId,
      x: 0,
      y: pageAbsY + pageHeight / 2 - 0.005,
      width: pageWidth,
      height: 0.01,
    });

    if (options.manualGuides) {
      for (const x of options.manualGuides.vertical) {
        nodes.push({
          id: `${GUIDE_PREFIX}-v-${x}-${pageId}`,
          zone: `guide:${pageId}`,
          pageId,
          x,
          y: pageAbsY,
          width: 0.01,
          height: pageHeight,
        });
      }
      for (const y of options.manualGuides.horizontal) {
        nodes.push({
          id: `${GUIDE_PREFIX}-h-${y}-${pageId}`,
          zone: `guide:${pageId}`,
          pageId,
          x: 0,
          y: pageAbsY + y,
          width: pageWidth,
          height: 0.01,
        });
      }
    }
  }

  return nodes;
}

export function getSnapPageRange(
  activePageIdx: number,
  totalPages: number,
  radius: number
): { pageStartIdx: number; pageEndIdx: number } {
  return {
    pageStartIdx: Math.max(0, activePageIdx - radius),
    pageEndIdx: Math.min(totalPages - 1, activePageIdx + radius),
  };
}

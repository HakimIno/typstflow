'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import type { LayoutSchema } from '@/types/schema';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ComponentRect {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  pageIndex: number;
  zone: 'header' | 'body' | 'footer';
}

// Layout Constants (Must match Canvas.tsx tailwind classes)
const PADDING_TOP_PX = 48; // pt-12
const PADDING_LEFT_PX = 64; // pl-16
const GAP_BETWEEN_PAGES_PX = 32; // gap-8

/**
 * Pixel-perfect virtual scrolling hook.
 * Calculates intersection in absolute pixel space to account for mixed scaled/unscaled layout.
 */
export function useVirtualElements(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
  schema: LayoutSchema,
  activePageId?: string | null
) {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string>>(new Set());
  const componentsRef = useRef<ComponentRect[]>([]);

  const { height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  // 1. Pre-calculate relative component positions (MM)
  useEffect(() => {
    const components: ComponentRect[] = [];
    const headerHeight = parseTypstUnit(schema.zones.header.minHeight);

    for (const [pIdx, page] of schema.pages.entries()) {
      const bodyHeight = parseTypstUnit(page.body.minHeight);

      // Header components (global)
      for (const comp of schema.zones.header.components) {
        components.push({
          id: `${comp.id}-p${pIdx}`,
          xMm: comp.x || 0,
          yMm: comp.y || 0,
          widthMm: comp.width || 0,
          heightMm: comp.height || 0,
          pageIndex: pIdx,
          zone: 'header',
        });
      }

      // Body components (per-page)
      for (const comp of page.body.components) {
        components.push({
          id: comp.id,
          xMm: comp.x || 0,
          yMm: headerHeight + (comp.y || 0),
          widthMm: comp.width || 0,
          heightMm: comp.height || 0,
          pageIndex: pIdx,
          zone: 'body',
        });
      }

      // Footer components (global)
      for (const comp of schema.zones.footer.components) {
        components.push({
          id: `${comp.id}-p${pIdx}`,
          xMm: comp.x || 0,
          yMm: headerHeight + bodyHeight + (comp.y || 0),
          widthMm: comp.width || 0,
          heightMm: comp.height || 0,
          pageIndex: pIdx,
          zone: 'footer',
        });
      }
    }

    componentsRef.current = components;
  }, [schema]);

  // 2. Viewport intersection test in Pixel Space
  const updateVisible = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !zoom || zoom <= 0) return;

    const { scrollLeft, scrollTop, clientWidth, clientHeight } = container;

    // Pixel Viewport with Overscan (Large buffer for smoothness)
    const OVERSCAN = 400; 
    const vTop = scrollTop - OVERSCAN;
    const vBottom = scrollTop + clientHeight + OVERSCAN;
    const vLeft = scrollLeft - OVERSCAN;
    const vRight = scrollLeft + clientWidth + OVERSCAN;

    const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm) * zoom;
    
    const visiblePageSet = new Set<string>();
    const visibleCompSet = new Set<string>();

    // Page-level visibility check (Pixel-Perfect)
    for (const [pIdx, page] of schema.pages.entries()) {
      // PageTopPx = PaddingTop + (PageIndex * (PageHeightPx + GapPx))
      const pTop = PADDING_TOP_PX + pIdx * (pageHeightPx + GAP_BETWEEN_PAGES_PX);
      const pBottom = pTop + pageHeightPx;

      if (pBottom >= vTop && pTop <= vBottom) {
        visiblePageSet.add(page.id);
      }
    }

    // CRITICAL: Always ensure the active page is visible
    if (activePageId) {
      visiblePageSet.add(activePageId);
    }

    // Fallback: Ensure at least the first page is rendered if none detected
    if (visiblePageSet.size === 0 && schema.pages.length > 0) {
      visiblePageSet.add(schema.pages[0].id);
    }

    // Component-level visibility check (Pixel-Perfect)
    for (const comp of componentsRef.current) {
      const page = schema.pages[comp.pageIndex];
      if (!page) continue;

      // Always show components of the active page for safety
      if (page.id === activePageId) {
        visibleCompSet.add(comp.id);
        continue;
      }

      // Only check components of pages that are somewhat near the viewport
      const pTop = PADDING_TOP_PX + comp.pageIndex * (pageHeightPx + GAP_BETWEEN_PAGES_PX);
      const pBottom = pTop + pageHeightPx;

      if (pBottom < vTop - 500 || pTop > vBottom + 500) continue;

      // Component Absolute Pixel Position
      // xPx = PaddingLeft + (comp.xMm * zoom * DPI)
      // yPx = pTop + (comp.yMm * zoom * DPI)
      const cLeft = PADDING_LEFT_PX + LayoutEngine.mmToPx(comp.xMm) * zoom;
      const cTop = pTop + LayoutEngine.mmToPx(comp.yMm) * zoom;
      const cWidth = LayoutEngine.mmToPx(comp.widthMm) * zoom;
      const cHeight = LayoutEngine.mmToPx(comp.heightMm) * zoom;

      if (
        cTop + cHeight >= vTop &&
        cTop <= vBottom &&
        cLeft + cWidth >= vLeft &&
        cLeft <= vRight
      ) {
        visibleCompSet.add(comp.id);
      }
    }

    // Atomic State Updates
    setVisibleIds((prev) => {
      if (prev.size !== visibleCompSet.size) return visibleCompSet;
      for (const id of visibleCompSet) {
        if (!prev.has(id)) return visibleCompSet;
      }
      return prev;
    });

    setVisiblePageIds((prev) => {
      if (prev.size !== visiblePageSet.size) return visiblePageSet;
      for (const id of visiblePageSet) {
        if (!prev.has(id)) return visiblePageSet;
      }
      return prev;
    });
  }, [scrollRef, zoom, schema, pageHeightMm, activePageId]);

  // 3. Event Listeners
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId = 0;
    const handleEvent = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateVisible);
    };

    container.addEventListener('scroll', handleEvent, { passive: true });
    window.addEventListener('resize', handleEvent, { passive: true });
    
    const resizeObserver = new ResizeObserver(handleEvent);
    resizeObserver.observe(container);

    // Initial calculation
    updateVisible();

    return () => {
      container.removeEventListener('scroll', handleEvent);
      window.removeEventListener('resize', handleEvent);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [scrollRef, updateVisible]);

  return { visibleIds, visiblePageIds };
}

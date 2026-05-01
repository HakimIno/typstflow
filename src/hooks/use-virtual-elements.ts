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

const PADDING_TOP_PX = 48;
const PADDING_LEFT_PX = 64;
const GAP_BETWEEN_PAGES_PX = 32;

export function useVirtualElements(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
  schema: LayoutSchema,
  activePageId?: string | null
) {
  // ✅ Fix Bug 1: null = "ยังไม่คำนวณ" → Zone จะ render ทั้งหมด
  // ต่างจาก new Set() ที่หมายถึง "คำนวณแล้ว แต่ไม่มีอะไรเลย"
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);
  const [visiblePageIds, setVisiblePageIds] = useState<Set<string> | null>(null);
  const componentsRef = useRef<ComponentRect[]>([]);

  const { height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

  const updateVisible = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !zoom || zoom <= 0) return;

    const { scrollLeft, scrollTop, clientWidth, clientHeight } = container;

    const OVERSCAN = 400;
    const vTop = scrollTop - OVERSCAN;
    const vBottom = scrollTop + clientHeight + OVERSCAN;
    const vLeft = scrollLeft - OVERSCAN;
    const vRight = scrollLeft + clientWidth + OVERSCAN;

    const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm) * zoom;

    const visiblePageSet = new Set<string>();
    const visibleCompSet = new Set<string>();

    for (const [pIdx, page] of schema.pages.entries()) {
      const pTop = PADDING_TOP_PX + pIdx * (pageHeightPx + GAP_BETWEEN_PAGES_PX);
      const pBottom = pTop + pageHeightPx;

      if (pBottom >= vTop && pTop <= vBottom) {
        visiblePageSet.add(page.id);
      }
    }

    if (activePageId) visiblePageSet.add(activePageId);
    if (visiblePageSet.size === 0 && schema.pages.length > 0) {
      visiblePageSet.add(schema.pages[0].id);
    }

    for (const comp of componentsRef.current) {
      const page = schema.pages[comp.pageIndex];
      if (!page) continue;

      if (page.id === activePageId) {
        visibleCompSet.add(comp.id);
        continue;
      }

      const pTop = PADDING_TOP_PX + comp.pageIndex * (pageHeightPx + GAP_BETWEEN_PAGES_PX);
      const pBottom = pTop + pageHeightPx;

      if (pBottom < vTop - 500 || pTop > vBottom + 500) continue;

      const cLeft = PADDING_LEFT_PX + LayoutEngine.mmToPx(comp.xMm) * zoom;
      const cTop = pTop + LayoutEngine.mmToPx(comp.yMm) * zoom;
      // ✅ Fix Bug 3 (ป้องกัน element ขนาด 0 หายไป): ใช้ min size 1px สำหรับ intersection test
      const cWidth = Math.max(LayoutEngine.mmToPx(comp.widthMm) * zoom, 1);
      const cHeight = Math.max(LayoutEngine.mmToPx(comp.heightMm) * zoom, 1);

      if (
        cTop + cHeight >= vTop &&
        cTop <= vBottom &&
        cLeft + cWidth >= vLeft &&
        cLeft <= vRight
      ) {
        visibleCompSet.add(comp.id);
      }
    }

    setVisibleIds((prev) => {
      if (prev === null) return visibleCompSet;
      if (prev.size !== visibleCompSet.size) return visibleCompSet;
      for (const id of visibleCompSet) {
        if (!prev.has(id)) return visibleCompSet;
      }
      return prev;
    });

    setVisiblePageIds((prev) => {
      if (prev === null) return visiblePageSet;
      if (prev.size !== visiblePageSet.size) return visiblePageSet;
      for (const id of visiblePageSet) {
        if (!prev.has(id)) return visiblePageSet;
      }
      return prev;
    });
  }, [scrollRef, zoom, schema, pageHeightMm, activePageId]);

  // ✅ Fix Bug 2: รวม 2 effects เป็น 1
  // การแยก effect ทำให้ updateVisible อาจถูกเรียกก่อน componentsRef จะ update
  useEffect(() => {
    const components: ComponentRect[] = [];
    const headerHeight = parseTypstUnit(schema.zones.header.minHeight);

    for (const [pIdx, page] of schema.pages.entries()) {
      const bodyHeight = parseTypstUnit(page.body.minHeight);

      for (const comp of schema.zones.header.components) {
        components.push({
          // ✅ Fix Bug 3: ใช้ ID เดียวกับที่ Zone จะ check
          // header/footer ใช้ original comp.id แต่แยก pageIndex ให้ถูกต้อง
          id: `${comp.id}-p${pIdx}`,
          xMm: comp.x || 0,
          yMm: comp.y || 0,
          widthMm: comp.width || 0,
          heightMm: comp.height || 0,
          pageIndex: pIdx,
          zone: 'header',
        });
      }

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

    // ✅ อัพเดท ref ก่อน แล้วค่อย recalculate ทันที
    componentsRef.current = components;
    updateVisible();
  }, [schema, updateVisible]);

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
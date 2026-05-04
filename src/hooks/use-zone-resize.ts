'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { useEffect, useRef, useState } from 'react';

export function useZoneResize(
  zoneKey: 'header' | 'body' | 'footer',
  initialMinHeight: string,
  components: ComponentNode[],
  containerRef: React.RefObject<HTMLDivElement | null>,
  labelRef: React.RefObject<HTMLDivElement | null>,
  resizeEdge: 'top' | 'bottom' | 'none' = 'bottom',
  pageId?: string,
  groupId?: string,
  groupType?: 'header' | 'footer'
) {
  const [isResizing, setIsResizing] = useState(false);
  const initialHeightMm = Number.parseFloat(initialMinHeight || '50');
  const heightRef = useRef(initialHeightMm);

  const updateZone = useDesignerStore((state) => state.updateZone);
  const zoom = useDesignerStore((state) => state.zoom);
  const schema = useDesignerStore((state) => state.schema);

  // Sync with store when initialMinHeight changes externally
  useEffect(() => {
    const val = Number.parseFloat(initialMinHeight || '50');
    heightRef.current = val;
  }, [initialMinHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
    if (resizeEdge === 'none') return;

    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = heightRef.current;

    // Calculate the minimum allowed height based on the bottom-most component in THIS zone
    const lowestPoint = components.reduce((max, comp) => {
      const bottom = (comp.y || 0) + (comp.height || 0);
      return Math.max(max, bottom);
    }, 0);

    const safetyMargin = 5;
    const minConstraint = Math.max(10, lowestPoint + safetyMargin);

    // Calculate maximum constraint based on paper size and other zones
    const { height: pageHeightMm } = getPaperDimensions(schema.page.size, schema.page.orientation);

    // Find body's minimum required height based on its components
    const targetPage = pageId ? schema.pages.find((p) => p.id === pageId) : schema.pages[0];
    const bodyLowestPoint = (targetPage?.body.components || []).reduce((max, comp) => {
      const bottom = (comp.y || 0) + (comp.height || 0);
      return Math.max(max, bottom);
    }, 0);
    const minBodyHeight = Math.max(20, bodyLowestPoint + safetyMargin);

    let maxConstraint = pageHeightMm;
    if (zoneKey === 'header') {
      const footerHeight = Number.parseFloat(schema.zones.footer.minHeight || '50');
      // Subtract all group band heights
      const groupHeights = (schema.groups || []).reduce(
        (acc, g) =>
          acc +
          Number.parseFloat(g.header.minHeight || '0') +
          Number.parseFloat(g.footer.minHeight || '0'),
        0
      );
      maxConstraint = pageHeightMm - footerHeight - minBodyHeight - groupHeights;
    } else if (zoneKey === 'footer') {
      const headerHeight = Number.parseFloat(schema.zones.header.minHeight || '50');
      const groupHeights = (schema.groups || []).reduce(
        (acc, g) =>
          acc +
          Number.parseFloat(g.header.minHeight || '0') +
          Number.parseFloat(g.footer.minHeight || '0'),
        0
      );
      maxConstraint = pageHeightMm - headerHeight - minBodyHeight - groupHeights;
    }

    const rafRef = { current: 0 };
    document.body.classList.add('is-resizing-zone');

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      let deltaMm = LayoutEngine.pxToMm(deltaY / zoom);

      // If we are resizing from the TOP edge (e.g. Footer), pulling down (positive Y) SHRINKS the zone.
      if (resizeEdge === 'top') {
        deltaMm = -deltaMm;
      }

      let newHeight = startHeight + deltaMm;
      newHeight = Math.max(minConstraint, Math.min(maxConstraint, newHeight));

      const snappedHeight = LayoutEngine.snap(newHeight);

      // --- PERFORMANCE OPTIMIZATION (ULTIMATE) ---
      // Cancel any pending frame to avoid flooding the browser's render queue
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        // 1. Update the local height ref
        heightRef.current = snappedHeight;

        // 2. Direct DOM manipulation for the container
        if (containerRef.current) {
          containerRef.current.style.height = `${snappedHeight}mm`;
        }

        // 3. Direct DOM manipulation for the label
        if (labelRef.current) {
          labelRef.current.innerText = `HEIGHT: ${snappedHeight.toFixed(1)}mm`;
        }
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('is-resizing-zone');

      updateZone(
        zoneKey,
        { minHeight: `${heightRef.current}mm` },
        pageId,
        false,
        groupId,
        groupType
      );
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return {
    isResizing,
    handleResizeStart,
  };
}

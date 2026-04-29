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
  resizeEdge: 'top' | 'bottom' | 'none' = 'bottom'
) {
  const [isResizing, setIsResizing] = useState(false);
  const initialHeightMm = Number.parseFloat(initialMinHeight || '50');
  const [localHeight, setLocalHeight] = useState(initialHeightMm);
  const heightRef = useRef(initialHeightMm);

  const updateZone = useDesignerStore((state) => state.updateZone);
  const zoom = useDesignerStore((state) => state.zoom);
  const schema = useDesignerStore((state) => state.schema);

  // Sync with store when initialMinHeight changes externally
  useEffect(() => {
    const val = Number.parseFloat(initialMinHeight || '50');
    setLocalHeight(val);
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
    const bodyLowestPoint = schema.zones.body.components.reduce((max, comp) => {
      const bottom = (comp.y || 0) + (comp.height || 0);
      return Math.max(max, bottom);
    }, 0);
    const minBodyHeight = Math.max(20, bodyLowestPoint + safetyMargin);

    let maxConstraint = pageHeightMm;
    if (zoneKey === 'header') {
      const footerHeight = Number.parseFloat(schema.zones.footer.minHeight || '50');
      maxConstraint = pageHeightMm - footerHeight - minBodyHeight;
    } else if (zoneKey === 'footer') {
      const headerHeight = Number.parseFloat(schema.zones.header.minHeight || '50');
      maxConstraint = pageHeightMm - headerHeight - minBodyHeight;
    }

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

      setLocalHeight(snappedHeight);
      heightRef.current = snappedHeight;
      updateZone(zoneKey, { minHeight: `${snappedHeight}mm` }, true);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      updateZone(zoneKey, { minHeight: `${heightRef.current}mm` }, false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return {
    isResizing,
    localHeight,
    handleResizeStart,
  };
}

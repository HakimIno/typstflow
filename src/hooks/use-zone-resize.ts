'use client';

import { useState, useRef, useEffect } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { ComponentNode } from '@/types/schema';

export function useZoneResize(
  zoneKey: 'header' | 'body' | 'footer',
  initialMinHeight: string,
  components: ComponentNode[]
) {
  const [isResizing, setIsResizing] = useState(false);
  const initialHeightMm = Number.parseFloat(initialMinHeight || '50');
  const [localHeight, setLocalHeight] = useState(initialHeightMm);
  const heightRef = useRef(initialHeightMm);
  
  const updateZone = useDesignerStore((state) => state.updateZone);
  const zoom = useDesignerStore((state) => state.zoom);

  // Sync with store when initialMinHeight changes externally
  useEffect(() => {
    const val = Number.parseFloat(initialMinHeight || '50');
    setLocalHeight(val);
    heightRef.current = val;
  }, [initialMinHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = Number.parseFloat(initialMinHeight || '50');

    // Calculate the minimum allowed height based on the bottom-most component
    const lowestPoint = components.reduce((max, comp) => {
      const bottom = (comp.y || 0) + (comp.height || 0);
      return Math.max(max, bottom);
    }, 0);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMm = LayoutEngine.pxToMm(deltaY / zoom);
      
      const safetyMargin = 5;
      const minConstraint = Math.max(10, lowestPoint + safetyMargin);
      
      const newHeight = Math.max(minConstraint, startHeight + deltaMm);
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
    handleResizeStart
  };
}

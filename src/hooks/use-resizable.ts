'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useCallback, useRef, useState } from 'react';

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useResizable(
  initialBounds: Bounds,
  onResizeEnd: (finalBounds: Bounds) => void,
  zoom = 1
) {
  const [localBounds, setLocalBounds] = useState<Bounds>(initialBounds);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  // High-performance track of current bounds to avoid stale closures in event listeners
  const currentBoundsRef = useRef<Bounds>(initialBounds);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(handle);

      const startX = e.clientX;
      const startY = e.clientY;

      // Snapshot of bounds at the moment resize starts
      const initX = currentBoundsRef.current.x;
      const initY = currentBoundsRef.current.y;
      const initW = currentBoundsRef.current.width;
      const initH = currentBoundsRef.current.height;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = LayoutEngine.pxToMm((moveEvent.clientX - startX) / zoom);
        const dy = LayoutEngine.pxToMm((moveEvent.clientY - startY) / zoom);

        let newX = initX;
        let newY = initY;
        let newW = initW;
        let newH = initH;

        // X-Axis Resizing
        if (handle.includes('left')) {
          const rawX = initX + dx;
          const snappedX = LayoutEngine.snap(rawX);
          const rightEdge = initX + initW;
          newX = Math.min(snappedX, rightEdge - 1);
          newW = rightEdge - newX;
        } else if (handle.includes('right')) {
          const rawRight = initX + initW + dx;
          const snappedRight = LayoutEngine.snap(rawRight);
          newW = Math.max(1, snappedRight - initX);
        }

        // Y-Axis Resizing
        if (handle.includes('top')) {
          const rawY = initY + dy;
          const snappedY = LayoutEngine.snap(rawY);
          const bottomEdge = initY + initH;
          newY = Math.min(snappedY, bottomEdge - 1);
          newH = bottomEdge - newY;
        } else if (handle.includes('bottom')) {
          const rawBottom = initY + initH + dy;
          const snappedBottom = LayoutEngine.snap(rawBottom);
          newH = Math.max(1, snappedBottom - initY);
        }

        const nextBounds = { x: newX, y: newY, width: newW, height: newH };

        // Update Ref synchronously for precision
        currentBoundsRef.current = nextBounds;

        // Update state for UI feedback
        setLocalBounds(nextBounds);
      };

      const onMouseUp = () => {
        // Commit the VERY LATEST bounds from the Ref
        onResizeEnd(currentBoundsRef.current);

        setIsResizing(null);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [onResizeEnd]
  );

  // Sync with prop changes when not actively resizing
  const syncBounds = useCallback(
    (newBounds: Bounds) => {
      if (!isResizing) {
        setLocalBounds(newBounds);
        currentBoundsRef.current = newBounds;
      }
    },
    [isResizing]
  );

  return {
    localBounds,
    isResizing,
    handleResizeStart,
    syncBounds,
  };
}

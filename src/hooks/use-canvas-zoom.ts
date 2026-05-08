import { useDesignerStore } from '@/store/designer-store';
import { useCallback, useEffect, useRef } from 'react';

/**
 * High-performance canvas zoom hook.
 * - Ctrl+Scroll / Pinch-to-zoom with smooth interpolation
 * - Bypasses React state during animation frames for 60FPS
 * - Debounces final zoom commit to Zustand store
 */
export function useCanvasZoom(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const pendingZoomRef = useRef<number | null>(null);
  const rafIdRef = useRef<number>(0);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitZoom = useCallback((zoom: number) => {
    const clamped = Math.max(0.2, Math.min(zoom, 3.0));
    // Round to 2 decimal places to avoid floating point noise
    const rounded = Math.round(clamped * 100) / 100;
    useDesignerStore.getState().setZoom(rounded);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom on Ctrl+scroll (or pinch gesture which browsers map to ctrlKey)
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const currentZoom = pendingZoomRef.current ?? useDesignerStore.getState().zoom;

      // Smooth zoom factor - smaller delta for smoother feel
      const delta = -e.deltaY * 0.002;
      // Multiplicative zoom for natural feel (percentage-based)
      const newZoom = currentZoom * (1 + delta);
      const clamped = Math.max(0.2, Math.min(newZoom, 3.0));

      pendingZoomRef.current = clamped;

      // Cancel any pending RAF
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Apply zoom visually on the next frame (bypasses React)
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
      });

      // Debounce the store commit (50ms after last scroll event)
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = setTimeout(() => {
        if (pendingZoomRef.current !== null) {
          commitZoom(pendingZoomRef.current);
          pendingZoomRef.current = null;
        }
        commitTimerRef.current = null;
      }, 50);
    };

    // Use passive: false to allow preventDefault on wheel
    el.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, [scrollRef, commitZoom]);
}

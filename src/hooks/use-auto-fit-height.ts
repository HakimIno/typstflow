'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Keeps a component's stored height in sync with its real rendered content
 * height, mirroring the pattern used for text/table components. Without this,
 * the canvas box stays at whatever the palette template guessed while the
 * compiled Typst output sizes to the real content, causing a visible
 * canvas/PDF mismatch.
 */
export function useAutoFitHeight(ref: RefObject<HTMLElement | null>, componentId: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const heightPx = entry.contentRect.height;
      if (heightPx <= 0) return;
      const heightMm = Math.round(LayoutEngine.pxToMm(heightPx) * 10) / 10;
      const current = useDesignerStore.getState().componentRegistry[componentId]?.height;
      if (current === undefined || Math.abs(heightMm - current) > 0.3) {
        // Derived auto-fit value — skipHistory so it never pushes a junk
        // undo/redo entry after every real edit.
        useDesignerStore.getState().updateComponent(componentId, { height: heightMm }, true);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, componentId]);
}

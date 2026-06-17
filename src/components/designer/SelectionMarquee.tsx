'use client';

import { useDesignerStore } from '@/store/designer-store';
import { memo, useEffect, useRef, useState } from 'react';

export const SelectionMarquee = memo(function SelectionMarquee({
  pageId,
}: {
  pageId?: string;
}) {
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const zoom = useDesignerStore((state) => state.zoom);
  const selectComponentsByIds = useDesignerStore((state) => state.selectComponentsByIds);
  const clearSelection = useDesignerStore((state) => state.clearSelection);

  // Refs for mutable values accessed inside event handlers
  const zoomRef = useRef(zoom);
  const selectRef = useRef(selectComponentsByIds);
  const clearRef = useRef(clearSelection);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    selectRef.current = selectComponentsByIds;
  }, [selectComponentsByIds]);
  useEffect(() => {
    clearRef.current = clearSelection;
  }, [clearSelection]);

  useEffect(() => {
    const selector = pageId
      ? `[data-paper-container][data-page-id="${pageId}"]`
      : '[data-paper-container]';

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const paper = document.querySelector(selector) as HTMLElement;
      if (!paper) return;

      const isInsidePaper = paper.contains(target);
      const isComponent =
        target.closest('[data-designer-component]') || target.closest('[data-drag-handle]');
      const isToolbar = target.closest('[data-toolbar]');

      if (!isInsidePaper || isComponent || isToolbar || e.button !== 0) return;

      const currentZoom = zoomRef.current;
      const rect = paper.getBoundingClientRect();

      const startX = (e.clientX - rect.left) / currentZoom;
      const startY = (e.clientY - rect.top) / currentZoom;

      setStartPos({ x: startX, y: startY });
      setCurrentPos({ x: startX, y: startY });

      const additive = e.shiftKey;
      if (!additive) clearRef.current();

      // Anchor in client (screen) space — selection is hit-tested against real
      // rendered rects, so it works for flow zones (flex-stacked, where schema
      // x/y don't match the visual) as well as absolute zones.
      const startClientX = e.clientX;
      const startClientY = e.clientY;

      // ✅ Add handlers immediately (not in useEffect) to avoid missing events
      // between React re-render and next paint.
      let curX = startX;
      let curY = startY;
      let pendingClientX = e.clientX;
      let pendingClientY = e.clientY;
      let moveRafId: number | null = null;

      const flushMove = () => {
        const z = zoomRef.current;
        const r = paper.getBoundingClientRect();
        curX = (pendingClientX - r.left) / z;
        curY = (pendingClientY - r.top) / z;
        setCurrentPos({ x: curX, y: curY });
      };

      const handleMouseMove = (me: MouseEvent) => {
        pendingClientX = me.clientX;
        pendingClientY = me.clientY;
        // Batch DOM reads to one per animation frame — avoids forced reflow on every mousemove
        if (moveRafId !== null) return;
        moveRafId = requestAnimationFrame(() => {
          moveRafId = null;
          flushMove();
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        // Flush any pending move so curX/curY are up-to-date before computing selection rect
        if (moveRafId !== null) {
          cancelAnimationFrame(moveRafId);
          moveRafId = null;
          flushMove();
        }

        // Marquee bounds in client (screen) space.
        const mLeft = Math.min(startClientX, pendingClientX);
        const mRight = Math.max(startClientX, pendingClientX);
        const mTop = Math.min(startClientY, pendingClientY);
        const mBottom = Math.max(startClientY, pendingClientY);

        // Hit-test against every rendered component inside this paper using its
        // actual bounding box — immune to flow vs absolute layout differences.
        const ids: string[] = [];
        const els = paper.querySelectorAll<HTMLElement>(
          '[data-designer-component][data-component-id]'
        );
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const intersects =
            r.left < mRight && r.right > mLeft && r.top < mBottom && r.bottom > mTop;
          if (intersects) {
            const id = el.getAttribute('data-component-id');
            if (id) ids.push(id);
          }
        }

        selectRef.current([...new Set(ids)], additive);

        // A real drag just happened. The browser fires a trailing `click` on the
        // zone background, whose handler (Zone.handleZoneClick) calls clearSelection()
        // and would instantly wipe the marquee selection. Swallow that one click
        // in the capture phase so it never reaches the zone's React onClick.
        const moved =
          Math.abs(pendingClientX - startClientX) + Math.abs(pendingClientY - startClientY) > 3;
        if (moved) {
          const swallowClick = (ce: MouseEvent) => {
            ce.stopPropagation();
            window.removeEventListener('click', swallowClick, true);
          };
          window.addEventListener('click', swallowClick, true);
        }

        setStartPos(null);
        setCurrentPos(null);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [pageId]);

  if (!startPos || !currentPos) return null;

  const left = Math.min(startPos.x, currentPos.x);
  const top = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(startPos.x - currentPos.x);
  const height = Math.abs(startPos.y - currentPos.y);

  return (
    <div
      className="absolute z-[1000] pointer-events-none transition-[border-color,background-color] bg-blue-500/10" // ใช้ bg-blue-500/10 (Tailwind)
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: '1.5px solid var(--accent)', // เปลี่ยนจาก --primary เป็น --accent
        boxShadow: '0 0 20px var(--accent-glow), inset 0 0 10px var(--accent-glow)', // เปลี่ยนเป็น --accent-glow
        backdropFilter: 'blur(0.5px)',
      }}
    >
      {/* Corner Accents - ใช้สีฟ้า blue-500 ของ Tailwind */}
      <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-[var(--accent)]" />
      <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-[var(--accent)]" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-[var(--accent)]" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-[var(--accent)]" />
    </div>
  );
});

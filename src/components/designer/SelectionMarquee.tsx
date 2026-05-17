'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
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
  const selectComponentsInRange = useDesignerStore((state) => state.selectComponentsInRange);
  const clearSelection = useDesignerStore((state) => state.clearSelection);
  const schema = useDesignerStore((state) => state.schema);

  // Refs for mutable values accessed inside event handlers
  const zoomRef = useRef(zoom);
  const schemaRef = useRef(schema);
  const selectRef = useRef(selectComponentsInRange);
  const clearRef = useRef(clearSelection);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    schemaRef.current = schema;
  }, [schema]);
  useEffect(() => {
    selectRef.current = selectComponentsInRange;
  }, [selectComponentsInRange]);
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

      if (!e.shiftKey) clearRef.current();

      // ✅ Add handlers immediately (not in useEffect) to avoid missing events
      // between React re-render and next paint.
      let curX = startX;
      let curY = startY;

      const handleMouseMove = (me: MouseEvent) => {
        const z = zoomRef.current;
        const r = paper.getBoundingClientRect();
        curX = (me.clientX - r.left) / z;
        curY = (me.clientY - r.top) / z;
        setCurrentPos({ x: curX, y: curY });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        const x = Math.min(startX, curX);
        const y = Math.min(startY, curY);
        const width = Math.abs(startX - curX);
        const height = Math.abs(startY - curY);

        const rectMm = {
          x: LayoutEngine.pxToMm(x),
          y: LayoutEngine.pxToMm(y),
          width: LayoutEngine.pxToMm(width),
          height: LayoutEngine.pxToMm(height),
        };

        // ✅ Use calculateZoneOffset so header/footer visibility per page is
        // respected (hidden header on page 2+ has offset 0, not header minHeight).
        const currentSchema = schemaRef.current;
        for (const zoneKey of ['header', 'body', 'footer'] as const) {
          const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, currentSchema, pageId);
          selectRef.current({ ...rectMm, y: rectMm.y - zoneOffset }, zoneKey, pageId);
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

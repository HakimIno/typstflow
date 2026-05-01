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

  const [isSelecting, setIsSelecting] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPosRef = useRef<{ x: number; y: number } | null>(null);
  const paperRectRef = useRef<DOMRect | null>(null);

  // 1. Handle Start of Selection (Stable Listener)
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

      const rect = paper.getBoundingClientRect();
      paperRectRef.current = rect;

      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      startPosRef.current = { x, y };
      currentPosRef.current = { x, y };
      setStartPos({ x, y });
      setCurrentPos({ x, y });
      setIsSelecting(true);

      if (!e.shiftKey) clearSelection();
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [pageId, zoom, clearSelection]);

  // 2. Handle Active Selection (Dynamic Listeners)
  useEffect(() => {
    if (!isSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = paperRectRef.current;
      if (!rect) return;

      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      currentPosRef.current = { x, y };
      setCurrentPos({ x, y });
    };

    const handleMouseUp = () => {
      const start = startPosRef.current;
      const current = currentPosRef.current;

      if (start && current) {
        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const width = Math.abs(start.x - current.x);
        const height = Math.abs(start.y - current.y);

        const rectMm = {
          x: LayoutEngine.pxToMm(x),
          y: LayoutEngine.pxToMm(y),
          width: LayoutEngine.pxToMm(width),
          height: LayoutEngine.pxToMm(height),
        };

        let zoneOffsetPx = 0;
        for (const zoneKey of ['header', 'body', 'footer'] as const) {
          let zoneHeightMm = 0;
          if (zoneKey === 'body') {
            const page = schema.pages.find((p) => p.id === pageId);
            zoneHeightMm = Number.parseFloat(page?.body.minHeight || '0');
          } else {
            zoneHeightMm = Number.parseFloat(schema.zones[zoneKey].minHeight || '0');
          }

          selectComponentsInRange(
            {
              ...rectMm,
              y: rectMm.y - LayoutEngine.pxToMm(zoneOffsetPx),
            },
            zoneKey,
            pageId
          );

          zoneOffsetPx += LayoutEngine.mmToPx(zoneHeightMm);
        }
      }

      setIsSelecting(false);
      setStartPos(null);
      setCurrentPos(null);
      startPosRef.current = null;
      currentPosRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, zoom, pageId, schema, selectComponentsInRange]);

  if (!startPos || !currentPos) return null;

  const left = Math.min(startPos.x, currentPos.x);
  const top = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(startPos.x - currentPos.x);
  const height = Math.abs(startPos.y - currentPos.y);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: '1px dashed var(--accent)',
        backgroundColor: 'var(--accent-glow)',
        opacity: 0.3,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    />
  );
});

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { memo, useEffect, useState } from 'react';

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

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // Only start if clicking on paper container background or zone background
      const target = e.target as HTMLElement;

      // Check if we clicked on the paper or its children but NOT on a component/handle
      const selector = pageId
        ? `[data-paper-container][data-page-id="${pageId}"]`
        : '[data-paper-container]';
      const paper = document.querySelector(selector) as HTMLElement;
      if (!paper) return;

      const isInsidePaper = paper.contains(target);
      const isComponent =
        target.closest('[data-designer-component]') || target.closest('[data-drag-handle]');
      const isToolbar = target.closest('[data-toolbar]');

      if (!isInsidePaper || isComponent || isToolbar || e.button !== 0) return;

      const rect = paper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      setStartPos({ x, y });
      setCurrentPos({ x, y });

      if (!e.shiftKey) clearSelection();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPos) return;

      const selector = pageId
        ? `[data-paper-container][data-page-id="${pageId}"]`
        : '[data-paper-container]';
      const paper = document.querySelector(selector) as HTMLElement;
      if (!paper) return;

      const rect = paper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      setCurrentPos({ x, y });
    };

    const handleMouseUp = () => {
      if (startPos && currentPos) {
        const x = Math.min(startPos.x, currentPos.x);
        const y = Math.min(startPos.y, currentPos.y);
        const width = Math.abs(startPos.x - currentPos.x);
        const height = Math.abs(startPos.y - currentPos.y);

        // Convert PX to MM for collision detection
        const rectMm = {
          x: LayoutEngine.pxToMm(x),
          y: LayoutEngine.pxToMm(y),
          width: LayoutEngine.pxToMm(width),
          height: LayoutEngine.pxToMm(height),
        };

        // For each zone, select components in range
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

      setStartPos(null);
      setCurrentPos(null);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [startPos, currentPos, zoom, selectComponentsInRange, clearSelection, schema, pageId]);

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

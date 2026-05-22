'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { useDesignerStore } from '@/store/designer-store';
import { memo, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

const DRAG_THRESHOLD_PX = 3;

/**
 * Persistent ruler guides (page-local mm).
 * Drag to reposition · double-click to remove.
 */
export const ManualGuides = memo(function ManualGuides() {
  const { vertical, horizontal, removeManualGuide, moveManualGuide } = useDesignerStore(
    useShallow((s) => ({
      vertical: s.manualGuides.vertical,
      horizontal: s.manualGuides.horizontal,
      removeManualGuide: s.removeManualGuide,
      moveManualGuide: s.moveManualGuide,
    }))
  );

  const dragRef = useRef<{
    axis: 'vertical' | 'horizontal';
    from: number;
    startX: number;
    startY: number;
    moved: boolean;
    currentValue: number;
  } | null>(null);
  /** pointerup clears dragRef before dblclick — keep flag to ignore click-after-drag */
  const suppressDblClickRef = useRef(false);

  const handlePointerDown = useCallback(
    (axis: 'vertical' | 'horizontal', valueMm: number, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        axis,
        from: valueMm,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        currentValue: valueMm,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (
      !drag.moved &&
      Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX &&
      Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD_PX
    ) {
      return;
    }
    drag.moved = true;

    const paper = (e.currentTarget as HTMLElement).closest('[data-paper-container]') as HTMLElement;
    if (!paper) return;

    const rect = paper.getBoundingClientRect();
    const zoom = Number.parseFloat(paper.dataset.zoom || '1');
    const { schema } = useDesignerStore.getState();
    const { width, height } = getPaperDimensions(schema.page.size, schema.page.orientation);

    if (drag.axis === 'vertical') {
      const mm = LayoutEngine.snap(LayoutEngine.pxToMm((e.clientX - rect.left) / zoom), 1);
      const clamped = Math.max(0, Math.min(width, mm));
      const el = e.currentTarget as HTMLElement;
      el.style.left = `${LayoutEngine.mmToPx(clamped)}px`;
      drag.currentValue = clamped;
    } else {
      const mm = LayoutEngine.snap(LayoutEngine.pxToMm((e.clientY - rect.top) / zoom), 1);
      const clamped = Math.max(0, Math.min(height, mm));
      const el = e.currentTarget as HTMLElement;
      el.style.top = `${LayoutEngine.mmToPx(clamped)}px`;
      drag.currentValue = clamped;
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.moved) {
        suppressDblClickRef.current = true;
        moveManualGuide(drag.axis, drag.from, drag.currentValue);
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_err) {}
      dragRef.current = null;
    },
    [moveManualGuide]
  );

  const handleDoubleClick = useCallback(
    (axis: 'vertical' | 'horizontal', valueMm: number, e: React.MouseEvent) => {
      if (suppressDblClickRef.current) {
        suppressDblClickRef.current = false;
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      removeManualGuide(axis, valueMm);
    },
    [removeManualGuide]
  );

  if (vertical.length === 0 && horizontal.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[38] overflow-visible">
      {vertical.map((x) => (
        <div
          key={`mg-v-${x}`}
          role="presentation"
          title="Drag to move · double-click to remove"
          className="absolute top-0 bottom-0 pointer-events-auto"
          style={{
            left: `${LayoutEngine.mmToPx(x)}px`,
            width: '6px',
            marginLeft: '-3px',
            cursor: 'col-resize',
          }}
          onPointerDown={(e) => handlePointerDown('vertical', x, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => handleDoubleClick('vertical', x, e)}
        >
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{ width: '1px' }}
          />
        </div>
      ))}

      {horizontal.map((y) => (
        <div
          key={`mg-h-${y}`}
          role="presentation"
          title="Drag to move · double-click to remove"
          className="absolute left-0 right-0 pointer-events-auto"
          style={{
            top: `${LayoutEngine.mmToPx(y)}px`,
            height: '6px',
            marginTop: '-3px',
            cursor: 'row-resize',
          }}
          onPointerDown={(e) => handlePointerDown('horizontal', y, e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={(e) => handleDoubleClick('horizontal', y, e)}
        >
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
            style={{ height: '1px' }}
          />
        </div>
      ))}
    </div>
  );
});

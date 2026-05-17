'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

function resolveColumnIndex(
  cursorClientY: number,
  columnEl: HTMLElement,
  zoom: number
): number {
  const rect = columnEl.getBoundingClientRect();
  const cursorRelYMm = LayoutEngine.pxToMm((cursorClientY - rect.top) / zoom);
  
  const domEls = Array.from(columnEl.querySelectorAll<HTMLElement>('[data-designer-component]'));
  
  let cumulativeY = 0;
  for (let i = 0; i < domEls.length; i++) {
    const domEl = domEls[i];
    const heightPx = domEl.getBoundingClientRect().height / zoom;
    const heightMm = LayoutEngine.pxToMm(heightPx);
    
    const midPoint = cumulativeY + heightMm / 2;
    if (cursorRelYMm < midPoint) {
      return i;
    }
    cumulativeY += heightMm;
  }
  return domEls.length;
}

export function useColumnDropTarget(
  columnLayoutId: string,
  colIndex: number
) {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const addComponentToColumn = useDesignerStore((state) => state.addComponentToColumn);
  const moveComponentToColumn = useDesignerStore((state) => state.moveComponentToColumn);
  const zoom = useDesignerStore((state) => state.zoom);

  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!element) return;

    return dropTargetForElements({
      element,
      getData: () => ({ type: 'column-slot', parentId: columnLayoutId, colIndex }),
      canDrop: () => true,
      onDragEnter: () => {
        setIsDraggedOver(true);
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
      },
      onDrop: ({ location, source }) => {
        setIsDraggedOver(false);
        if (!location.current) return;

        const data = source.data as any;
        const targetIndex = resolveColumnIndex(
          location.current.input.clientY,
          element,
          zoom
        );

        if (data.type === 'new-component') {
          addComponentToColumn(
            columnLayoutId,
            colIndex,
            {
              ...data.component,
              x: 0,
              y: 0,
            },
            targetIndex
          );
        } else if (data.id) {
          // Prevent dropping a component inside itself or inside its own children recursive loop
          if (data.id === columnLayoutId) return;

          moveComponentToColumn(
            data.id,
            columnLayoutId,
            colIndex,
            targetIndex
          );
        }
      },
    });
  }, [columnLayoutId, colIndex, zoom, addComponentToColumn, moveComponentToColumn, element]);

  return { isDraggedOver, ref: setElement };
}

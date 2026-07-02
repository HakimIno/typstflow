'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

function resolveInsertIndex(cursorClientY: number, containerEl: HTMLElement, zoom: number): number {
  const rect = containerEl.getBoundingClientRect();
  const cursorRelYMm = LayoutEngine.pxToMm((cursorClientY - rect.top) / zoom);

  const domEls = Array.from(containerEl.querySelectorAll<HTMLElement>('[data-designer-component]'));

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

export function useFormBoxDropTarget(formBoxId: string) {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const addComponentToFormBox = useDesignerStore((state) => state.addComponentToFormBox);
  const moveComponentToFormBox = useDesignerStore((state) => state.moveComponentToFormBox);
  const zoom = useDesignerStore((state) => state.zoom);

  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!element) return;

    return dropTargetForElements({
      element,
      getData: () => ({ type: 'form-box-slot', parentId: formBoxId }),
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

        const data = source.data as { type?: string; id?: string; component?: Record<string, unknown> };
        const targetIndex = resolveInsertIndex(location.current.input.clientY, element, zoom);

        if (data.type === 'new-component' && data.component) {
          addComponentToFormBox(
            formBoxId,
            {
              ...data.component,
              x: 0,
              y: 0,
            },
            targetIndex
          );
        } else if (data.id) {
          if (data.id === formBoxId) return;
          moveComponentToFormBox(data.id, formBoxId, targetIndex);
        }
      },
    });
  }, [formBoxId, zoom, addComponentToFormBox, moveComponentToFormBox, element]);

  return { isDraggedOver, ref: setElement };
}

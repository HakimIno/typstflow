'use client';

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefObject, useEffect, useState } from 'react';

interface DraggableOptions {
  id: string;
  zoneKey: string;
  ref: RefObject<HTMLDivElement | null>;
  dragHandleRef?: RefObject<HTMLDivElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({
  id,
  zoneKey,
  ref,
  dragHandleRef,
  onDragStart,
  onDragEnd,
}: DraggableOptions) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      dragHandle: dragHandleRef?.current || undefined,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        return {
          type: 'canvas-item',
          id,
          zoneKey,
          dragOffsetX: input.clientX - rect.left,
          dragOffsetY: input.clientY - rect.top,
        };
      },
      onDragStart: () => {
        setIsDragging(true);
        onDragStart?.();
      },
      onDrop: () => {
        setIsDragging(false);
        onDragEnd?.();
      },
    });
  }, [id, zoneKey, ref, dragHandleRef, onDragStart, onDragEnd]);

  return { isDragging };
}

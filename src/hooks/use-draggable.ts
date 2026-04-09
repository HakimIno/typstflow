'use client';

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { type RefObject, useEffect, useState } from 'react';

interface DraggableOptions {
  id: string;
  zoneKey: string;
  ref: RefObject<HTMLDivElement | null>;
  dragHandleRef?: RefObject<HTMLDivElement | null>;
  previewRef?: RefObject<HTMLDivElement | null>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({
  id,
  zoneKey,
  ref,
  dragHandleRef,
  previewRef,
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
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        const previewEl = previewRef?.current;
        if (previewEl) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            render: ({ container }) => {
              // Creating a simple clean clone for the preview
              const clone = previewEl.cloneNode(true) as HTMLDivElement;
              clone.style.width = `${previewEl.offsetWidth}px`;
              clone.style.height = `${previewEl.offsetHeight}px`;
              clone.style.opacity = '0.8';
              clone.style.backgroundColor = 'white';
              clone.style.border = '1px solid #2563eb';
              clone.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
              container.appendChild(clone);
            },
          });
        }
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
  }, [id, zoneKey, ref, dragHandleRef, previewRef, onDragStart, onDragEnd]);

  return { isDragging };
}

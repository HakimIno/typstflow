'use client';

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { type RefObject, useEffect, useRef, useState } from 'react';

interface DraggableOptions {
  id: string;
  zoneKey: string;
  width: number;
  height: number;
  ref: RefObject<HTMLDivElement | null>;
  dragHandleRef?: RefObject<HTMLDivElement | null>;
  previewRef?: RefObject<HTMLDivElement | null>;
  isSelected?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({
  id,
  zoneKey,
  width,
  height,
  ref,
  dragHandleRef,
  previewRef,
  isSelected,
  onDragStart,
  onDragEnd,
}: DraggableOptions) {
  const [isDragging, setIsDragging] = useState(false);
  
  // Use a ref for dimensions to avoid re-registering draggable during resizing
  const dimensionsRef = useRef({ width, height });
  useEffect(() => {
    dimensionsRef.current = { width, height };
  }, [width, height]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // The drag handle might only appear when isSelected is true
    const handle = dragHandleRef?.current || undefined;

    return draggable({
      element: el,
      dragHandle: handle,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        return {
          type: 'canvas-item',
          id,
          zoneKey,
          width: dimensionsRef.current.width,
          height: dimensionsRef.current.height,
          dragOffsetX: input.clientX - rect.left,
          dragOffsetY: input.clientY - rect.top,
        };
      },
      onGenerateDragPreview: ({ nativeSetDragImage, source }) => {
        const sourceEl = ref.current;
        const data = source.data as any;
        if (sourceEl && data.dragOffsetX !== undefined) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: () => ({ x: data.dragOffsetX, y: data.dragOffsetY }),
            render: ({ container }) => {
              // Create a literal clone of the actual element as it looks right now
              const clone = sourceEl.cloneNode(true) as HTMLDivElement;
              clone.style.width = `${sourceEl.offsetWidth}px`;
              clone.style.height = `${sourceEl.offsetHeight}px`;
              clone.style.opacity = '0.7';
              clone.style.backgroundColor = 'white';
              clone.style.position = 'relative'; 
              clone.style.top = '0';
              clone.style.left = '0';
              clone.style.margin = '0';
              clone.style.pointerEvents = 'none';
              clone.style.transform = 'none'; // Ensure no existing transforms affect it
              
              // Remove interactive elements from preview
              const actionBar = clone.querySelector('.absolute.-top-7');
              if (actionBar) actionBar.remove();
              
              // Hide resize handles in preview (using robust class matches)
              const handles = clone.querySelectorAll('[class*="cursor-"]');
              handles.forEach(h => (h as HTMLElement).remove());
              
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
  }, [id, zoneKey, ref, dragHandleRef, isSelected, onDragStart, onDragEnd]);

  return { isDragging };
}

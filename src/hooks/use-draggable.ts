'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { type RefObject, useEffect, useState } from 'react';

interface DraggableOptions {
  id: string;
  zoneKey: string;
  ref: RefObject<HTMLDivElement | null>;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDraggable({ id, zoneKey, ref, disabled, onDragStart, onDragEnd }: DraggableOptions) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      dragHandle: undefined, // Allow dragging from anywhere
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();

        // ALWAYS read fresh dimensions from DOM to avoid stale data
        // This is critical after resize operations
        const currentWidth = LayoutEngine.pxToMm(el.offsetWidth);
        const currentHeight = LayoutEngine.pxToMm(el.offsetHeight);

        return {
          type: 'canvas-item',
          id,
          zoneKey,
          width: currentWidth,
          height: currentHeight,
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
              for (const h of handles) {
                (h as HTMLElement).remove();
              }

              container.appendChild(clone);
            },
          });
        }
      },
      onDragStart: () => {
        // UX: Allow dragging from anywhere within the element
        // User can drag by holding anywhere on the component
        setIsDragging(true);
        onDragStart?.();
      },
      onDrop: () => {
        setIsDragging(false);
        onDragEnd?.();
      },
    });
  }, [id, zoneKey, ref, disabled, onDragStart, onDragEnd]);

  return { isDragging };
}

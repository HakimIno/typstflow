'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
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

/**
 * useDraggable hook handles the interaction side of dragging.
 * It manages the drag handle, initial data, and custom drag preview.
 * The global DragMonitor handles the real-time position tracking and snapping.
 */
export function useDraggable({ id, zoneKey, ref, disabled, onDragStart, onDragEnd }: DraggableOptions) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        const state = useDesignerStore.getState();
        const selectedIds = state.selectedComponentIds;
        
        // If the item being dragged is selected, we move the whole selection
        const isPartOfSelection = selectedIds.includes(id);
        const dragGroup = isPartOfSelection ? selectedIds : [id];
        
        // Calculate relative offsets for everyone in the group
        const zones = state.schema.zones;
        const groupInfo = dragGroup.map(gid => {
          // Find component and its zone
          for (const [zKey, zone] of Object.entries(zones)) {
            const found = zone.components.find(c => c.id === gid);
            if (found) {
              return { 
                id: gid, 
                x: found.x || 0, 
                y: found.y || 0, 
                zoneKey: zKey as string,
                // Calculate absolute Y for easier relative math across zones
                absY: (found.y || 0) + LayoutEngine.pxToMm(LayoutEngine.calculateZoneOffset(zKey as any, state.schema))
              };
            }
          }
          return null;
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        const primaryComp = groupInfo.find(c => c.id === id);
        const groupWithOffsets = groupInfo.map(c => ({
          id: c.id,
          sourceZoneKey: c.zoneKey,
          offsetX: c.x - (primaryComp?.x || 0),
          offsetY: c.absY - (primaryComp?.absY || 0)
        }));

        return {
          type: 'canvas-item',
          id,
          zoneKey,
          width: LayoutEngine.pxToMm(el.offsetWidth),
          height: LayoutEngine.pxToMm(el.offsetHeight),
          dragOffsetX: input.clientX - rect.left,
          dragOffsetY: input.clientY - rect.top,
          group: groupWithOffsets
        };
      },
      onGenerateDragPreview: ({ nativeSetDragImage, source }) => {
        const data = source.data as any;
        if (data.dragOffsetX !== undefined) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: () => ({ x: data.dragOffsetX, y: data.dragOffsetY }),
            render: ({ container }) => {
              const ghost = document.createElement('div');
              ghost.style.width = '1px';
              ghost.style.height = '1px';
              ghost.style.opacity = '0';
              container.appendChild(ghost);
            },
          });
        }
      },
      onDragStart: () => {
        setIsDragging(true);
        onDragStart?.();
        
        useDesignerStore.getState().setDragState({
            isDragging: true,
            draggedComponentId: id,
            activeGuides: { vertical: [], horizontal: [] }
        });
      },
      onDrop: () => {
        setIsDragging(false);
        onDragEnd?.();
        
        useDesignerStore.getState().setDragState({
            isDragging: false,
            draggedComponentId: null,
            activeGuides: { vertical: [], horizontal: [] }
        });
      },
    });
  }, [id, zoneKey, ref, disabled, onDragStart, onDragEnd]);

  return { isDragging };
}

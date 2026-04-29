'use client';

import { useState, useEffect, useRef } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';

export function useZoneDropTarget(
  zoneKey: 'header' | 'body' | 'footer',
  contentRef: React.RefObject<HTMLDivElement | null>
) {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const addComponent = useDesignerStore((state) => state.addComponent);
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const setDragState = useDesignerStore((state) => state.setDragState);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ zoneKey }),
      onDragEnter: ({ source }) => {
        setIsDraggedOver(true);
        
        // Real-time Zone Switching for Layers Panel
        const data = source.data as any;
        if (data.id && data.zoneKey !== zoneKey) {
          const state = useDesignerStore.getState();
          const finalX = state.dragState.lastSnappedX;
          const finalY = state.dragState.lastSnappedY;
          const zoneOffsetMm = LayoutEngine.calculateZoneOffset(zoneKey, state.schema);
          
          if (data.group && data.group.length > 1) {
            data.group.forEach((item: any) => {
              const targetAbsY = finalY + item.offsetY;
              const localY = targetAbsY - zoneOffsetMm;
              moveComponent(item.id, data.zoneKey as any, zoneKey, -1, finalX + item.offsetX, localY, true);
            });
            setDragState({ startX: finalX, startY: finalY });
          } else {
            moveComponent(data.id, data.zoneKey as any, zoneKey, -1, finalX, finalY - zoneOffsetMm, true);
            setDragState({ startX: finalX, startY: finalY });
          }
          
          data.zoneKey = zoneKey;
        }
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
      },
      onDrop: ({ location, source }) => {
        setIsDraggedOver(false);
        if (!location.current) return;

        const state = useDesignerStore.getState();
        const data = source.data as any;
        const finalX = state.dragState.lastSnappedX;
        const finalY = state.dragState.lastSnappedY;
        const zoneOffsetMm = LayoutEngine.calculateZoneOffset(zoneKey, state.schema);

        if (data.type === 'new-component') {
          addComponent(zoneKey, {
            ...data.component,
            id: Math.random().toString(36).substring(7),
            x: finalX,
            y: finalY - zoneOffsetMm,
          });
        } else if (data.id) {
          // Commit to history
          if (data.group && data.group.length > 1) {
            data.group.forEach((item: any) => {
              const targetAbsY = finalY + item.offsetY;
              const localY = targetAbsY - zoneOffsetMm;
              moveComponent(item.id, data.zoneKey as any, zoneKey, -1, finalX + item.offsetX, localY, false);
            });
          } else {
            moveComponent(data.id, data.zoneKey as any, zoneKey, -1, finalX, finalY - zoneOffsetMm, false);
          }
        }
      },
    });
  }, [zoneKey, addComponent, moveComponent, setDragState]);

  return { isDraggedOver };
}

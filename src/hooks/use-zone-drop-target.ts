'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

export function useZoneDropTarget(
  zoneKey: 'header' | 'body' | 'footer',
  contentRef: React.RefObject<HTMLDivElement | null>,
  pageId?: string
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
      getData: () => ({ zoneKey, pageId }),
      onDragEnter: ({ source }) => {
        setIsDraggedOver(true);

        // Real-time Zone Switching for Layers Panel
        const data = source.data as any;
        if (data.id && (data.zoneKey !== zoneKey || data.pageId !== pageId)) {
          const state = useDesignerStore.getState();
          const finalX = state.dragState.lastSnappedX;
          const finalY = state.dragState.lastSnappedY;
          const zoneOffsetMm = LayoutEngine.calculateZoneOffset(zoneKey, state.schema, pageId);

          if (data.group && data.group.length > 1) {
            for (const item of data.group as any[]) {
              const targetAbsY = finalY + item.offsetY;
              const localY = targetAbsY - zoneOffsetMm;
              moveComponent(
                item.id,
                data.zoneKey as any,
                zoneKey,
                -1,
                finalX + item.offsetX,
                localY,
                data.pageId,
                pageId,
                true
              );
            }
            setDragState({ startX: finalX, startY: finalY });
          } else {
            moveComponent(
              data.id,
              data.zoneKey as any,
              zoneKey,
              -1,
              finalX,
              finalY - zoneOffsetMm,
              data.pageId,
              pageId,
              true
            );
            setDragState({ startX: finalX, startY: finalY });
          }

          data.zoneKey = zoneKey;
          data.pageId = pageId;
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
        const selector = pageId
          ? `[data-paper-container][data-page-id="${pageId}"]`
          : '[data-paper-container]';
        const container = document.querySelector(selector) as HTMLElement;
        const _zoom = Number.parseFloat(container?.dataset.zoom || '1');
        const finalX = state.dragState.lastSnappedX;
        const finalY = state.dragState.lastSnappedY;
        const zoneOffsetMm = LayoutEngine.calculateZoneOffset(zoneKey, state.schema, pageId);

        if (data.type === 'new-component') {
          addComponent(
            zoneKey,
            {
              ...data.component,
              id: Math.random().toString(36).substring(7),
              x: finalX,
              y: finalY - zoneOffsetMm,
            },
            pageId
          );
        } else if (data.id) {
          // Commit to history
          if (data.group && data.group.length > 1) {
            for (const item of data.group as any[]) {
              const targetAbsY = finalY + item.offsetY;
              const localY = targetAbsY - zoneOffsetMm;
              moveComponent(
                item.id,
                data.zoneKey as any,
                zoneKey,
                -1,
                finalX + item.offsetX,
                localY,
                data.pageId,
                pageId,
                false
              );
            }
          } else {
            moveComponent(
              data.id,
              data.zoneKey as any,
              zoneKey,
              -1,
              finalX,
              finalY - zoneOffsetMm,
              data.pageId,
              pageId,
              false
            );
          }
        }
      },
    });
  }, [zoneKey, pageId, addComponent, moveComponent, setDragState, contentRef]);

  return { isDraggedOver };
}

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

export function useZoneDropTarget(
  zoneKey: 'header' | 'body' | 'footer',
  contentRef: React.RefObject<HTMLDivElement | null>,
  pageId?: string,
  groupId?: string,
  groupType?: 'header' | 'footer'
) {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const addComponent = useDesignerStore((state) => state.addComponent);
  const moveComponent = useDesignerStore((state) => state.moveComponent);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ zoneKey, pageId, groupId, groupType }),
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

        const state = useDesignerStore.getState();
        const data = source.data as any;
        const selector = pageId
          ? `[data-paper-container][data-page-id="${pageId}"]`
          : '[data-paper-container]';
        const container = document.querySelector(selector) as HTMLElement;
        const _zoom = Number.parseFloat(container?.dataset.zoom || '1');
        const finalX = state.dragState.lastSnappedX;
        const finalY = state.dragState.lastSnappedY;
        
        // Calculate offset including group bands
        let zoneOffsetMm = LayoutEngine.calculateZoneOffset(zoneKey, state.schema, pageId);
        if (groupId && groupType) {
          // Add offset of the group band itself
          // This is a simplified version, in a real layout engine we'd calculate the exact Y of the band.
          // For now, we'll assume the offset is passed or calculated.
          // Since we render them in order in Canvas.tsx, we need a way to find their absolute Y.
          const bandEl = el.closest('[data-zone-label]'); // assuming we add this
          // Better: calculate based on heights of preceding zones
          zoneOffsetMm = LayoutEngine.calculateBandOffset(groupId, groupType, state.schema, pageId);
        }

        if (data.type === 'new-component') {
          addComponent(
            zoneKey,
            {
              ...data.component,
              id: Math.random().toString(36).substring(7),
              x: finalX,
              y: finalY - zoneOffsetMm,
            },
            pageId,
            groupId,
            groupType
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
                false,
                data.groupId,
                groupId,
                data.groupType,
                groupType
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
              false,
              data.groupId,
              groupId,
              data.groupType,
              groupType
            );
          }
        }
      },
    });
  }, [zoneKey, pageId, addComponent, moveComponent, contentRef]);

  return { isDraggedOver };
}

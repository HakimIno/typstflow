'use client';

import { dragSnapState } from '@/lib/engine/drag-snap-state';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { ZoneKey } from '@/types/schema';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

export function useZoneDropTarget(
  zoneKey: ZoneKey,
  contentRef: React.RefObject<HTMLDivElement | null>,
  pageId?: string,
  groupId?: string,
  groupType?: 'header' | 'footer',
  isFlowMode = false
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

        // ✅ Read from sync singleton — no RAF / store race.
        const snap = dragSnapState.read();
        const finalX = snap.snappedX;
        const finalY = snap.snappedY;

        // Group bands have their own offset; otherwise use cumulative zone offset.
        const zoneOffsetMm =
          groupId && groupType
            ? LayoutEngine.calculateBandOffset(groupId, groupType, state.schema, pageId)
            : LayoutEngine.calculateZoneOffset(zoneKey, state.schema, pageId);

        if (data.type === 'new-component') {
          addComponent(
            zoneKey,
            {
              ...data.component,
              id: Math.random().toString(36).substring(7),
              x: finalX,
              y: isFlowMode ? 0 : finalY - zoneOffsetMm,
            },
            pageId,
            groupId,
            groupType
          );
        } else if (data.id) {
          // Commit to history
          if (data.group && data.group.length > 1) {
            // ✅ Single batchApplyDrag call for all components — avoids N × O(pages) traversals
            const moves = (data.group as Array<{
              id: string;
              sourceZoneKey: string;
              sourcePageId: string | undefined;
              offsetX: number;
              offsetY: number;
            }>).map((item) => ({
              id: item.id,
              fromZone: (item.sourceZoneKey ?? data.zoneKey) as any,
              toZone: zoneKey,
              newIndex: -1 as const,
              x: finalX + item.offsetX,
              y: isFlowMode ? 0 : finalY + item.offsetY - zoneOffsetMm,
              fromPageId: item.sourcePageId ?? data.pageId,
              toPageId: pageId,
              fromGroupId: data.groupId,
              toGroupId: groupId,
              fromGroupType: data.groupType,
              toGroupType: groupType,
            }));
            state.moveComponents(moves, false);
          } else {
            moveComponent(
              data.id,
              data.zoneKey as any,
              zoneKey,
              -1,
              finalX,
              isFlowMode ? 0 : finalY - zoneOffsetMm,
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
  }, [zoneKey, pageId, groupId, groupType, addComponent, moveComponent, contentRef]);

  return { isDraggedOver };
}

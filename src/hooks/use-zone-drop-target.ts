'use client';

import { dragSnapState } from '@/lib/engine/drag-snap-state';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getZoneComponents } from '@/lib/utils/schema-mutators';
import { useDesignerStore } from '@/store/designer-store';
import type { ZoneKey } from '@/types/schema';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useState } from 'react';

function resolveFlowY(
  cursorClientY: number,
  zoneEl: HTMLElement,
  schema: ReturnType<typeof useDesignerStore.getState>['schema'],
  zoneKey: ZoneKey,
  pageId?: string
): number {
  const zoom = useDesignerStore.getState().zoom;
  const rect = zoneEl.getBoundingClientRect();
  // Convert cursor position to layout pixels (pre-zoom) then to mm
  const cursorRelYMm = LayoutEngine.pxToMm((cursorClientY - rect.top) / zoom);

  // Build row map using actual DOM heights when available (text auto-height in flow mode).
  // Fall back to schema height if DOM element not found.
  const components = getZoneComponents(schema, zoneKey, pageId);
  const domEls = Array.from(zoneEl.querySelectorAll<HTMLElement>('[data-designer-component]'));

  // Accumulate rows by their display order (array order = visual order in flow mode)
  let cumulativeY = 0;
  const rows: Array<{ startMm: number; heightMm: number; endMm: number }> = [];
  for (let i = 0; i < components.length; i++) {
    const domEl = domEls[i];
    const heightPx = domEl
      ? domEl.getBoundingClientRect().height / zoom // layout pixels
      : LayoutEngine.mmToPx(components[i].height ?? 10);
    const heightMm = LayoutEngine.pxToMm(heightPx);
    rows.push({ startMm: cumulativeY, heightMm, endMm: cumulativeY + heightMm });
    cumulativeY += heightMm;
  }

  // Snap to existing row if cursor lands within it → return that row's start y
  for (const row of rows) {
    if (cursorRelYMm >= row.startMm && cursorRelYMm < row.endMm) {
      return row.startMm;
    }
  }

  // Below all rows → new row after last
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (cursorRelYMm >= last.endMm) return last.endMm;
  }

  return Math.max(0, cursorRelYMm);
}

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
      onDrag: ({ location }) => {
        if (!isFlowMode) return;
        // Broadcast cursor position so Zone.tsx can highlight the correct row
        window.dispatchEvent(
          new CustomEvent('flow-drag-move', {
            detail: {
              clientX: location.current.input.clientX,
              clientY: location.current.input.clientY,
            },
          })
        );
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
        if (isFlowMode) window.dispatchEvent(new CustomEvent('flow-drag-end'));
      },
      onDrop: ({ location, source }) => {
        setIsDraggedOver(false);
        if (isFlowMode) window.dispatchEvent(new CustomEvent('flow-drag-end'));
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

        // For flow mode: snap to the row the cursor is actually over (not element top).
        const resolveY = (rawAbsY: number): number => {
          if (!isFlowMode) return rawAbsY - zoneOffsetMm;
          if (contentRef.current) {
            return resolveFlowY(
              location.current.input.clientY,
              contentRef.current,
              state.schema,
              zoneKey,
              pageId
            );
          }
          return Math.max(0, rawAbsY - zoneOffsetMm);
        };

        if (data.type === 'new-component') {
          addComponent(
            zoneKey,
            {
              ...data.component,
              id: Math.random().toString(36).substring(7),
              x: finalX,
              y: resolveY(finalY),
            },
            pageId,
            groupId,
            groupType
          );
        } else if (data.id) {
          if (data.group && data.group.length > 1) {
            const moves = (
              data.group as Array<{
                id: string;
                sourceZoneKey: string;
                sourcePageId: string | undefined;
                offsetX: number;
                offsetY: number;
              }>
            ).map((item) => ({
              id: item.id,
              fromZone: (item.sourceZoneKey ?? data.zoneKey) as any,
              toZone: zoneKey,
              newIndex: -1 as const,
              x: finalX + item.offsetX,
              y: resolveY(finalY + item.offsetY),
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
              resolveY(finalY),
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
  }, [zoneKey, pageId, groupId, groupType, isFlowMode, addComponent, moveComponent, contentRef]);

  return { isDraggedOver };
}

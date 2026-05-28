'use client';

import { dragSnapState } from '@/lib/engine/drag-snap-state';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import {
  SNAP_PAGE_RADIUS,
  calculateComponentSnap,
  getSnapPageRange,
  getWasmLayoutEngine,
  loadWasmSnapNodes,
} from '@/lib/engine/wasm-snap';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { WasmSpacingIndicator } from '@/lib/wasm-layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { memo, useEffect, useRef } from 'react';

interface PageOffset {
  id: string;
  index: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DragSourceData {
  type: 'canvas-item' | 'new-component';
  id?: string;
  zone: string;
  pageId?: string;
  width?: number;
  height?: number;
  dragOffsetX?: number;
  dragOffsetY?: number;
  component?: ComponentNode;
  group?: Array<{
    id: string;
    sourceZoneKey: string;
    sourcePageId: string | undefined;
    offsetX: number;
    offsetY: number;
  }>;
}

const SNAP_SKIP_FRAMES = 1;
const ENABLE_PERF_MONITORING = false;
const MAX_OFFSET_PAGES = 20;

const perfMetrics = {
  dragFrameCount: 0,
  snapCalcTime: 0,
  avgSnapTime: 0,
  lastLogTime: 0,
};

/**
 * Ultra-Optimized Drag Monitor for 1000+ pages
 *
 * Key optimizations:
 * 1. Only calculate offsets for nearby pages (not all 1000+)
 * 2. NO store updates during drag (CSS-only transforms)
 * 3. Frame-skipping for snap calculation
 * 4. Early exit when not moving significantly
 * 5. Direct DOM manipulation for visuals
 */
export const DragMonitor = memo(function DragMonitor() {
  const dragRef = useRef<{
    containerRect: DOMRect | null;
    containerElement: HTMLElement | null;
    zoom: number;
    pageHeightPx: number;
    pageWidthPx: number;
    pageGap: number;
    paddingTop: number;
    paddingLeft: number;
    initialClientX: number;
    initialClientY: number;
    lastSnapTime: number;
    pageOffsets: PageOffset[];
    totalPages: number;
    activePageIdx: number;
    lastRawX: number;
    lastRawY: number;
    frameCounter: number;
    lastSnapResult: {
      x: number;
      y: number;
      guidesX: number[];
      guidesY: number[];
      spacingIndicators: WasmSpacingIndicator[];
    } | null;
  }>({
    containerRect: null,
    containerElement: null,
    zoom: 1,
    pageHeightPx: 0,
    pageWidthPx: 0,
    pageGap: 32,
    paddingTop: 48,
    paddingLeft: 64,
    initialClientX: 0,
    initialClientY: 0,
    lastSnapTime: 0,
    pageOffsets: [],
    totalPages: 0,
    activePageIdx: 0,
    lastRawX: 0,
    lastRawY: 0,
    frameCounter: 0,
    lastSnapResult: null,
  });

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const data = source.data as unknown as DragSourceData;
        if (data.type !== 'canvas-item' && data.type !== 'new-component') return;

        const scrollEl = document.querySelector('[data-canvas-scroll-container]') as HTMLElement;
        if (!scrollEl) return;

        const rect = scrollEl.getBoundingClientRect();
        const container = document.querySelector('[data-paper-container]') as HTMLElement;
        if (!container) return;

        const zoom = Number.parseFloat(container.dataset.zoom || '1');
        const { schema, manualGuides } = useDesignerStore.getState();

        const { width: pW, height: pH } = getPaperDimensions(
          schema.page.size,
          schema.page.orientation
        );

        const pageHeightPx = LayoutEngine.mmToPx(pH) * zoom;
        const pageWidthPx = LayoutEngine.mmToPx(pW);
        const pageGap = 32;
        const paddingTop = 96; // pt-24 in Canvas.tsx = 96px
        const paddingLeft = 64;

        const startPageId = data.pageId || schema.pages[0]?.id || '';
        const activePageIdx = schema.pages.findIndex((p) => p.id === startPageId);

        const offsetStartIdx = Math.max(0, activePageIdx - MAX_OFFSET_PAGES);
        const offsetEndIdx = Math.min(schema.pages.length - 1, activePageIdx + MAX_OFFSET_PAGES);

        const offsets: PageOffset[] = [];
        for (let i = offsetStartIdx; i <= offsetEndIdx; i++) {
          const page = schema.pages[i];
          if (!page) continue;
          offsets.push({
            id: page.id,
            index: i,
            top: paddingTop + i * (pageHeightPx + pageGap),
            left: paddingLeft,
            width: pageWidthPx,
            height: pageHeightPx,
          });
        }

        const { pageStartIdx, pageEndIdx } = getSnapPageRange(
          Math.max(0, activePageIdx),
          schema.pages.length,
          SNAP_PAGE_RADIUS
        );

        loadWasmSnapNodes(schema, {
          excludeIds: data.id ? [data.id] : [],
          pageStartIdx,
          pageEndIdx,
          maxComponentsPerPage: 50,
          manualGuides,
          stackPages: false,
        }).catch(() => {});

        dragRef.current = {
          containerRect: rect,
          containerElement: scrollEl,
          zoom,
          pageHeightPx,
          pageWidthPx,
          pageGap,
          paddingTop,
          paddingLeft,
          initialClientX: location.initial.input.clientX,
          initialClientY: location.initial.input.clientY,
          lastSnapTime: 0,
          pageOffsets: offsets,
          totalPages: schema.pages.length,
          activePageIdx,
          lastRawX: 0,
          lastRawY: 0,
          frameCounter: 0,
          lastSnapResult: null,
        };

        document.body.classList.add('is-dragging-components');

        const root = document.documentElement;
        root.style.setProperty('--drag-dx', '0px');
        root.style.setProperty('--drag-dy', '0px');

        if (ENABLE_PERF_MONITORING) {
          perfMetrics.dragFrameCount = 0;
          perfMetrics.snapCalcTime = 0;
        }
      },
      onDrag: ({ location, source }) => {
        const cache = dragRef.current;
        if (!cache.containerRect) return;
        const data = source.data as unknown as DragSourceData;

        cache.frameCounter++;

        const scrollContainer = cache.containerElement as HTMLElement;
        const currentScrollTop = scrollContainer?.scrollTop || 0;
        const currentScrollLeft = scrollContainer?.scrollLeft || 0;
        const absoluteY =
          currentScrollTop + (location.current.input.clientY - cache.containerRect.top);
        const absoluteX =
          currentScrollLeft + (location.current.input.clientX - cache.containerRect.left);

        const activePageIdx = Math.max(
          0,
          Math.min(
            cache.totalPages - 1,
            Math.floor((absoluteY - cache.paddingTop) / (cache.pageHeightPx + cache.pageGap))
          )
        );

        const activePageInfo = cache.pageOffsets.find((o) => o.index === activePageIdx) || {
          id: `page-${activePageIdx}`,
          index: activePageIdx,
          top: cache.paddingTop + activePageIdx * (cache.pageHeightPx + cache.pageGap),
          left: cache.paddingLeft,
          width: cache.pageWidthPx,
          height: cache.pageHeightPx,
        };

        const relX = (absoluteX - activePageInfo.left - (data.dragOffsetX || 0)) / cache.zoom;
        const relY = (absoluteY - activePageInfo.top - (data.dragOffsetY || 0)) / cache.zoom;

        const rawX = LayoutEngine.pxToMm(relX);
        const rawY = LayoutEngine.pxToMm(relY);

        dragSnapState.setRaw(rawX, rawY, activePageInfo.id);

        const root = document.documentElement;
        const pxDeltaX = location.current.input.clientX - cache.initialClientX;
        const pxDeltaY = location.current.input.clientY - cache.initialClientY;

        root.style.setProperty('--drag-dx', `${pxDeltaX / cache.zoom}px`);
        root.style.setProperty('--drag-dy', `${pxDeltaY / cache.zoom}px`);

        const deltaX = rawX - cache.lastRawX;
        const deltaY = rawY - cache.lastRawY;
        const movedSignificantly = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

        cache.lastRawX = rawX;
        cache.lastRawY = rawY;

        if (!movedSignificantly && cache.lastSnapResult) {
          const snapOffsetX = LayoutEngine.mmToPx(cache.lastSnapResult.x - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(cache.lastSnapResult.y - rawY);

          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);
          updateTransientVisuals(
            cache.lastSnapResult.guidesX,
            cache.lastSnapResult.guidesY,
            cache.lastSnapResult.x,
            cache.lastSnapResult.y,
            activePageInfo,
            cache.lastSnapResult.spacingIndicators
          );
          return;
        }

        if (cache.frameCounter % SNAP_SKIP_FRAMES !== 0) {
          return;
        }

        const now = Date.now();
        if (cache.lastSnapTime && now - cache.lastSnapTime < 33) return;
        cache.lastSnapTime = now;

        const width = data.width || data.component?.width || 0;
        const height = data.height || data.component?.height || 0;

        const perfStart = performance.now();

        getWasmLayoutEngine().then((layoutEngine) => {
          const snapResult = calculateComponentSnap(
            layoutEngine,
            data.id || 'new',
            rawX,
            rawY,
            width,
            height,
            false
          );

          const snapX = snapResult.snappedX;
          const snapY = snapResult.snappedY;
          const activeGuidesX = snapResult.activeGuidesX;
          const activeGuidesY = snapResult.activeGuidesY;
          const spacingIndicators = snapResult.spacingIndicators;

          cache.lastSnapResult = {
            x: snapX,
            y: snapY,
            guidesX: activeGuidesX,
            guidesY: activeGuidesY,
            spacingIndicators,
          };

          dragSnapState.setSnapped(snapX, snapY);

          const snapOffsetX = LayoutEngine.mmToPx(snapX - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(snapY - rawY);

          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);

          updateTransientVisuals(
            activeGuidesX,
            activeGuidesY,
            snapX,
            snapY,
            activePageInfo,
            spacingIndicators
          );

          if (ENABLE_PERF_MONITORING) {
            const perfEnd = performance.now();
            const calcTime = perfEnd - perfStart;
            perfMetrics.snapCalcTime = perfMetrics.snapCalcTime * 0.9 + calcTime * 0.1;
            perfMetrics.dragFrameCount++;

            if (now - perfMetrics.lastLogTime > 1000) {
              console.log(
                `[DragMonitor] Avg snap time: ${perfMetrics.snapCalcTime.toFixed(2)}ms, Frames: ${perfMetrics.dragFrameCount}`
              );
              perfMetrics.lastLogTime = now;
              perfMetrics.dragFrameCount = 0;
            }
          }

          requestAnimationFrame(() => {
            useDesignerStore.getState().setDragState({
              currentX: snapX,
              currentY: snapY,
              lastSnappedX: snapX,
              lastSnappedY: snapY,
              activePageId: activePageInfo.id,
            });
          });
        });

        function updateTransientVisuals(
          guidesX: number[],
          guidesY: number[],
          x: number,
          y: number,
          pInfo: PageOffset,
          indicators: WasmSpacingIndicator[] = []
        ) {
          const pageTopPx = pInfo.top;
          const pageLeftPx = pInfo.left;

          for (let i = 0; i < 4; i++) {
            const vG = document.getElementById(`v-guide-${i}`);
            const hG = document.getElementById(`h-guide-${i}`);
            if (vG) {
              if (guidesX[i] !== undefined) {
                vG.style.left = `${pageLeftPx + LayoutEngine.mmToPx(guidesX[i])}px`;
                vG.style.display = 'block';
              } else {
                vG.style.display = 'none';
              }
            }
            if (hG) {
              if (guidesY[i] !== undefined) {
                hG.style.top = `${pageTopPx + LayoutEngine.mmToPx(guidesY[i])}px`;
                hG.style.display = 'block';
              } else {
                hG.style.display = 'none';
              }
            }
          }

          const pill = document.getElementById('drag-coord-pill');
          if (pill) {
            pill.style.display = 'block';
            pill.style.left = `${pageLeftPx + LayoutEngine.mmToPx(x) + 10}px`;
            pill.style.top = `${pageTopPx + LayoutEngine.mmToPx(y) + 10}px`;
            pill.innerText = `${Math.round(x)}, ${Math.round(y)}mm`;
          }

          const sides = ['left', 'right', 'top', 'bottom'] as const;
          const activeIndicators = new Map(indicators.map((ind) => [ind.side, ind]));
          for (const side of sides) {
            const container = document.getElementById(`spacing-${side}`);
            const line = document.getElementById(`spacing-line-${side}`);
            const label = document.getElementById(`spacing-label-${side}`);
            const ind = activeIndicators.get(side);

            if (!container || !line || !label) continue;
            if (!ind) {
              container.style.display = 'none';
              continue;
            }

            const isHorizontal = side === 'left' || side === 'right';
            const startPx = isHorizontal
              ? pageLeftPx + LayoutEngine.mmToPx(ind.line_start)
              : pageTopPx + LayoutEngine.mmToPx(ind.line_start);
            const endPx = isHorizontal
              ? pageLeftPx + LayoutEngine.mmToPx(ind.line_end)
              : pageTopPx + LayoutEngine.mmToPx(ind.line_end);
            const crossPx = isHorizontal
              ? pageTopPx + LayoutEngine.mmToPx(ind.cross_pos)
              : pageLeftPx + LayoutEngine.mmToPx(ind.cross_pos);

            if (isHorizontal) {
              container.style.left = `${startPx}px`;
              container.style.top = `${crossPx - 6}px`;
              container.style.width = `${endPx - startPx}px`;
              container.style.height = '13px';
            } else {
              container.style.left = `${crossPx - 6}px`;
              container.style.top = `${startPx}px`;
              container.style.width = '13px';
              container.style.height = `${endPx - startPx}px`;
            }

            container.style.display = 'flex';
            label.innerText = `${ind.distance}mm`;
          }
        }
      },
      onDrop: ({ source }) => {
        const _data = source.data as unknown as DragSourceData;

        document.body.classList.remove('is-dragging-components');
        const root = document.documentElement;

        requestAnimationFrame(() => {
          root.style.removeProperty('--drag-dx');
          root.style.removeProperty('--drag-dy');

          const overlays = document.querySelectorAll(
            '[id^="v-guide-"], [id^="h-guide-"], [id^="drag-coord-pill"], [id^="spacing-"]'
          );
          for (const el of overlays) {
            (el as HTMLElement).style.display = 'none';
          }
        });

        useDesignerStore.getState().setDragState({
          isDragging: false,
          draggedComponentId: null,
          activePageId: null,
        });

        dragRef.current.containerRect = null;
        dragRef.current.containerElement = null;
        dragRef.current.pageOffsets = [];
        dragRef.current.lastSnapResult = null;
        dragSnapState.reset();
      },
    });
  }, []);

  return null;
});

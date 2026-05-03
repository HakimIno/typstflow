'use client';

import { dragSnapState } from '@/lib/engine/drag-snap-state';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { SnapEngine, type SnapPoint } from '@/lib/engine/snap-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { layoutEngine as LayoutEngineType } from '@/lib/wasm-layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useRef } from 'react';

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

interface WasmSnapResult {
  dx: number;
  dy: number;
  guides: {
    is_vertical: boolean;
    position: number;
  }[];
}

// ✅ EXTREME PERFORMANCE MODE for 1000+ pages
const SNAP_PAGE_RADIUS = 2; // Pages to load for snapping (current ± 2)
const SNAP_THRESHOLD_MM = 8; // Snap threshold in mm
const SNAP_SKIP_FRAMES = 2; // Skip snap calculation every N frames (lower = more responsive)
const ENABLE_PERF_MONITORING = false; // Set to true for debugging

// ✅ CRITICAL: Only calculate offsets for visible pages, NOT all 1000+
const MAX_OFFSET_PAGES = 20; // Maximum page offsets to calculate (covers most scroll scenarios)

let wasmEngineCache: typeof LayoutEngineType | null = null;
const getLayoutEngine = async () => {
  if (wasmEngineCache) return wasmEngineCache;
  const { layoutEngine } = await import('@/lib/wasm-layout-engine');
  wasmEngineCache = layoutEngine;
  return wasmEngineCache;
};

// Performance tracking
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
export function DragMonitor() {
  const dragRef = useRef<{
    containerRect: DOMRect | null;
    containerElement: HTMLElement | null;
    zoom: number;
    pageHeightPx: number;
    pageWidthPx: number;
    pageGap: number;
    paddingTop: number;
    paddingLeft: number;
    snapPointsX: SnapPoint[];
    snapPointsY: SnapPoint[];
    initialClientX: number;
    initialClientY: number;
    lastSnapTime: number;
    pageOffsets: PageOffset[];
    totalPages: number;
    activePageIdx: number;
    lastRawX: number;
    lastRawY: number;
    frameCounter: number;
    lastSnapResult: { x: number; y: number; guidesX: number[]; guidesY: number[] } | null;
  }>({
    containerRect: null,
    containerElement: null,
    zoom: 1,
    pageHeightPx: 0,
    pageWidthPx: 0,
    pageGap: 32,
    paddingTop: 48,
    paddingLeft: 64,
    snapPointsX: [],
    snapPointsY: [],
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

        const container = document.querySelector('[data-paper-container]') as HTMLElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const zoom = Number.parseFloat(container.dataset.zoom || '1');
        const { schema } = useDesignerStore.getState();

        // Pre-calculate snap points (minimal set)
        const pointsX: SnapPoint[] = [];
        const pointsY: SnapPoint[] = [];

        const { width: pW, height: pH } = getPaperDimensions(
          schema.page.size,
          schema.page.orientation
        );

        // Only edge snapping for performance
        pointsX.push({ value: 0, type: 'edge', originId: 'page' });
        pointsX.push({ value: pW, type: 'edge', originId: 'page' });
        pointsY.push({ value: 0, type: 'edge', originId: 'page' });
        pointsY.push({ value: pH, type: 'edge', originId: 'page' });

        // Page layout constants
        const pageHeightPx = LayoutEngine.mmToPx(pH) * zoom;
        const pageWidthPx = LayoutEngine.mmToPx(pW);
        const pageGap = 32;
        const paddingTop = 48;
        const paddingLeft = 64;

        const startPageId = data.pageId || schema.pages[0]?.id || '';
        const activePageIdx = schema.pages.findIndex((p) => p.id === startPageId);

        // ✅ CRITICAL FIX: Only calculate offsets for nearby pages, NOT all 1000+
        // This is the main performance bottleneck fix!
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

        // ✅ Load MINIMAL pages into WASM (only current ± SNAP_PAGE_RADIUS)
        const pageStartIdx = Math.max(0, activePageIdx - SNAP_PAGE_RADIUS);
        const pageEndIdx = Math.min(schema.pages.length - 1, activePageIdx + SNAP_PAGE_RADIUS);

        getLayoutEngine()
          .then((layoutEngine) => {
            layoutEngine
              .initWasm()
              .then(() => {
                try {
                  const nodes: Parameters<typeof layoutEngine.loadNodes>[0] = [];

                  // Only body zone from nearby pages
                  for (let i = pageStartIdx; i <= pageEndIdx; i++) {
                    const page = schema.pages[i];
                    if (!page) continue;

                    const zoneKey = `body:${page.id}`;
                    const bodyOffset = LayoutEngine.calculateZoneOffset('body', schema, page.id);

                    // Limit to 50 components per page max for performance
                    let count = 0;
                    for (const c of page.body.components) {
                      if (c.id === data.id) continue;
                      if (count++ > 50) break;

                      nodes.push({
                        id: c.id,
                        zone: zoneKey,
                        x: c.x || 0,
                        y: (c.y || 0) + bodyOffset,
                        width: c.width || 0,
                        height: c.height || 0,
                      });
                    }
                  }

                  layoutEngine.loadNodes(nodes);
                } catch (e) {
                  // Silent fail - JS fallback
                }
              })
              .catch(() => {});
          })
          .catch(() => {});

        dragRef.current = {
          containerRect: rect,
          containerElement: container,
          zoom,
          pageHeightPx,
          pageWidthPx,
          pageGap,
          paddingTop,
          paddingLeft,
          snapPointsX: pointsX,
          snapPointsY: pointsY,
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

        // NO store update - just CSS transforms
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

        // ✅ Calculate page index on-demand (O(1) math, no array lookup needed)
        const scrollContainer = cache.containerElement?.parentElement?.parentElement as HTMLElement;
        const scrollY = location.current.input.clientY - cache.containerRect.top;
        const currentScrollTop = scrollContainer?.scrollTop || 0;
        const absoluteY = currentScrollTop + scrollY;
        const absoluteX =
          (scrollContainer?.scrollLeft || 0) +
          (location.current.input.clientX - cache.containerRect.left);

        // ✅ O(1) page index calculation (no binary search needed!)
        const activePageIdx = Math.max(
          0,
          Math.min(
            cache.totalPages - 1,
            Math.floor((absoluteY - cache.paddingTop) / (cache.pageHeightPx + cache.pageGap))
          )
        );

        // Find page offset from our limited array
        const activePageInfo = cache.pageOffsets.find((o) => o.index === activePageIdx) || {
          id: `page-${activePageIdx}`,
          index: activePageIdx,
          top: cache.paddingTop + activePageIdx * (cache.pageHeightPx + cache.pageGap),
          left: cache.paddingLeft,
          width: cache.pageWidthPx,
          height: cache.pageHeightPx,
        };

        // Coordinate calculation
        const relX = (absoluteX - activePageInfo.left - (data.dragOffsetX || 0)) / cache.zoom;
        const relY = (absoluteY - activePageInfo.top - (data.dragOffsetY || 0)) / cache.zoom;

        const rawX = LayoutEngine.pxToMm(relX);
        const rawY = LayoutEngine.pxToMm(relY);

        // ✅ Synchronously publish position so drop handlers always read fresh
        // values, even if async snap calc hasn't completed yet.
        dragSnapState.setRaw(rawX, rawY, activePageInfo.id);

        // ✅ IMMEDIATE CSS feedback (60fps guaranteed)
        const root = document.documentElement;
        const pxDeltaX = location.current.input.clientX - cache.initialClientX;
        const pxDeltaY = location.current.input.clientY - cache.initialClientY;

        root.style.setProperty('--drag-dx', `${pxDeltaX / cache.zoom}px`);
        root.style.setProperty('--drag-dy', `${pxDeltaY / cache.zoom}px`);

        // ✅ EARLY EXIT: Skip snap calculation if not moving significantly
        const deltaX = rawX - cache.lastRawX;
        const deltaY = rawY - cache.lastRawY;
        const movedSignificantly = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

        cache.lastRawX = rawX;
        cache.lastRawY = rawY;

        if (!movedSignificantly && cache.lastSnapResult) {
          // Reuse last snap result - instant feedback!
          const snapOffsetX = LayoutEngine.mmToPx(cache.lastSnapResult.x - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(cache.lastSnapResult.y - rawY);

          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);
          updateTransientVisuals(cache.lastSnapResult.guidesX, cache.lastSnapResult.guidesY, cache.lastSnapResult.x, cache.lastSnapResult.y, activePageInfo);
          return;
        }

        // ✅ FRAME SKIPPING: Only calculate snap every N frames
        if (cache.frameCounter % SNAP_SKIP_FRAMES !== 0) {
          return;
        }

        // Throttle to max 30fps for snap calculation
        const now = Date.now();
        if (cache.lastSnapTime && now - cache.lastSnapTime < 33) return;
        cache.lastSnapTime = now;

        const width = data.width || data.component?.width || 0;
        const height = data.height || data.component?.height || 0;

        const perfStart = performance.now();

        // Async snap calculation (non-blocking)
        getLayoutEngine().then((layoutEngine) => {
          let snapX = rawX;
          let snapY = rawY;
          let activeGuidesX: number[] = [];
          let activeGuidesY: number[] = [];

          let wasmSnap: WasmSnapResult | null = null;
          try {
            wasmSnap = layoutEngine.findSnaps(
              data.id || 'new',
              rawX,
              rawY,
              width,
              height,
              SNAP_THRESHOLD_MM,
              data.zone
            );
          } catch {
            // Fall through to JS
          }

          if (wasmSnap && (Math.abs(wasmSnap.dx) < SNAP_THRESHOLD_MM || Math.abs(wasmSnap.dy) < SNAP_THRESHOLD_MM)) {
            snapX = rawX + wasmSnap.dx;
            snapY = rawY + wasmSnap.dy;
            activeGuidesX = wasmSnap.guides.filter((g) => g.is_vertical).map((g) => g.position);
            activeGuidesY = wasmSnap.guides.filter((g) => !g.is_vertical).map((g) => g.position);
          }

          // ✅ Cache snap result for reuse
          cache.lastSnapResult = { x: snapX, y: snapY, guidesX: activeGuidesX, guidesY: activeGuidesY };

          // ✅ Publish snapped values synchronously for drop handlers
          dragSnapState.setSnapped(snapX, snapY);

          // Apply snap offset
          const snapOffsetX = LayoutEngine.mmToPx(snapX - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(snapY - rawY);

          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);

          updateTransientVisuals(activeGuidesX, activeGuidesY, snapX, snapY, activePageInfo);

          // Performance tracking
          if (ENABLE_PERF_MONITORING) {
            const perfEnd = performance.now();
            const calcTime = perfEnd - perfStart;
            perfMetrics.snapCalcTime = (perfMetrics.snapCalcTime * 0.9) + (calcTime * 0.1);
            perfMetrics.dragFrameCount++;

            if (now - perfMetrics.lastLogTime > 1000) {
              console.log(`[DragMonitor] Avg snap time: ${perfMetrics.snapCalcTime.toFixed(2)}ms, Frames: ${perfMetrics.dragFrameCount}`);
              perfMetrics.lastLogTime = now;
              perfMetrics.dragFrameCount = 0;
            }
          }

          // Minimal store update (throttled)
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
          pInfo: PageOffset
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
        }
      },
      onDrop: ({ source }) => {
        const data = source.data as unknown as DragSourceData;

        // Clean up visuals
        document.body.classList.remove('is-dragging-components');
        const root = document.documentElement;

        requestAnimationFrame(() => {
          root.style.removeProperty('--drag-dx');
          root.style.removeProperty('--drag-dy');

          const overlays = document.querySelectorAll(
            '[id^="v-guide-"], [id^="h-guide-"], [id^="drag-coord-pill"]'
          );
          for (const el of overlays) {
            (el as HTMLElement).style.display = 'none';
          }
        });

        // Reset drag state
        useDesignerStore.getState().setDragState({
          isDragging: false,
          draggedComponentId: null,
          activePageId: null,
        });

        // Reset cache
        dragRef.current.containerRect = null;
        dragRef.current.containerElement = null;
        dragRef.current.pageOffsets = [];
        dragRef.current.lastSnapResult = null;
        dragSnapState.reset();
      },
    });
  }, []);

  return null;
}

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { SnapEngine, type SnapPoint } from '@/lib/engine/snap-engine';
import type { layoutEngine as LayoutEngineType } from '@/lib/wasm-layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useRef } from 'react';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import type { ComponentNode } from '@/types/schema';

interface PageOffset {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
  element: HTMLElement;
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
}

interface WasmSnapResult {
  dx: number;
  dy: number;
  guides: {
    is_vertical: boolean;
    position: number;
  }[];
}

let wasmEngineCache: typeof LayoutEngineType | null = null;
const getLayoutEngine = async () => {
  if (wasmEngineCache) return wasmEngineCache;
  const { layoutEngine } = await import('@/lib/wasm-layout-engine');
  wasmEngineCache = layoutEngine;
  return wasmEngineCache;
};

/**
 * Global Drag Monitor
 *
 * Orchestrates all dragging activities in the designer.
 * - Tracks position of both existing and new (palette) components.
 * - Calculates intelligent snapping in real-time.
 * - Provides vertical and horizontal alignment guides.
 */
export function DragMonitor() {
  const dragRef = useRef<{
    containerRect: DOMRect | null;
    containerElement: HTMLElement | null;
    zoom: number;
    snapPointsX: SnapPoint[];
    snapPointsY: SnapPoint[];
    lastSentX: number;
    lastSentY: number;
    initialClientX: number;
    initialClientY: number;
    lastSnapTime: number;
    pageOffsets: PageOffset[];
  }>({
    containerRect: null,
    containerElement: null,
    zoom: 1,
    snapPointsX: [],
    snapPointsY: [],
    lastSentX: -1,
    lastSentY: -1,
    initialClientX: 0,
    initialClientY: 0,
    lastSnapTime: 0,
    pageOffsets: [],
  });

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const data = source.data as unknown as DragSourceData;
        if (data.type === 'canvas-item' || data.type === 'new-component') {
          const container = document.querySelector('[data-paper-container]') as HTMLElement;
          if (!container) return;

          const rect = container.getBoundingClientRect();
          const zoom = Number.parseFloat(container.dataset.zoom || '1');
          const { schema } = useDesignerStore.getState();

          // Pre-calculate snap points to avoid loops on every frame
          const pointsX: SnapPoint[] = [];
          const pointsY: SnapPoint[] = [];

          // Add page bounds
          const { width: pW, height: pH } = getPaperDimensions(
            schema.page.size,
            schema.page.orientation
          );

          pointsX.push({ value: 0, type: 'edge', originId: 'page' });
          pointsX.push({ value: pW, type: 'edge', originId: 'page' });
          pointsX.push({ value: pW / 2, type: 'center', originId: 'page' });

          pointsY.push({ value: 0, type: 'edge', originId: 'page' });
          pointsY.push({ value: pH, type: 'edge', originId: 'page' });
          pointsY.push({ value: pH / 2, type: 'center', originId: 'page' });

          // 1. CACHE ALL PAGE OFFSETS (For ultra-fast page detection)
          const scrollContainer = container.parentElement?.parentElement as HTMLElement;
          const scrollRect = scrollContainer?.getBoundingClientRect();
          const pageElements = document.querySelectorAll('[data-paper-container]');
          const offsets: PageOffset[] = [];

          for (const el of pageElements) {
            const r = (el as Element).getBoundingClientRect();
            offsets.push({
              id: (el as HTMLElement).dataset.pageId || '',
              top: r.top - scrollRect.top + scrollContainer.scrollTop,
              left: r.left - scrollRect.left + scrollContainer.scrollLeft,
              width: r.width,
              height: r.height,
              element: el as HTMLElement,
            });
          }

          // 2. Load Rust WASM Layout Engine (All pages and zones)
          // Wrapped in try-catch: WASM snapping is optional, falls back to JS SnapEngine
          getLayoutEngine().then((layoutEngine) => {
            layoutEngine.initWasm().then(() => {
              try {
                const nodes: Parameters<typeof layoutEngine.loadNodes>[0] = [];

                // Add Global Zones (Header, Footer)
                for (const [zKey, zone] of Object.entries(schema.zones)) {
                  const yOffset = LayoutEngine.calculateZoneOffset(zKey, schema);
                  for (const c of zone.components) {
                    if (c.id === data.id) continue;
                    nodes.push({
                      id: c.id,
                      zone: zKey,
                      x: c.x || 0,
                      y: (c.y || 0) + yOffset,
                      width: c.width || 0,
                      height: c.height || 0,
                    });
                  }
                }

                // Add Components from ALL Pages
                for (const page of schema.pages) {
                  const zoneKey = `body:${page.id}`;
                  const bodyOffset = LayoutEngine.calculateZoneOffset('body', schema, page.id);

                  for (const c of page.body.components) {
                    if (c.id === data.id) continue;
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
                console.warn('[DragMonitor] WASM loadNodes failed, using JS SnapEngine fallback', e);
              }
            }).catch(() => {});
          }).catch(() => {});

          dragRef.current = {
            containerRect: rect,
            containerElement: container,
            zoom,
            snapPointsX: pointsX,
            snapPointsY: pointsY,
            lastSentX: -1,
            lastSentY: -1,
            initialClientX: location.initial.input.clientX,
            initialClientY: location.initial.input.clientY,
            lastSnapTime: 0,
            pageOffsets: offsets,
          };

          const startPos = LayoutEngine.calculateAbsolutePosition(
            location.initial.input.clientX,
            location.initial.input.clientY,
            data.dragOffsetX || 0,
            data.dragOffsetY || 0
          );

          document.body.classList.add('is-dragging-components');

          useDesignerStore.getState().setDragState({
            isDragging: true,
            draggedComponentId: data.id || 'new',
            startX: startPos.rawX,
            startY: startPos.rawY,
            currentX: startPos.rawX,
            currentY: startPos.rawY,
            lastSnappedX: startPos.x,
            lastSnappedY: startPos.y,
            activeGuides: { vertical: [], horizontal: [] },
            activePageId: data.pageId || offsets[0]?.id || null,
          });
        }
      },
      onDrag: ({ location, source }) => {
        const cache = dragRef.current;
        if (!cache.containerElement) return;
        const data = source.data as unknown as DragSourceData;
        const { schema } = useDesignerStore.getState();

        // 1. FAST HYBRID PAGE DETECTION (Using Cached Offsets)
        const scrollContainer = cache.containerElement.parentElement?.parentElement as HTMLElement;
        if (!scrollContainer) return;

        const scrollRect = scrollContainer.getBoundingClientRect();
        const scrollX =
          location.current.input.clientX - scrollRect.left + scrollContainer.scrollLeft;
        const scrollY = location.current.input.clientY - scrollRect.top + scrollContainer.scrollTop;

        // Find page using cached offsets - NO DOM LOOKUPS HERE
        const activePageInfo =
          cache.pageOffsets.find(
            (p) => scrollY >= p.top - 16 && scrollY <= p.top + p.height + 16
          ) || cache.pageOffsets[0];

        const pageId = activePageInfo.id;

        // 2. COORDINATE CALCULATION (Using Cache)
        // We calculate position relative to the found page's cached rect
        const relX = (scrollX - activePageInfo.left - (data.dragOffsetX || 0)) / cache.zoom;
        const relY = (scrollY - activePageInfo.top - (data.dragOffsetY || 0)) / cache.zoom;

        const rawX = LayoutEngine.pxToMm(relX);
        const rawY = LayoutEngine.pxToMm(relY);

        // 3. VISUAL FEEDBACK (CSS Variables) - High Performance GPU Path
        const root = document.documentElement;
        const pxDeltaX = location.current.input.clientX - cache.initialClientX;
        const pxDeltaY = location.current.input.clientY - cache.initialClientY;

        // Initial feedback based on raw mouse delta
        root.style.setProperty('--drag-dx', `${pxDeltaX / cache.zoom}px`);
        root.style.setProperty('--drag-dy', `${pxDeltaY / cache.zoom}px`);

        // 4. SNAPPING (Async WASM Engine)
        // 3. SNAPPING (Async WASM Engine)
        const width = data.width || data.component?.width || 0;
        const height = data.height || data.component?.height || 0;

        const updateTransientVisuals = (
          guidesX: number[],
          guidesY: number[],
          x: number,
          y: number,
          pInfo: PageOffset
        ) => {
          // Calculate absolute offsets for the global overlay
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
        };

        // 60 FPS Throttling for Snapping & Store Updates
        const now = Date.now();
        if (cache.lastSnapTime && now - cache.lastSnapTime < 16) return;
        cache.lastSnapTime = now;

        getLayoutEngine().then((layoutEngine) => {
          let snapX = rawX;
          let snapY = rawY;
          let activeGuidesX: number[] = [];
          let activeGuidesY: number[] = [];

          // Determine zone filter (body:pageId or global zone name)
          let zoneFilter = data.zone;
          if (pageId) {
            zoneFilter = `body:${pageId}`;
          }

          let wasmSnap: WasmSnapResult | null = null;
          try {
            wasmSnap = layoutEngine.findSnaps(
              data.id || 'new',
              rawX,
              rawY,
              width,
              height,
              5,
              zoneFilter
            );
          } catch {
            // WASM engine is in a corrupted state — fall through to JS fallback
          }

          if (wasmSnap) {
            snapX = rawX + wasmSnap.dx;
            snapY = rawY + wasmSnap.dy;
            activeGuidesX = wasmSnap.guides
              .filter((g) => g.is_vertical)
              .map((g) => g.position);
            activeGuidesY = wasmSnap.guides
              .filter((g) => !g.is_vertical)
              .map((g) => g.position);
          } else {
            const snap = SnapEngine.calculateSnap(
              rawX,
              rawY,
              width,
              height,
              data.id || 'new',
              schema,
              false,
              pageId,
              { x: cache.snapPointsX, y: cache.snapPointsY }
            );
            snapX = snap.snappedX;
            snapY = snap.snappedY;
            activeGuidesX = snap.activeGuidesX;
            activeGuidesY = snap.activeGuidesY;
          }

          // Adjust CSS Variables with Snap Offset (High Performance Visual Path)
          const snapOffsetX = LayoutEngine.mmToPx(snapX - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(snapY - rawY);
          const root = document.documentElement;
          const pxDeltaX = location.current.input.clientX - cache.initialClientX;
          const pxDeltaY = location.current.input.clientY - cache.initialClientY;
          
          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);

          updateTransientVisuals(activeGuidesX, activeGuidesY, snapX, snapY, activePageInfo);

          // Update store only once with the final snapped position
          useDesignerStore.getState().updateLastSnapped(snapX, snapY, pageId || null);
        });
      },
      onDrop: () => {
        dragRef.current.containerRect = null;
        dragRef.current.containerElement = null;
        dragRef.current.pageOffsets = [];
        document.body.classList.remove('is-dragging-components');
        const root = document.documentElement;

        requestAnimationFrame(() => {
          root.style.removeProperty('--drag-dx');
          root.style.removeProperty('--drag-dy');

          // Clean up all transient overlays
          const overlays = document.querySelectorAll(
            '[id^="v-guide-"], [id^="h-guide-"], [id^="drag-coord-pill"]'
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
      },
    });
  }, []);

  return null;
}

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { SnapEngine, type SnapPoint } from '@/lib/engine/snap-engine';
import type { layoutEngine as LayoutEngineType } from '@/lib/wasm-layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useRef } from 'react';

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
    pageOffsets: { id: string, top: number, left: number, width: number, height: number, element: HTMLElement }[];
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
        const data = source.data as any;
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
          const { width: pW, height: pH } = require('@/lib/utils/paper-sizes').getPaperDimensions(
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
          const offsets: any[] = [];

          pageElements.forEach((el: any) => {
            const r = el.getBoundingClientRect();
            offsets.push({
              id: el.dataset.pageId,
              top: r.top - scrollRect.top + scrollContainer.scrollTop,
              left: r.left - scrollRect.left + scrollContainer.scrollLeft,
              width: r.width,
              height: r.height,
              element: el
            });
          });

          // 2. Load Rust WASM Layout Engine
          getLayoutEngine().then((layoutEngine) => {
            const nodes: any[] = [];
            for (const [zKey, zone] of Object.entries(schema.zones) as [string, any][]) {
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
            const sourcePage = schema.pages.find(p => p.id === data.pageId) || schema.pages[0];
            const bodyOffset = LayoutEngine.calculateZoneOffset('body', schema, sourcePage.id);
            for (const c of sourcePage.body.components) {
              if (c.id === data.id) continue;
              nodes.push({
                id: c.id,
                zone: 'body',
                x: c.x || 0,
                y: (c.y || 0) + bodyOffset,
                width: c.width || 0,
                height: c.height || 0,
              });
            }
            layoutEngine.loadNodes(nodes);
          });

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
            activeGuides: { vertical: [], horizontal: [] },
            activePageId: data.pageId || null,
          });
        }
      },
      onDrag: ({ location, source }) => {
        const cache = dragRef.current;
        if (!cache.containerElement) return;
        const data = source.data as any;
        const { schema } = useDesignerStore.getState();

        // 1. FAST HYBRID PAGE DETECTION (Using Cached Offsets)
        const scrollContainer = cache.containerElement.parentElement?.parentElement as HTMLElement;
        if (!scrollContainer) return;

        const scrollRect = scrollContainer.getBoundingClientRect();
        const scrollX = location.current.input.clientX - scrollRect.left + scrollContainer.scrollLeft;
        const scrollY = location.current.input.clientY - scrollRect.top + scrollContainer.scrollTop;

        // Find page using cached offsets - NO DOM LOOKUPS HERE
        const activePageInfo = cache.pageOffsets.find(p => scrollY >= p.top - 16 && scrollY <= p.top + p.height + 16)
          || cache.pageOffsets[0];

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
        const width = data.width || data.component?.width || 0;
        const height = data.height || data.component?.height || 0;

        const updateTransientVisuals = (guidesX: number[], guidesY: number[], x: number, y: number, pInfo: any) => {
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
              } else { vG.style.display = 'none'; }
            }
            if (hG) {
              if (guidesY[i] !== undefined) {
                hG.style.top = `${pageTopPx + LayoutEngine.mmToPx(guidesY[i])}px`;
                hG.style.display = 'block';
              } else { hG.style.display = 'none'; }
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

        // 60 FPS Throttling for Snapping
        const now = Date.now();
        if (cache.lastSnapTime && now - cache.lastSnapTime < 16) return;
        cache.lastSnapTime = now;

        getLayoutEngine().then((layoutEngine) => {
          let snapX = rawX;
          let snapY = rawY;
          let activeGuidesX: number[] = [];
          let activeGuidesY: number[] = [];

          const wasmSnap = layoutEngine.findSnaps(data.id || 'new', rawX, rawY, width, height, 5);

          if (wasmSnap) {
            snapX = rawX + wasmSnap.dx;
            snapY = rawY + wasmSnap.dy;
            activeGuidesX = wasmSnap.guides.filter((g: any) => g.is_vertical).map((g: any) => g.position);
            activeGuidesY = wasmSnap.guides.filter((g: any) => !g.is_vertical).map((g: any) => g.position);
          } else {
            const snap = SnapEngine.calculateSnap(rawX, rawY, width, height, data.id || 'new', schema, false, pageId, { x: cache.snapPointsX, y: cache.snapPointsY });
            snapX = snap.snappedX; snapY = snap.snappedY;
            activeGuidesX = snap.activeGuidesX; activeGuidesY = snap.activeGuidesY;
          }

          // Adjust CSS Variables with Snap Offset
          const snapOffsetX = LayoutEngine.mmToPx(snapX - rawX);
          const snapOffsetY = LayoutEngine.mmToPx(snapY - rawY);
          root.style.setProperty('--drag-dx', `${(pxDeltaX + snapOffsetX) / cache.zoom}px`);
          root.style.setProperty('--drag-dy', `${(pxDeltaY + snapOffsetY) / cache.zoom}px`);

          updateTransientVisuals(activeGuidesX, activeGuidesY, snapX, snapY, activePageInfo);

          // 5. OPTIMIZED STORE UPDATE (Only on snap change or page change)
          if (snapX !== cache.lastSentX || snapY !== cache.lastSentY || pageId !== useDesignerStore.getState().dragState.activePageId) {
            useDesignerStore.getState().setDragState({
              lastSnappedX: snapX,
              lastSnappedY: snapY,
              activePageId: pageId || null,
            });
            cache.lastSentX = snapX;
            cache.lastSentY = snapY;
          }
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
          const overlays = document.querySelectorAll('[id^="v-guide-"], [id^="h-guide-"], [id^="drag-coord-pill-"]');
          overlays.forEach(el => (el as HTMLElement).style.display = 'none');
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

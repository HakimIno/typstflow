'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { SnapEngine, type SnapPoint } from '@/lib/engine/snap-engine';
import { useDesignerStore } from '@/store/designer-store';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect, useRef } from 'react';

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
    zoom: number;
    snapPointsX: SnapPoint[];
    snapPointsY: SnapPoint[];
    lastSentX: number;
    lastSentY: number;
  }>({
    containerRect: null,
    zoom: 1,
    snapPointsX: [],
    snapPointsY: [],
    lastSentX: -1,
    lastSentY: -1
  });

  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const data = source.data as any;
        if (data.type === 'canvas-item' || data.type === 'new-component') {
          const container = document.querySelector('[data-paper-container]') as HTMLElement;
          if (!container) return;

          const rect = container.getBoundingClientRect();
          const zoom = parseFloat(container.dataset.zoom || '1');
          const { schema } = useDesignerStore.getState();

          // Pre-calculate snap points to avoid loops on every frame
          const pointsX: SnapPoint[] = [];
          const pointsY: SnapPoint[] = [];
          
          // Add page bounds
          const { width: pW, height: pH } = require('@/lib/utils/paper-sizes').getPaperDimensions(schema.page.size, schema.page.orientation);
          
          pointsX.push({ value: 0, type: 'edge', originId: 'page' });
          pointsX.push({ value: pW, type: 'edge', originId: 'page' });
          pointsX.push({ value: pW / 2, type: 'center', originId: 'page' });

          pointsY.push({ value: 0, type: 'edge', originId: 'page' });
          pointsY.push({ value: pH, type: 'edge', originId: 'page' });
          pointsY.push({ value: pH / 2, type: 'center', originId: 'page' });

          // Instead of looping in JS, we load the Rust WASM Layout Engine
          import('@/lib/wasm-layout-engine').then(({ layoutEngine }) => {
            const nodes: any[] = [];
            Object.values(schema.zones).forEach((zone: any) => {
              zone.components.forEach((c: any) => {
                if (c.id === data.id) return;
                nodes.push({
                  id: c.id,
                  zone: zone.id,
                  x: c.x || 0,
                  y: c.y || 0,
                  width: c.width || 0,
                  height: c.height || 0
                });
              });
            });
            layoutEngine.loadNodes(nodes);
          });

          dragRef.current = {
            containerRect: rect,
            zoom,
            snapPointsX: pointsX,
            snapPointsY: pointsY,
            lastSentX: -1,
            lastSentY: -1
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
            activeGuides: { vertical: [], horizontal: [] }
          });
        }
      },
      onDrag: ({ location, source }) => {
        const cache = dragRef.current;
        if (!cache.containerRect) return;

        const data = source.data as any;
        const { schema } = useDesignerStore.getState();

        // 1. Optimized Coordinate Calculation (NO reflow)
        const relX = (location.current.input.clientX - cache.containerRect.left - (data.dragOffsetX || 0)) / cache.zoom;
        const relY = (location.current.input.clientY - cache.containerRect.top - (data.dragOffsetY || 0)) / cache.zoom;
        const rawX = LayoutEngine.pxToMm(relX);
        const rawY = LayoutEngine.pxToMm(relY);

        // 2. Optimized Snapping
        const width = data.width || data.component?.width || 0;
        const height = data.height || data.component?.height || 0;
        
        // Use Rust WASM layout engine first, fallback to basic page snap
        let snapX = rawX;
        let snapY = rawY;
        let activeGuidesX: number[] = [];
        let activeGuidesY: number[] = [];
        
        import('@/lib/wasm-layout-engine').then(({ layoutEngine }) => {
          const wasmSnap = layoutEngine.findSnaps(data.id || 'new', rawX, rawY, width, height, 5);
          if (wasmSnap) {
            snapX = rawX + wasmSnap.dx;
            snapY = rawY + wasmSnap.dy;
            activeGuidesX = wasmSnap.guides.filter((g: any) => g.is_vertical).map((g: any) => g.position);
            activeGuidesY = wasmSnap.guides.filter((g: any) => !g.is_vertical).map((g: any) => g.position);
          } else {
            // Fallback to old SnapEngine for page bounds if WASM fails
            const snap = SnapEngine.calculateSnap(
              rawX, rawY, width, height, data.id || 'new', schema, false,
              { x: cache.snapPointsX, y: cache.snapPointsY }
            );
            snapX = snap.snappedX;
            snapY = snap.snappedY;
            activeGuidesX = snap.activeGuidesX;
            activeGuidesY = snap.activeGuidesY;
          }

          // 3. Throttle Store Update (Only if snapped position changed)
          if (snapX !== cache.lastSentX || snapY !== cache.lastSentY) {
            useDesignerStore.getState().setDragState({
              currentX: snapX,
              currentY: snapY,
              lastSnappedX: snapX,
              lastSnappedY: snapY,
              activeGuides: {
                vertical: activeGuidesX,
                horizontal: activeGuidesY
              }
            });
            cache.lastSentX = snapX;
            cache.lastSentY = snapY;
          }

          // 4. Ultra-fast CSS Update
          const root = document.documentElement;
          const ds = useDesignerStore.getState().dragState;
          const dx = LayoutEngine.mmToPx(snapX - ds.startX);
          const dy = LayoutEngine.mmToPx(snapY - ds.startY);
          root.style.setProperty('--drag-dx', `${dx}px`);
          root.style.setProperty('--drag-dy', `${dy}px`);
        });
      },
      onDrop: () => {
        dragRef.current.containerRect = null;
        document.body.classList.remove('is-dragging-components');
        const root = document.documentElement;
        
        requestAnimationFrame(() => {
          root.style.removeProperty('--drag-dx');
          root.style.removeProperty('--drag-dy');
        });
        
        useDesignerStore.getState().setDragState({
          isDragging: false,
          draggedComponentId: null,
          activeGuides: { vertical: [], horizontal: [] }
        });
      }
    });
  }, []);

  return null;
}

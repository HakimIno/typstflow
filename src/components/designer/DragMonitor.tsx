'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { SnapEngine } from '@/lib/engine/snap-engine';
import { useDesignerStore } from '@/store/designer-store';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useEffect } from 'react';

/**
 * Global Drag Monitor
 * 
 * Orchestrates all dragging activities in the designer.
 * - Tracks position of both existing and new (palette) components.
 * - Calculates intelligent snapping in real-time.
 * - Provides vertical and horizontal alignment guides.
 */
export function DragMonitor() {
  useEffect(() => {
    return monitorForElements({
      onDragStart: ({ source, location }) => {
        const data = source.data as any;
        if (data.type === 'canvas-item' || data.type === 'new-component') {
          const pos = LayoutEngine.calculateAbsolutePosition(
            location.initial.input.clientX,
            location.initial.input.clientY,
            data.dragOffsetX || 0,
            data.dragOffsetY || 0
          );

          document.body.classList.add('is-dragging-components');
          
          useDesignerStore.getState().setDragState({
            isDragging: true,
            draggedComponentId: data.id || 'new',
            startX: pos.rawX,
            startY: pos.rawY,
            currentX: pos.rawX,
            currentY: pos.rawY,
            activeGuides: { vertical: [], horizontal: [] }
          });
        }
      },
      onDrag: ({ location, source }) => {
        const data = source.data as any;
        if (data.type !== 'canvas-item' && data.type !== 'new-component') return;

        const { schema } = useDesignerStore.getState();
        
        // 1. Calculate base absolute position using unified logic
        const pos = LayoutEngine.calculateAbsolutePosition(
          location.current.input.clientX,
          location.current.input.clientY,
          data.dragOffsetX || 0,
          data.dragOffsetY || 0
        );

        // 2. Identify dimensions (new components use their template size)
        let width = 0;
        let height = 0;

        if (data.type === 'canvas-item') {
          width = data.width || 0;
          height = data.height || 0;
        } else if (data.type === 'new-component') {
          width = data.component.width || 0;
          height = data.component.height || 0;
        }

        // 3. Apply Snapping
        const snap = SnapEngine.calculateSnap(
          pos.rawX,
          pos.rawY,
          width,
          height,
          data.id || 'new',
          schema,
          false // Alt key override can be improved here
        );

        // 4. Update Global State
        // 4. Update Global State - ONLY for guides and drop coordinates (throttled/optimized)
        useDesignerStore.getState().setDragState({
          currentX: snap.snappedX,
          currentY: snap.snappedY,
          lastSnappedX: snap.snappedX,
          lastSnappedY: snap.snappedY,
          activeGuides: {
            vertical: snap.activeGuidesX,
            horizontal: snap.activeGuidesY
          }
        });

        // 5. Direct DOM Update on documentElement for maximum reliability
        requestAnimationFrame(() => {
          const root = document.documentElement;
          const ds = useDesignerStore.getState().dragState;
          const dx = LayoutEngine.mmToPx(snap.snappedX - ds.startX);
          const dy = LayoutEngine.mmToPx(snap.snappedY - ds.startY);
          root.style.setProperty('--drag-dx', `${dx}px`);
          root.style.setProperty('--drag-dy', `${dy}px`);
        });
      },
      onDrop: () => {
        document.body.classList.remove('is-dragging-components');
        const root = document.documentElement;
        
        // Use a tiny delay before removing variables to prevent flicker 
        // while React updates the store positions
        requestAnimationFrame(() => {
          root.style.removeProperty('--drag-dx');
          root.style.removeProperty('--drag-dy');
        });
        
        // Reset state but preserve lastSnapped coordinates for the drop handler
        useDesignerStore.getState().setDragState({
          isDragging: false,
          draggedComponentId: null,
          activeGuides: { vertical: [], horizontal: [] }
        });
      }
    });
  }, []);

  return null; // Side-effect only component
}

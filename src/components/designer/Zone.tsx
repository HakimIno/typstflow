'use client';

import type { ComponentNode } from '@/types/schema';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ComponentWrapper } from './ComponentWrapper';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
  minHeight?: string;
}

export function Zone({ zoneKey, label, components, minHeight }: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const initialHeightMm = Number.parseFloat(minHeight || '50');
  const [localHeight, setLocalHeight] = useState(initialHeightMm);
  const heightRef = useRef(initialHeightMm);

  const addComponent = useDesignerStore((state) => state.addComponent);
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const updateZone = useDesignerStore((state) => state.updateZone);
  const viewMode = useDesignerStore((state) => state.viewMode);

  // Sync with store when minHeight changes externally
  useEffect(() => {
    const val = Number.parseFloat(minHeight || '50');
    setLocalHeight(val);
    heightRef.current = val;
  }, [minHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = Number.parseFloat(minHeight || '50');

    // Calculate the minimum allowed height based on the bottom-most component
    // This prevents "eating" components by shrinking the zone too much.
    const lowestPoint = components.reduce((max, comp) => {
      const bottom = (comp.y || 0) + (comp.height || 0);
      return Math.max(max, bottom);
    }, 0);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const scale = useDesignerStore.getState().zoom;
      const deltaMm = LayoutEngine.pxToMm(deltaY / scale);
      
      const safetyMargin = 5;
      const minConstraint = Math.max(10, lowestPoint + safetyMargin);
      
      const newHeight = Math.max(minConstraint, startHeight + deltaMm);
      const snappedHeight = LayoutEngine.snap(newHeight);
      
      setLocalHeight(snappedHeight);
      heightRef.current = snappedHeight; // Always up to date for onMouseUp
      updateZone(zoneKey, { minHeight: `${snappedHeight}mm` }, true);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      // Use heightRef.current instead of localHeight to avoid stale closures
      updateZone(zoneKey, { minHeight: `${heightRef.current}mm` }, false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const contentRectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const requestRef: number | null = null;

    return dropTargetForElements({
      element: el,
      getData: () => ({ zoneKey }),
      onDragEnter: () => {
        setIsDraggedOver(true);
        contentRectRef.current = el.getBoundingClientRect();
      },
      onDragLeave: () => {
        setIsDraggedOver(false);
        contentRectRef.current = null;
        if (requestRef) cancelAnimationFrame(requestRef);
      },
      onDrag: ({ location }) => {
        if (!location.current) return;
        // The global DragOverlay now handles all visual feedback to ensure a unified, high-performance experience.
      },
      onDrop: ({ location, source }) => {
        setIsDraggedOver(false);
        if (requestRef) cancelAnimationFrame(requestRef);

        if (!location.current) return;

        // Use enhanced LayoutEngine with scroll compensation and scale awareness
        const scale = useDesignerStore.getState().zoom;
        const context = LayoutEngine.createContextFromElement(el, scale);
        const data = source.data as any;

        const { x, y } = LayoutEngine.calculateDropPosition(
          location.current.input.clientX,
          location.current.input.clientY,
          context,
          data.dragOffsetX || 0,
          data.dragOffsetY || 0
        );

        if (data.type === 'new-component') {
          const snappedX = useDesignerStore.getState().dragState.lastSnappedX;
          const snappedY = useDesignerStore.getState().dragState.lastSnappedY;
          const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, useDesignerStore.getState().schema);

          addComponent(zoneKey, {
            ...data.component,
            id: Math.random().toString(36).substring(7),
            x: snappedX,
            y: snappedY - zoneOffset,
          });
        } else if (data.id) {
          // Use persistent snapped coordinates from store
          const finalX = useDesignerStore.getState().dragState.lastSnappedX;
          const finalY = useDesignerStore.getState().dragState.lastSnappedY;
          const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, useDesignerStore.getState().schema);
          
          moveComponent(data.id, data.zoneKey, zoneKey, 0, finalX, finalY - zoneOffset);
        }
      },
    });
  }, [zoneKey, addComponent, moveComponent]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: `${localHeight}mm` }}
      className={clsx(
        'relative border-b last:border-b-0 border-dashed border-[var(--border-default)] transition-colors group/zone',
        zoneKey === 'header' && 'bg-[var(--bg-widget)]',
        zoneKey === 'body' && 'bg-transparent',
        zoneKey === 'footer' && 'bg-[var(--bg-widget)] opacity-90',
        isDraggedOver ? 'bg-[var(--accent-glow)]/50' : '',
        isResizing && 'ring-1 ring-[var(--accent)] z-50 shadow-lg'
      )}
    >
      {/* Vertical Side Label (External to Paper) */}
      <div className="absolute -left-10 top-0 bottom-0 w-10 flex flex-col items-center justify-center pointer-events-none select-none z-10 opacity-60 group-hover/zone:opacity-100 transition-opacity">
        <div className="absolute inset-y-0 right-0 w-px bg-[var(--border-default)]" />
        <span 
          className={clsx(
            "text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] whitespace-nowrap",
          )}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {label}
        </span>
      </div>

      <div ref={contentRef} className="relative w-full h-full bg-transparent overflow-visible min-h-[inherit]">
        {components.length === 0 && !isDraggedOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30 select-none pointer-events-none">
            <Layers className="w-6 h-6 mb-1" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-center px-4">
              {label} EMPTY<br/>
              <span className="text-[7px] font-medium tracking-normal opacity-60">DRAG COMPONENTS HERE</span>
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-visible">
            {components.map((comp) => (
              <ComponentWrapper key={comp.id} component={comp} zoneKey={zoneKey} />
            ))}
          </div>
        )}
      </div>

      {/* Height Indicator Label */}
      {isResizing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-[10px] px-2 py-1 rounded shadow-lg z-[60] font-mono">
          HEIGHT: {localHeight.toFixed(1)}mm
        </div>
      )}

      {/* Resize Handle (Bottom Edge) */}
      <div
        onMouseDown={handleResizeStart}
        className={clsx(
          'absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize z-40 transition-colors',
          'hover:bg-[var(--accent)] group-hover/zone:bg-[var(--border-default)]',
          isResizing && 'bg-[var(--accent)] h-0.5'
        )}
      >
        {/* Full-width Horizontal Guide Line during Resize */}
        {isResizing && (
          <div className="absolute top-0 -left-[2000px] -right-[2000px] border-b border-dashed border-[var(--accent)] opacity-50" />
        )}
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/zone:opacity-100 transition-opacity">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-sm" />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-sm" />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-sm" />
        </div>
      </div>
    </div>
  );
}

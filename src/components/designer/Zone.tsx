'use client';

import type { ComponentNode } from '@/types/schema';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

  const addComponent = useDesignerStore((state) => state.addComponent);
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const updateZone = useDesignerStore((state) => state.updateZone);

  // Sync with store when minHeight changes externally
  useEffect(() => {
    setLocalHeight(Number.parseFloat(minHeight || '50'));
  }, [minHeight]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startY = e.clientY;
    const startHeight = localHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMm = LayoutEngine.pxToMm(deltaY);
      const newHeight = Math.max(10, startHeight + deltaMm);
      setLocalHeight(LayoutEngine.snap(newHeight));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      updateZone(zoneKey, { minHeight: `${localHeight}mm` });
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

        // Use enhanced LayoutEngine with scroll compensation
        const context = LayoutEngine.createContextFromElement(el);
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
        'relative border-b last:border-b-0 border-slate-300 transition-colors group/zone',
        isDraggedOver ? 'bg-blue-50/50' : 'bg-transparent',
        isResizing && 'ring-1 ring-blue-400 z-50 shadow-lg'
      )}
    >
      {/* Horizontal Band Header (Floating/Absolute) */}
      <div
        className={clsx(
          'absolute -top-6 left-0 right-0 h-6 px-3 flex items-center justify-between pointer-events-none select-none z-30 transition-all opacity-0 group-hover/zone:opacity-100',
          isDraggedOver && 'opacity-100'
        )}
      >
        <div className="flex items-center gap-2 bg-slate-100/80 backdrop-blur-sm px-2 py-0.5 rounded-tr rounded-br border border-slate-200 border-l-0">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
          <div className="h-px w-8 bg-slate-300" />
        </div>
      </div>

      <div ref={contentRef} className="relative w-full h-full bg-white/10 overflow-visible min-h-[inherit]">
        {components.length === 0 && !isDraggedOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 opacity-20 select-none pointer-events-none">
            <Layers className="w-6 h-6 mb-1" />
            <p className="text-[9px] font-bold uppercase tracking-widest">
              {label} EMPTY
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-2 py-1 rounded shadow-lg z-[60] font-mono">
          HEIGHT: {localHeight.toFixed(1)}mm
        </div>
      )}

      {/* Resize Handle (Bottom Edge) */}
      <div
        onMouseDown={handleResizeStart}
        className={clsx(
          'absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize z-30 transition-colors',
          'hover:bg-blue-400 hover:shadow-[0_0_8px_rgba(59,130,246,0.5)]',
          isResizing && 'bg-blue-600'
        )}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/zone:opacity-100">
          <div className="w-1 h-1 rounded-full bg-slate-400" />
          <div className="w-1 h-1 rounded-full bg-slate-400" />
          <div className="w-1 h-1 rounded-full bg-slate-400" />
        </div>
      </div>
    </div>
  );
}

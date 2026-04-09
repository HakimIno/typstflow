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

  const initialHeightMm = parseFloat(minHeight || '50');
  const [localHeight, setLocalHeight] = useState(initialHeightMm);

  const addComponent = useDesignerStore((state) => state.addComponent);
  const moveComponent = useDesignerStore((state) => state.moveComponent);
  const updateZone = useDesignerStore((state) => state.updateZone);

  // Sync with store when minHeight changes externally
  useEffect(() => {
    setLocalHeight(parseFloat(minHeight || '50'));
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

    let requestRef: number | null = null;

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

        const rect = el.getBoundingClientRect();
        const data = source.data as any;

        const { x, y } = LayoutEngine.calculateDropPosition(
          location.current.input.clientX,
          location.current.input.clientY,
          rect,
          data.dragOffsetX || 0,
          data.dragOffsetY || 0
        );

        if (data.type === 'new-component') {
          addComponent(zoneKey, {
            ...data.component,
            id: Math.random().toString(36).substring(7),
            x,
            y,
          });
        } else if (data.id) {
          moveComponent(data.id, data.zoneKey, zoneKey, 0, x, y);
        }
      },
    });
  }, [zoneKey, addComponent, moveComponent]);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: `${localHeight}mm` }}
      className={clsx(
        'flex flex-col border-b last:border-b-0 border-slate-300 relative transition-colors group/zone',
        isDraggedOver ? 'bg-blue-50/50' : 'bg-transparent',
        isResizing && 'ring-1 ring-blue-400 z-50 shadow-lg'
      )}
    >
      {/* Horizontal Band Header */}
      <div
        className={clsx(
          'h-6 px-3 flex items-center justify-between border-b select-none z-20 transition-all',
          isDraggedOver
            ? 'bg-blue-600 border-blue-700 text-white'
            : 'bg-slate-100 border-slate-200 text-slate-500 group-hover/zone:bg-slate-200'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
          <div className="h-px w-24 bg-current opacity-10" />
        </div>
      </div>

      <div ref={contentRef} className="relative flex-1 bg-white/40 overflow-visible">
        {components.length === 0 && !isDraggedOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 opacity-40 select-none pointer-events-none p-12">
            <Layers className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              DRAG COMPONENTS TO {label}
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

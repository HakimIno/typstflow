'use client';

import React, { useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ComponentNode } from '@/types/schema';
import { ComponentWrapper } from './ComponentWrapper';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
}

export function Zone({ zoneKey, label, components }: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [dragGhost, setDragGhost] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const addComponent = useDesignerStore(state => state.addComponent);
  const moveComponent = useDesignerStore(state => state.moveComponent);

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
        setDragGhost(null);
        contentRectRef.current = null;
        if (requestRef) cancelAnimationFrame(requestRef);
      },
      onDrag: ({ location, source }) => {
        if (!contentRectRef.current || !location.current) return;

        if (requestRef) cancelAnimationFrame(requestRef);
        
        requestRef = requestAnimationFrame(() => {
          if (!location.current) return; // Re-check inside async callback
          const rect = contentRectRef.current;
          if (!rect) return;

          const data = source.data as any;
          const { x, y } = LayoutEngine.calculateDropPosition(
            location.current.input.clientX,
            location.current.input.clientY,
            rect,
            data.dragOffsetX || 0,
            data.dragOffsetY || 0
          );

          // Get dimensions from source data
          const w = data.component?.width || data.width || 100;
          const h = data.component?.height || data.height || 20;

          setDragGhost({ x, y, w, h });
        });
      },
      onDrop: ({ location, source }) => {
        setIsDraggedOver(false);
        setDragGhost(null);
        if (requestRef) cancelAnimationFrame(requestRef);
        
        if (!location.current) return;
        
        const rect = contentRectRef.current || el.getBoundingClientRect();
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
            x, y,
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
      className={clsx(
        "relative transition-colors border-b border-slate-300 group min-h-[5cm] flex flex-col",
        isDraggedOver ? "bg-blue-50/20" : "bg-transparent"
      )}
    >
      {/* Horizontal Band Header - Professional Style */}
      <div className={clsx(
        "h-6 px-3 flex items-center justify-between border-b select-none z-20 transition-all",
        isDraggedOver 
          ? "bg-blue-600 border-blue-700 text-white" 
          : "bg-slate-100 border-slate-200 text-slate-500 group-hover:bg-slate-200/80"
      )}>
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
            <div className="h-px w-24 bg-current opacity-10" />
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[8px] font-mono opacity-60">BAND: {zoneKey.toUpperCase()}</span>
        </div>
      </div>

      <div ref={contentRef} className="relative flex-1 bg-white/40">
        {/* Ghost Frame Preview */}
        {dragGhost && (
          <div 
            className="absolute border border-blue-500 bg-blue-500/10 z-40 pointer-events-none transition-none shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            style={{
              left: LayoutEngine.mmToPx(dragGhost.x),
              top: LayoutEngine.mmToPx(dragGhost.y),
              width: LayoutEngine.mmToPx(dragGhost.w),
              height: LayoutEngine.mmToPx(dragGhost.h),
            }}
          >
            <div className="absolute -top-4 left-0 bg-blue-500 text-white text-[7px] px-1 font-bold uppercase">
              {dragGhost.x}mm, {dragGhost.y}mm
            </div>
            {/* Visual Crosshair for accuracy */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-600" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-600" />
          </div>
        )}

        {components.length === 0 && !isDraggedOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 opacity-40 select-none pointer-events-none p-12">
            <Layers className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">DRAG COMPONENTS TO {label}</p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-visible">
            {components.map((comp) => (
              <ComponentWrapper key={comp.id} component={comp} zoneKey={zoneKey} />
            ))}
          </div>
        )}
      </div>

      {/* Drag Over Highlighting */}
      {isDraggedOver && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10" />
      )}
    </div>
  );
}

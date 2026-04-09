'use client';

import React, { useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { ComponentNode } from '@/types/schema';
import { ComponentWrapper } from './ComponentWrapper';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
}

export function Zone({ zoneKey, label, components }: ZoneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ zoneKey }),
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: () => setIsDraggedOver(false),
    });
  }, [zoneKey]);

  return (
    <div
      ref={ref}
      className={clsx(
        "relative transition-colors border-b border-slate-300 group",
        isDraggedOver ? "bg-blue-50/30" : "bg-transparent"
      )}
    >
      {/* Band Label (Jasper style) */}
      <div className={clsx(
        "absolute left-0 top-0 bottom-0 w-6 flex flex-col items-center py-2 border-r select-none",
        isDraggedOver 
          ? "bg-blue-600 border-blue-700 text-white" 
          : "bg-slate-100 border-slate-300 text-slate-400 group-hover:bg-slate-200"
      )}>
        <span className="text-[9px] font-black uppercase [writing-mode:vertical-lr] rotate-180 tracking-widest">{label}</span>
      </div>

      <div className="ml-6 flex flex-col min-h-[4cm]">
        {components.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-40 select-none pointer-events-none p-12">
            <Layers className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">{label} - NO CONTENT</p>
          </div>
        ) : (
          <div className="flex flex-col">
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

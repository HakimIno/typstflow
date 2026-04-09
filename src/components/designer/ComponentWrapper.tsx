'use client';

import React, { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, extractClosestEdge, Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useDesignerStore } from '@/store/designer-store';
import { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Trash2, Copy, GripVertical, Type, Table as TableIcon, Image as ImageIcon, Minus, Space } from 'lucide-react';

interface Props {
  component: ComponentNode;
  zoneKey: 'header' | 'body' | 'footer';
}

export function ComponentWrapper({ component, zoneKey }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const { selectedComponentId, selectComponent, removeComponent, addComponent } = useDesignerStore();
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const isSelected = selectedComponentId === component.id;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      dragHandle: dragHandleRef.current || undefined,
      getInitialData: () => ({ type: 'canvas-item', id: component.id, zoneKey }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [component.id, zoneKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: ({ input, element }) => attachClosestEdge({ id: component.id, zoneKey }, { input, element, allowedEdges: ['top', 'bottom'] }),
      onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [component.id, zoneKey]);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newComponent = { ...component, id: Math.random().toString(36).substring(7) };
    addComponent(zoneKey, newComponent);
  };

  const renderPreview = () => {
    switch (component.type) {
      case 'text':
        return (
          <div 
            className="leading-tight text-slate-800 p-1"
            style={{ 
              fontSize: `${(component as any).style?.fontSize || 10}pt`, 
              fontWeight: (component as any).style?.fontWeight || 'regular',
              textAlign: (component as any).align || 'left'
            }}
          >
            {(component as any).content || 'Empty text'}
          </div>
        );
      case 'table':
        return (
          <div className="border border-slate-200 m-1 bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-2 py-0.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
               <span>Table: {(component as any).dataSource}</span>
               <TableIcon className="w-3 h-3" />
            </div>
            <div className="h-6 flex items-center justify-center italic text-[9px] text-slate-400">
              [ Data Table Block ]
            </div>
          </div>
        );
      case 'line':
        return (
          <div className="py-2 px-1">
            <div className="border-t border-slate-900" style={{ borderTopWidth: (component as any).thickness || '1pt' }} />
          </div>
        );
      case 'spacer':
        return (
          <div className="bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[9px] italic text-slate-400 m-1" style={{ height: (component as any).height || '1cm' }}>
            Spacer: {(component as any).height}
          </div>
        );
      case 'image':
        return (
          <div className="w-full bg-slate-100 border border-slate-200 flex items-center justify-center aspect-[4/1] text-[10px] text-slate-400 font-bold uppercase italic p-2">
            Image Placeholder
          </div>
        );
      default:
        return <div className="p-2 text-[10px] italic text-slate-400">Block: {component.type}</div>;
    }
  };

  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(component.id);
      }}
      className={clsx(
        "relative transition-all cursor-default select-none bg-white",
        isSelected 
          ? "z-20 ring-1 ring-blue-600" 
          : "hover:bg-slate-50 border-b border-transparent hover:border-slate-200",
        isDragging && "opacity-30"
      )}
    >
      {/* Industrial Drag Handle & Actions */}
      {isSelected && (
        <div className="absolute -top-6 right-0 flex items-center bg-blue-600 border border-blue-700 rounded-t-sm px-1 h-6">
          <div
             ref={dragHandleRef}
             className="p-1 hover:bg-blue-500 text-white cursor-grab active:cursor-grabbing border-r border-blue-700/50"
          >
            <GripVertical className="w-3 h-3" />
          </div>
          <button onClick={handleDuplicate} className="p-1 hover:bg-blue-500 text-white border-r border-blue-700/50" title="Duplicate">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); removeComponent(component.id); }} className="p-1 hover:bg-red-500 text-white" title="Delete">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="relative">
        {renderPreview()}
      </div>

      {/* Industrial Selection Corners */}
      {isSelected && (
        <>
          <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-white border border-blue-600 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-white border border-blue-600 translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-white border border-blue-600 -translate-x-1/2 translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-white border border-blue-600 translate-x-1/2 translate-y-1/2" />
        </>
      )}

      {/* Drop Indicator */}
      {closestEdge && (
        <div className={clsx(
          "absolute left-0 right-0 h-0.5 bg-blue-500 z-50",
          closestEdge === 'top' ? "top-0" : "bottom-0"
        )} />
      )}
    </div>
  );
}

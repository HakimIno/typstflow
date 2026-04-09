'use client';

import React, { useEffect, useRef, useState } from 'react';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, extractClosestEdge, Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useDesignerStore } from '@/store/designer-store';
import { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Trash2, Copy, GripVertical, Type, Table as TableIcon, Image as ImageIcon, Minus, Space } from 'lucide-react';

import { LayoutEngine } from '@/lib/engine/layout-engine';

interface Props {
  component: ComponentNode;
  zoneKey: 'header' | 'body' | 'footer';
}

export function ComponentWrapper({ component, zoneKey }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  // High-performance selectors
  const selectedComponentId = useDesignerStore(state => state.selectedComponentId);
  const selectComponent = useDesignerStore(state => state.selectComponent);
  const removeComponent = useDesignerStore(state => state.removeComponent);
  const addComponent = useDesignerStore(state => state.addComponent);
  const updateComponent = useDesignerStore(state => state.updateComponent);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);

  // Local state for immediate interaction feedback (snappy)
  const [localBounds, setLocalBounds] = useState({ 
    x: component.x || 0, 
    y: component.y || 0, 
    width: component.width || 100, 
    height: component.height || 20 
  });

  // Sync local bounds with store when not actively interacting
  useEffect(() => {
    if (!isResizing) {
      setLocalBounds({
        x: component.x || 0,
        y: component.y || 0,
        width: component.width || 100,
        height: component.height || 20
      });
    }
  }, [component.x, component.y, component.width, component.height, isResizing]);

  const isSelected = selectedComponentId === component.id;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      dragHandle: dragHandleRef.current || undefined,
      getInitialData: ({ input }) => {
        const rect = el.getBoundingClientRect();
        return { 
          type: 'canvas-item', 
          id: component.id, 
          zoneKey,
          dragOffsetX: input.clientX - rect.left,
          dragOffsetY: input.clientY - rect.top
        };
      },
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [component.id, zoneKey]);

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newComponent = { 
        ...component, 
        id: Math.random().toString(36).substring(7),
        x: (component.x || 0) + 10,
        y: (component.y || 0) + 10
    };
    addComponent(zoneKey, newComponent);
  };

  const renderPreview = () => {
    // Narrowing should work automatically if we use the component directly
    const comp = component;
    switch (comp.type) {
      case 'text':
        return (
          <div 
            className="leading-tight text-slate-800 p-1 w-full h-full"
            style={{ 
              fontSize: `${comp.style?.fontSize || 10}pt`, 
              fontWeight: comp.style?.fontWeight || 'regular',
              textAlign: comp.align || 'left'
            }}
          >
            {comp.content || 'Empty text'}
          </div>
        );
      case 'table':
        return (
          <div className="border border-slate-200 bg-white w-full h-full text-slate-400">
            <div className="bg-slate-50 border-b border-slate-200 px-2 py-0.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
               <span>Table: {comp.dataSource}</span>
               <TableIcon className="w-3 h-3" />
            </div>
            <div className="flex-1 flex items-center justify-center italic text-[9px]">
               [ Data Table Block ]
            </div>
          </div>
        );
      case 'line':
        return (
          <div className="w-full h-full flex flex-col justify-center px-1">
            <div className="border-t border-slate-900" style={{ borderTopWidth: comp.thickness || '1pt' }} />
          </div>
        );
      case 'spacer':
        return (
          <div className="bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-[9px] italic text-slate-400 w-full h-full">
            Spacer: {comp.height}mm
          </div>
        );
      case 'image':
        return (
          <div className="w-full h-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase italic overflow-hidden">
            Image Placeholder
          </div>
        );
      case 'barcode':
        return (
          <div className="w-full h-full border border-slate-400 bg-slate-50 flex flex-col items-center justify-center p-1">
            <div className="text-[8px] font-bold text-slate-500">{comp.format.toUpperCase()}</div>
            <div className="w-full flex-1 bg-white border border-slate-200 mt-1" />
          </div>
        );
      default:
        return <div className="p-2 text-[10px] italic text-slate-400">Block: {comp.type}</div>;
    }
  };

  const handleResize = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(handle);

    const startX = e.clientX;
    const startY = e.clientY;
    
    // Captured initial bounds in MM
    const initX = localBounds.x;
    const initY = localBounds.y;
    const initW = localBounds.width;
    const initH = localBounds.height;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = LayoutEngine.pxToMm(moveEvent.clientX - startX);
      const dy = LayoutEngine.pxToMm(moveEvent.clientY - startY);

      let newX = initX;
      let newY = initY;
      let newW = initW;
      let newH = initH;

      // X-Axis Resizing Logic (Edge-based)
      if (handle.includes('left')) {
          const rawX = initX + dx;
          const snappedX = LayoutEngine.snap(rawX);
          const rightEdge = initX + initW;
          newX = Math.min(snappedX, rightEdge - 1); // Maintain min 1mm width
          newW = rightEdge - newX;
      } else if (handle.includes('right')) {
          const rawRight = (initX + initW) + dx;
          const snappedRight = LayoutEngine.snap(rawRight);
          newW = Math.max(1, snappedRight - initX);
      }

      // Y-Axis Resizing Logic (Edge-based)
      if (handle.includes('top')) {
          const rawY = initY + dy;
          const snappedY = LayoutEngine.snap(rawY);
          const bottomEdge = initY + initH;
          newY = Math.min(snappedY, bottomEdge - 1); // Maintain min 1mm height
          newH = bottomEdge - newY;
      } else if (handle.includes('bottom')) {
          const rawBottom = (initY + initH) + dy;
          const snappedBottom = LayoutEngine.snap(rawBottom);
          newH = Math.max(1, snappedBottom - initY);
      }

      // Performance Optimization: Only update state if snapped values actually changed
      setLocalBounds(prev => {
          if (prev.x === newX && prev.y === newY && prev.width === newW && prev.height === newH) {
              return prev;
          }
          return { x: newX, y: newY, width: newW, height: newH };
      });
    };

    const onMouseUp = () => {
      // Commit the VERY LATEST local state to the store on finish
      // FIXED: Moved updateComponent OUT of setLocalBounds updater to avoid React warning
      updateComponent(component.id, {
        width: localBounds.width,
        height: localBounds.height,
        x: localBounds.x,
        y: localBounds.y
      });

      setIsResizing(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };


    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const x = LayoutEngine.mmToPx(localBounds.x);
  const y = LayoutEngine.mmToPx(localBounds.y);
  const width = LayoutEngine.mmToPx(localBounds.width);
  const height = LayoutEngine.mmToPx(localBounds.height);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSelected) return;
    
    const step = e.shiftKey ? 5 : 1;
    let newX = component.x || 0;
    let newY = component.y || 0;

    switch (e.key) {
      case 'ArrowLeft': newX -= step; break;
      case 'ArrowRight': newX += step; break;
      case 'ArrowUp': newY -= step; break;
      case 'ArrowDown': newY += step; break;
      case 'Delete':
      case 'Backspace':
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        removeComponent(component.id);
        break;
      default: return;
    }

    e.preventDefault();
    updateComponent(component.id, {
      x: LayoutEngine.snap(Math.max(0, newX)),
      y: LayoutEngine.snap(Math.max(0, newY))
    });
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(component.id);
      }}
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width: width,
        height: height,
        outline: 'none'
      }}
      className={clsx(
        "transition-none cursor-default select-none bg-white",
        isSelected 
          ? "z-50 ring-1 ring-blue-600 shadow-lg" 
          : "hover:bg-slate-50 border border-transparent hover:border-slate-300 z-10",
        isDragging && "opacity-30",
        isResizing && "ring-2 ring-blue-500 z-[100]"
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

      <div className="w-full h-full relative overflow-hidden pointer-events-none">
        {renderPreview()}
      </div>

      {/* Industrial Selection Corners & Resizing Handles */}
      {isSelected && (
        <>
          {/* 8 Resizing Handles */}
          {[
            'top-left', 'top-center', 'top-right',
            'middle-left', 'middle-right',
            'bottom-left', 'bottom-center', 'bottom-right'
          ].map(handle => (
              <div 
                key={handle}
                onMouseDown={(e) => handleResize(e, handle)}
                className={clsx(
                  "absolute w-2 h-2 bg-white border border-blue-600 z-50 shadow-sm",
                  handle === 'top-left' && "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                  handle === 'top-center' && "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
                  handle === 'top-right' && "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                  handle === 'middle-left' && "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
                  handle === 'middle-right' && "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
                  handle === 'bottom-left' && "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                  handle === 'bottom-center' && "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
                  handle === 'bottom-right' && "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                )}
              />
          ))}
        </>
      )}
    </div>
  );
}

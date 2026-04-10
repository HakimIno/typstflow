'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useDraggable } from '@/hooks/use-draggable';
import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { ComponentPreview } from './ComponentPreview';

interface Props {
  component: ComponentNode;
  zoneKey: 'header' | 'body' | 'footer';
}

const RESIZE_HANDLES = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const ComponentWrapper = memo(function ComponentWrapper({ component, zoneKey }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { selectedComponentId, selectComponent, removeComponent, addComponent, updateComponent } =
    useDesignerStore(
      useShallow((state) => ({
        selectedComponentId: state.selectedComponentId,
        selectComponent: state.selectComponent,
        removeComponent: state.removeComponent,
        addComponent: state.addComponent,
        updateComponent: state.updateComponent,
      }))
    );

  const isSelected = selectedComponentId === component.id;

  // 1. Logic Extracted: Resizing
  const { localBounds, isResizing, handleResizeStart, syncBounds } = useResizable(
    {
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: component.height || 20,
    },
    (finalBounds) => {
      // Commits final values to store on mouse up
      updateComponent(component.id, finalBounds);
    }
  );

  // Sync with store when component props change externally
  useEffect(() => {
    syncBounds({
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: component.height || 20,
    });
  }, [component.x, component.y, component.width, component.height, syncBounds]);

  // 2. Logic Extracted: Dragging
  // Note: We don't pass width/height anymore - useDraggable reads from DOM
  // This prevents stale dimensions after resize operations
  const { isDragging } = useDraggable({
    id: component.id,
    zoneKey,
    ref,
  });

  // STABLE: Prevent recreation of handlers on every render
  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      addComponent(zoneKey, {
        ...component,
        id: Math.random().toString(36).substring(7),
        x: (component.x || 0) + 10,
        y: (component.y || 0) + 10,
      });
    },
    [addComponent, component, zoneKey]
  );

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
      case 'ArrowLeft':
        newX -= step;
        break;
      case 'ArrowRight':
        newX += step;
        break;
      case 'ArrowUp':
        newY -= step;
        break;
      case 'ArrowDown':
        newY += step;
        break;
      case 'Delete':
      case 'Backspace':
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        removeComponent(component.id);
        break;
      default:
        return;
    }

    e.preventDefault();
    updateComponent(component.id, {
      x: LayoutEngine.snap(Math.max(0, newX)),
      y: LayoutEngine.snap(Math.max(0, newY)),
    });
  };

  return (
    <div
      ref={ref}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        selectComponent(component.id);
      }}
      style={{
        position: 'absolute',
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
        outline: 'none',
        boxSizing: 'border-box',
      }}
      className={clsx(
        'transition-none cursor-default select-none group focus:outline-none',
        isSelected
          ? 'z-50 ring-2 ring-blue-500 ring-inset shadow-md bg-white'
          : 'z-10 bg-white/50 hover:bg-white hover:ring-1 hover:ring-slate-300 ring-inset',
        isDragging && 'opacity-0',
        isResizing && 'ring-2 ring-blue-600 shadow-lg z-[100]'
      )}
    >
      {/* Precision Action Bar - Always mounted, visibility controlled by CSS */}
      <div
        key={`action-bar-${component.id}`}
        className={clsx(
          'absolute -top-7 right-0 flex items-center bg-blue-600 border border-blue-700 rounded-md px-0.5 h-6.5 shadow-sm transition-opacity duration-200',
          !isSelected || isDragging ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        <div
          key="drag-handle"
          ref={dragHandleRef}
          data-drag-handle="true"
          className="p-1 hover:bg-blue-500 text-white cursor-grab active:cursor-grabbing border-r border-blue-700/50"
        >
          <GripVertical className="w-3 h-3" />
        </div>
        <button
          key="duplicate-btn"
          type="button"
          onClick={handleDuplicate}
          className="p-1 hover:bg-blue-500 text-white border-r border-blue-700/50"
          title="Duplicate"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          key="delete-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeComponent(component.id);
          }}
          className="p-1 hover:bg-red-500 text-white"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Content Preview */}
      <div ref={previewRef} className="w-full h-full relative pointer-events-none">
        <ComponentPreview component={component} />
      </div>

      {/* Resizing Handles */}
      {isSelected &&
        !isDragging &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            onMouseDown={(e) => handleResizeStart(e, handle)}
            className={clsx(
              'absolute w-1.5 h-1.5 bg-white border border-blue-600 z-50 shadow-sm',
              handle === 'top-left' &&
                'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
              handle === 'top-center' &&
                'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
              handle === 'top-right' &&
                'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
              handle === 'middle-left' &&
                'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
              handle === 'middle-right' &&
                'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
              handle === 'bottom-left' &&
                'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
              handle === 'bottom-center' &&
                'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
              handle === 'bottom-right' &&
                'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
            )}
          />
        ))}
    </div>
  );
});

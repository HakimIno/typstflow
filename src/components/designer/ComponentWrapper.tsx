'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { 
  Copy, 
  GripVertical, 
  Trash2, 
  Lock, 
  ArrowUp, 
  ArrowDown, 
  ChevronUp, 
  ChevronDown,
  ChevronLast,
  ChevronFirst
} from 'lucide-react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useDraggable } from '@/hooks/use-draggable';
import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { ComponentPreview } from './ComponentPreview';
import { TextEditor } from './TextEditor';

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
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { 
    selectedComponentIds, 
    isDraggingGlobal, 
    draggedComponentId, 
    selectComponent, 
    toggleComponentSelection, 
    removeComponent, 
    removeComponents, 
    addComponent, 
    updateComponent, 
    sampleData,
    hiddenComponentIds,
    lockedComponentIds,
    bringToFront,
    sendToBack,
    moveUp,
    moveDown,
  } =
    useDesignerStore(
      useShallow((state) => ({
        selectedComponentIds: state.selectedComponentIds,
        isDraggingGlobal: state.dragState.isDragging,
        draggedComponentId: state.dragState.draggedComponentId,
        selectComponent: state.selectComponent,
        toggleComponentSelection: state.toggleComponentSelection,
        removeComponent: state.removeComponent,
        removeComponents: state.removeComponents,
        addComponent: state.addComponent,
        updateComponent: state.updateComponent,
        sampleData: state.sampleData,
        hiddenComponentIds: state.hiddenComponentIds,
        lockedComponentIds: state.lockedComponentIds,
        bringToFront: state.bringToFront,
        sendToBack: state.sendToBack,
        moveUp: state.moveUp,
        moveDown: state.moveDown,
      }))
    );

  const isHidden = hiddenComponentIds.includes(component.id);
  const isLocked = lockedComponentIds.includes(component.id);

  const [isEditing, setIsEditing] = useState(false);
  const isSelected = selectedComponentIds.includes(component.id);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (component.type === 'text') {
      e.stopPropagation();
      setIsEditing(true);
      selectComponent(component.id);
    }
  };

  const handleTextChange = (value: string) => {
    updateComponent(component.id, { content: value });
  };

  const handleExitEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Handle click outside to exit editing mode
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Don't exit if clicking on dropdown or other UI parts
      const target = e.target as Element;
      if (
        !target ||
        target.closest?.('[data-variable-dropdown="true"]') ||
        target.parentElement?.classList.contains('z-50') ||
        target.parentElement?.parentElement?.classList.contains('z-50')
      ) {
        return;
      }

      if (editorContainerRef.current &&
          !editorContainerRef.current.contains(target) &&
          !dragHandleRef.current?.contains(target)) {
        setIsEditing(false);
      }
    };

    // Add delay to prevent conflicts with TextEditor clicks
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

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
    disabled: isEditing,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    // Handle editing mode key events
    if (isEditing) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // We let TextEditor's internal logic handle Enter first
        // It will call onExit if no autocomplete is active
        return;
      }
      if (e.key === 'Escape') {
        setIsEditing(false);
      }
      return;
    }

    if (!isSelected || isLocked) return;

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
        if (selectedComponentIds.length > 1) {
          removeComponents(selectedComponentIds);
        } else {
          removeComponent(component.id);
        }
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

  const isMoving = isDraggingGlobal && (
    draggedComponentId === component.id || 
    (isSelected && selectedComponentIds.includes(draggedComponentId || ''))
  );

  return (
    <div
      ref={ref}
      onKeyDown={!isEditing ? handleKeyDown : undefined}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) {
          if (e.shiftKey) {
            toggleComponentSelection(component.id);
          } else {
            selectComponent(component.id);
          }
        }
      }}
      style={{
        position: 'absolute',
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
        outline: 'none',
        boxSizing: 'border-box',
        willChange: 'transform',
        transform: isMoving
          ? 'translate(var(--drag-dx, 0px), var(--drag-dy, 0px))'
          : 'none',
        zIndex: isMoving ? 100 : 10,
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden || isLocked && !isMoving ? 'none' : 'auto',
      }}
      data-designer-component
      className={clsx(
        'transition-none cursor-default select-none group focus:outline-none',
        isSelected
          ? clsx(
              'z-50 ring-2 ring-[var(--accent)] ring-inset shadow-md',
              component.type === 'text' ? 'bg-white/[0.02]' : 'bg-white/10'
            )
          : clsx(
              'z-10 ring-inset hover:ring-1 hover:ring-white/20',
              component.type === 'text' ? 'bg-transparent' : 'bg-white/5 hover:bg-white/10'
            ),
        isSelected && !isLocked && 'z-[100] pointer-events-none is-moving', // Add class for CSS targeting
        isMoving && 'z-[100] pointer-events-none is-moving ring-2 ring-[var(--accent)] shadow-lg', // Visual feedback during movement
        isResizing && 'ring-2 ring-[var(--accent)] shadow-lg z-[100]'
      )}
    >
      {/* Lock Indicator */}
      {isLocked && (
        <div className="absolute -top-2 -left-2 z-[70] bg-orange-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
          <Lock className="w-2.5 h-2.5" />
        </div>
      )}
      {/* Inline Editor */}
      {isEditing && component.type === 'text' && (
        <div
          ref={editorContainerRef}
          className="absolute inset-0 w-full h-full bg-white shadow-2xl z-[60] overflow-hidden border-2 border-blue-600"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          style={{
            // Keep text in the same position
            display: 'flex',
            alignItems: (component.style as any)?.verticalAlign || 'flex-start',
            justifyContent: component.align === 'center' ? 'center' :
                         component.align === 'right' ? 'flex-end' :
                         component.align === 'justify' ? 'flex-start' : 'flex-start',
          }}
        >
          <TextEditor
            value={component.content || ''}
            onChange={handleTextChange}
            sampleData={sampleData}
            className="w-full h-full"
            placeholder=""
            inline={true}
            style={{
              fontSize: `${component.style?.fontSize || 10}pt`,
              lineHeight: component.style?.lineHeight || 1.2,
              letterSpacing: component.style?.letterSpacing || 'normal',
              textAlign: component.align === 'justify' ? 'left' : component.align || 'left',
              fontFamily: 'Sarabun, sans-serif',
              color: '#1e293b', // Force readable dark color on white background
              fontWeight: component.style?.fontWeight === 'bold' ? 'bold' : 'normal',
              // Prevent layout shift
              minHeight: `${component.height || 20}px`,
              display: 'block',
            }}
            textareaClassName="resize-none"
            onExit={handleExitEdit}
          />
        </div>
      )}
      {/* Precision Action Bar */}
      {!isLocked && (
        <div
          key={`action-bar-${component.id}`}
        className={clsx(
          'absolute -top-7 right-0 flex items-center bg-[var(--accent)] border border-[var(--border-accent)] rounded-md px-0.5 h-6.5 shadow-sm transition-opacity duration-200',
          !isSelected || isDragging || selectedComponentIds.length > 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        <div
          key="drag-handle"
          ref={dragHandleRef}
          data-drag-handle="true"
          className="p-1 hover:bg-white/10 text-white cursor-grab active:cursor-grabbing border-r border-white/10"
        >
          <GripVertical className="w-3 h-3" />
        </div>
        
        {/* Arrangement Actions */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); bringToFront(component.id); }}
          className="p-1 hover:bg-white/10 text-white border-r border-white/10"
          title="Bring to Front"
        >
          <ChevronLast className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); moveUp(component.id); }}
          className="p-1 hover:bg-white/10 text-white border-r border-white/10"
          title="Bring Forward"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); moveDown(component.id); }}
          className="p-1 hover:bg-white/10 text-white border-r border-white/10"
          title="Send Backward"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); sendToBack(component.id); }}
          className="p-1 hover:bg-white/10 text-white border-r border-white/10"
          title="Send to Back"
        >
          <ChevronFirst className="w-3 h-3" />
        </button>

        <button
          key="duplicate-btn"
          type="button"
          onClick={handleDuplicate}
          className="p-1 hover:bg-white/10 text-white border-r border-white/10"
          title="Duplicate"
        >
          <Copy className="w-3 h-3" />
        </button>
        <button
          key="delete-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (selectedComponentIds.length > 1) {
              removeComponents(selectedComponentIds);
            } else {
              removeComponent(component.id);
            }
          }}
          className="p-1 hover:bg-red-600 text-white"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      )}

      {/* Content Preview */}
      {!isEditing && (
        <div ref={previewRef} className="w-full h-full relative pointer-events-none">
          <ComponentPreview component={component} />
        </div>
      )}

      {/* Resizing Handles */}
      {isSelected && !isLocked &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            onMouseDown={(e) => handleResizeStart(e, handle)}
            className={clsx(
              'absolute w-1.5 h-1.5 bg-white border border-[var(--accent)] z-50 shadow-sm',
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

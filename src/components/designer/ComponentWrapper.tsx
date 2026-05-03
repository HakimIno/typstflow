'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronUp,
  Copy,
  GripVertical,
  Lock,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { detectZoneAtPoint, isDifferentZone } from '@/lib/utils/zone-detector';
import { ComponentPreview } from './ComponentPreview';
import { TextEditor } from './TextEditor';

interface Props {
  component: ComponentNode;
  zoneKey: 'header' | 'body' | 'footer';
  pageId?: string;
  pageIndex?: number;
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

export const ComponentWrapper = memo(function ComponentWrapper({
  component,
  zoneKey,
  pageId,
  pageIndex = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Single subscription for all reactive data — useShallow does key-by-key comparison
  // so this only re-renders when one of these specific values actually changes.
  // Removes 10 separate subscriptions (and 3 unused ones: _isDraggingGlobal, _draggedComponentId, _zoom).
  const { isSelected, selectedIds, isHidden, isLocked, totalPages, sampleData } = useDesignerStore(
    useShallow((s) => ({
      isSelected: s.selectedComponentIds.includes(component.id),
      selectedIds: s.selectedComponentIds,
      isHidden: s.hiddenComponentIds.includes(component.id),
      isLocked: s.lockedComponentIds.includes(component.id),
      totalPages: s.schema.pages.length,
      sampleData: s.sampleData,
    }))
  );

  // Actions — stable Zustand references, won't cause re-renders
  const selectComponent = useDesignerStore((s) => s.selectComponent);
  const toggleComponentSelection = useDesignerStore((s) => s.toggleComponentSelection);
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const addComponent = useDesignerStore((s) => s.addComponent);
  const removeComponent = useDesignerStore((s) => s.removeComponent);
  const removeComponents = useDesignerStore((s) => s.removeComponents);
  const bringToFront = useDesignerStore((s) => s.bringToFront);
  const sendToBack = useDesignerStore((s) => s.sendToBack);
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);

  const [isEditing, setIsEditing] = useState(false);

  // ✅ Ultra-fast pointer-based drag (Figma-style)
  const dragStateRef = useRef<{
    isActive: boolean;
    startX: number;
    startY: number;
    pointerId: number;
    primaryId: string;
    grabOffsetXmm: number;
    grabOffsetYmm: number;
    initialPositions: Map<string, { x: number; y: number; element: HTMLElement }>;
  } | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      // ✅ Allow drag from anywhere on the element, EXCEPT:
      // - Interactive buttons (action bar, resize handles)
      // - Text editor when editing
      const target = e.target as HTMLElement;

      // Don't drag if clicking on interactive elements
      if (
        target.closest('button') ||
        target.closest('[data-resize-handle]') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[data-variable-dropdown="true"]') ||
        isEditing
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const element = ref.current;
      if (!element) return;

      const store = useDesignerStore.getState();
      const currentZoom = store.zoom;

      // ✅ Multi-select drag: if this element is part of selection, drag all selected
      // If clicking on unselected element, just drag this one (and select it)
      const isPartOfSelection = store.selectedComponentIds.includes(component.id);
      let idsToDrag: string[];

      if (isPartOfSelection) {
        // Already selected - drag all selected items
        idsToDrag = store.selectedComponentIds;
      } else {
        // Not selected - select it first, then drag just this one
        store.selectComponent(component.id);
        idsToDrag = [component.id];
      }

      // Collect initial positions
      const initialPositions = new Map<string, { x: number; y: number; element: HTMLElement }>();

      for (const dragId of idsToDrag) {
        const dragEl = document.querySelector<HTMLDivElement>(`[data-component-id="${dragId}"]`);
        if (!dragEl) continue;

        // Get position from schema
        const pos = getComponentPosition(dragId, store.schema);
        if (pos) {
          initialPositions.set(dragId, { x: pos.x, y: pos.y, element: dragEl });
        }
      }

      // Calculate grab offset in mm for accurate dropping
      const rect = element.getBoundingClientRect();
      const grabXpx = (e.clientX - rect.left) / currentZoom;
      const grabYpx = (e.clientY - rect.top) / currentZoom;

      dragStateRef.current = {
        isActive: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        primaryId: component.id,
        grabOffsetXmm: LayoutEngine.pxToMm(grabXpx),
        grabOffsetYmm: LayoutEngine.pxToMm(grabYpx),
        initialPositions,
      };

      // Add high z-index to source page wrapper so it's not covered by other pages during drag
      const pageWrapper = element.closest('[data-page-wrapper]');
      if (pageWrapper) {
        pageWrapper.classList.add('is-drag-source');
      }

      // Store original zone info for cross-zone detection
      const originalZone = {
        zoneKey: zoneKey,
        pageId: pageId,
      };

      store.setDragState({ isDragging: true, draggedComponentId: component.id });
      document.body.classList.add('is-dragging-components');

      // Promote dragged elements to GPU layer once, before first move frame.
      for (const [, pos] of initialPositions) {
        pos.element.style.willChange = 'transform';
        pos.element.style.transition = 'none';
      }

      let rafId: number | null = null;

      const onPointerMove = (event: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (!dragState?.isActive) return;

        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const dx = event.clientX - dragState.startX;
          const dy = event.clientY - dragState.startY;
          const tx = dx / currentZoom;
          const ty = dy / currentZoom;

          for (const [, pos] of dragState.initialPositions) {
            pos.element.style.transform = `translate(${tx}px, ${ty}px)`;
          }
        });
      };

      const onPointerUp = (event: PointerEvent) => {
        const dragState = dragStateRef.current;
        if (!dragState || event.pointerId !== dragState.pointerId) return;

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }

        const { startX, startY, initialPositions } = dragState;

        // ✅ Detect target zone or page for drop
        let targetZone = detectZoneAtPoint(event.clientX, event.clientY);

        // If no specific zone, try to find the page under the cursor
        if (!targetZone) {
          const elementsUnderPoint = document.elementsFromPoint(event.clientX, event.clientY);
          const paperContainer = elementsUnderPoint.find((el) =>
            el.hasAttribute('data-paper-container')
          );
          if (paperContainer) {
            targetZone = {
              zoneKey: 'body',
              pageId: paperContainer.getAttribute('data-page-id') || undefined,
              element: paperContainer as HTMLElement,
              rect: paperContainer.getBoundingClientRect(),
            };
          }
        }

        const isCrossZone = targetZone && isDifferentZone(originalZone, targetZone);

        if (targetZone) {
          const { grabOffsetXmm, grabOffsetYmm, initialPositions, primaryId } = dragState;
          const target = targetZone; // Const reference for TypeScript narrowing

          // 1. Calculate the new position of the PRIMARY element using the target page's coordinate system
          // This handles gaps between pages and separate containers correctly.
          const dragOffsetXpx = LayoutEngine.mmToPx(grabOffsetXmm) * currentZoom;
          const dragOffsetYpx = LayoutEngine.mmToPx(grabOffsetYmm) * currentZoom;

          const primaryPos = LayoutEngine.calculateAbsolutePosition(
            event.clientX,
            event.clientY,
            dragOffsetXpx,
            dragOffsetYpx,
            target.pageId
          );

          // Get the base mm offset of the target zone on the target page
          const dstZoneOffset = LayoutEngine.calculateZoneOffset(
            target.zoneKey,
            store.schema,
            target.pageId
          );

          // Calculate final X/Y relative to the target zone
          const finalPrimaryX = primaryPos.x;
          const finalPrimaryY = Math.max(0, primaryPos.rawY - dstZoneOffset);

          // 2. Move all elements based on the primary element's new position
          const primaryInitial = initialPositions.get(primaryId);

          for (const [dragId, pos] of initialPositions) {
            const compData = getComponentById(dragId, store.schema);
            if (!compData) continue;

            // Calculate this element's position relative to the primary element
            const relX = primaryInitial ? pos.x - primaryInitial.x : 0;
            const relY = primaryInitial ? pos.y - primaryInitial.y : 0;

            const newX = finalPrimaryX + relX;
            const newY = finalPrimaryY + relY;

            if (isCrossZone) {
              // Cross-zone move
              let targetZoneLength = 0;
              if (target.zoneKey === 'body' && target.pageId) {
                targetZoneLength =
                  store.schema.pages.find((p) => p.id === target.pageId)?.body.components.length ||
                  0;
              } else if (target.zoneKey !== 'body') {
                targetZoneLength =
                  (store.schema.zones as any)[target.zoneKey]?.components?.length || 0;
              }

              store.moveComponent(
                dragId,
                compData.zoneKey as 'header' | 'body' | 'footer',
                target.zoneKey as 'header' | 'body' | 'footer',
                targetZoneLength,
                newX,
                newY,
                compData.pageId || null,
                target.pageId || null,
                false,
                undefined,
                target.groupId
              );
            } else {
              // Same zone move - just update position
              store.updateComponent(dragId, { x: newX, y: newY });
            }

            pos.element.style.transform = '';
            pos.element.style.willChange = '';
            pos.element.style.transition = '';
          }
        } else {
          // Fallback to delta if no target page detected
          const visualDeltaX = event.clientX - startX;
          const visualDeltaY = event.clientY - startY;
          const deltaXmm = LayoutEngine.pxToMm(visualDeltaX / currentZoom);
          const deltaYmm = LayoutEngine.pxToMm(visualDeltaY / currentZoom);

          for (const [dragId, pos] of initialPositions) {
            const newX = pos.x + deltaXmm;
            const newY = pos.y + deltaYmm;
            store.updateComponent(dragId, { x: newX, y: newY });
            pos.element.style.transform = '';
            pos.element.style.willChange = '';
            pos.element.style.transition = '';
          }
        }

        // Cleanup
        const element = ref.current;
        const pageWrapper = element?.closest('[data-page-wrapper]');
        if (pageWrapper) {
          pageWrapper.classList.remove('is-drag-source');
        }

        dragStateRef.current = null;
        document.body.classList.remove('is-dragging-components');

        store.setDragState({ isDragging: false, draggedComponentId: null });

        // Remove global listeners
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    },
    [component.id, isEditing, zoneKey, pageId]
  );

  // ✅ Attach pointer events directly to the element for drag-anywhere
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('pointerdown', startDrag as unknown as EventListener);

    return () => {
      element.removeEventListener('pointerdown', startDrag as unknown as EventListener);
    };
  }, [startDrag]);

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

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (
        !target ||
        target.closest?.('[data-variable-dropdown="true"]') ||
        target.parentElement?.classList.contains('z-50') ||
        target.parentElement?.parentElement?.classList.contains('z-50')
      ) {
        return;
      }

      if (
        editorContainerRef.current &&
        !editorContainerRef.current.contains(target) &&
        !dragHandleRef.current?.contains(target)
      ) {
        setIsEditing(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing]);

  const { localBounds, isResizing, handleResizeStart, syncBounds } = useResizable(
    {
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: component.height || 20,
    },
    (finalBounds) => {
      updateComponent(component.id, finalBounds);
    }
  );

  useEffect(() => {
    syncBounds({
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: component.height || 20,
    });
  }, [component.x, component.y, component.width, component.height, syncBounds]);

  // ✅ Check if this component is currently being dragged
  const isMoving =
    dragStateRef.current?.isActive &&
    (dragStateRef.current.primaryId === component.id ||
      selectedIds.includes(dragStateRef.current.primaryId));

  const handleDuplicate = useCallback(
    (_e: React.MouseEvent) => {
      addComponent(
        zoneKey,
        {
          ...component,
          id: Math.random().toString(36).substring(7),
          x: (component.x || 0) + 10,
          y: (component.y || 0) + 10,
        },
        pageId
      );
    },
    [addComponent, component, zoneKey, pageId]
  );

  const x = LayoutEngine.mmToPx(localBounds.x);
  const y = LayoutEngine.mmToPx(localBounds.y);
  const width = LayoutEngine.mmToPx(localBounds.width);
  const height = LayoutEngine.mmToPx(localBounds.height);

  return (
    <div
      ref={ref}
      data-component-id={component.id}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectComponent(component.id);
        }
      }}
      // biome-ignore lint/a11y/useSemanticElements: Div needed for absolute positioning with child interactive elements
      tabIndex={0}
      role="button"
      aria-label={`Component ${component.type} ${component.name || ''}`}
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
        // ✅ Transform is applied directly via DOM during drag
        willChange: isMoving ? 'transform' : 'auto',
        zIndex: isMoving ? 100 : 10,
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden || (isLocked && !isMoving) ? 'none' : 'auto',
      }}
      data-designer-component
      className={clsx(
        'transition-none cursor-default select-none group focus:outline-none high-perf-gpu',
        isSelected
          ? clsx(
              'z-50 ring-2 ring-[var(--accent)] ring-inset shadow-md',
              component.type === 'text' ? 'bg-white/[0.02]' : 'bg-white/10'
            )
          : clsx(
              'z-10 ring-inset hover:ring-1 hover:ring-white/20',
              component.type === 'text' ? 'bg-transparent' : 'bg-white/5 hover:bg-white/10'
            ),
        isSelected && !isLocked && 'z-[100]',
        isMoving && 'is-moving z-[100] ring-2 ring-[var(--accent)] shadow-lg pointer-events-none',
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
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
          style={{
            display: 'flex',
            alignItems: (component.style as any)?.verticalAlign || 'flex-start',
            justifyContent:
              component.align === 'center'
                ? 'center'
                : component.align === 'right'
                  ? 'flex-end'
                  : component.align === 'justify'
                    ? 'flex-start'
                    : 'flex-start',
          }}
        >
          <TextEditor
            value={component.content || ''}
            onChange={handleTextChange}
            sampleData={sampleData}
            className="w-full h-full"
            placeholder=""
            inline={true}
            textStyle={component.style}
            style={{
              textAlign: component.align === 'justify' ? 'left' : component.align || 'left',
              color: '#1e293b',
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
          className={clsx(
            'absolute -top-7 right-0 flex items-center bg-[var(--accent)] border border-[var(--border-accent)] rounded-md px-0.5 h-6.5 shadow-sm transition-opacity duration-200',
            !isSelected || dragStateRef.current?.isActive || selectedIds.length > 1
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          )}
        >
          <div
            ref={dragHandleRef}
            data-drag-handle="true"
            className="p-1 hover:bg-white/10 text-white cursor-grab active:cursor-grabbing border-r border-white/10"
          >
            <GripVertical className="w-3 h-3" />
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              bringToFront(component.id);
            }}
            className="p-1 hover:bg-white/10 text-white border-r border-white/10"
            title="Bring to Front"
          >
            <ChevronLast className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveUp(component.id);
            }}
            className="p-1 hover:bg-white/10 text-white border-r border-white/10"
            title="Bring Forward"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              moveDown(component.id);
            }}
            className="p-1 hover:bg-white/10 text-white border-r border-white/10"
            title="Send Backward"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sendToBack(component.id);
            }}
            className="p-1 hover:bg-white/10 text-white border-r border-white/10"
            title="Send to Back"
          >
            <ChevronFirst className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleDuplicate}
            className="p-1 hover:bg-white/10 text-white border-r border-white/10"
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedIds.length > 1) {
                removeComponents(selectedIds);
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
          <ComponentPreview component={component} pageIndex={pageIndex} totalPages={totalPages} />
        </div>
      )}

      {/* Resizing Handles */}
      {isSelected &&
        !isLocked &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            data-resize-handle="true"
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

// ✅ Helper: Get component position from schema
function getComponentPosition(id: string, schema: any): { x: number; y: number } | null {
  // Check global zones
  for (const zKey of ['header', 'footer'] as const) {
    const found = schema.zones[zKey].components.find((c: any) => c.id === id);
    if (found) return { x: found.x || 0, y: found.y || 0 };
  }

  // Check pages
  for (const page of schema.pages) {
    const found = page.body.components.find((c: any) => c.id === id);
    if (found) return { x: found.x || 0, y: found.y || 0 };
  }

  return null;
}

// ✅ Helper: Get full component data from schema
function getComponentById(
  id: string,
  schema: any
): { component: any; zoneKey: string; pageId?: string } | null {
  // Check global zones
  for (const zKey of ['header', 'footer'] as const) {
    const found = schema.zones[zKey].components.find((c: any) => c.id === id);
    if (found) return { component: found, zoneKey: zKey };
  }

  // Check pages
  for (const page of schema.pages) {
    const found = page.body.components.find((c: any) => c.id === id);
    if (found) return { component: found, zoneKey: 'body', pageId: page.id };
  }

  return null;
}

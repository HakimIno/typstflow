'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { TextComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { detectZoneAtPoint, isDifferentZone } from '@/lib/utils/zone-detector';
import { ComponentPreview } from '../component-preview';
import { ActionBar } from './ActionBar';
import { EditorOverlay } from './EditorOverlay';
import { ResizeHandles } from './ResizeHandles';
import { getComponentById, getComponentPosition } from './utils';

interface Props {
  componentId: string;
  zoneKey: 'header' | 'body' | 'footer';
  pageId?: string;
  pageIndex?: number;
  layoutType?: 'absolute' | 'flow';
}

export const ComponentWrapper = memo(function ComponentWrapper({
  componentId,
  zoneKey,
  pageId,
  pageIndex = 0,
  layoutType = 'absolute',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // ✅ High-Performance Granular Subscription
  const component = useDesignerStore((s) => s.componentRegistry[componentId]);

  const { isSelected, selectedIds, isHidden, isLocked, totalPages, sampleData } = useDesignerStore(
    useShallow((s) => ({
      isSelected: s.selectedComponentIds.includes(componentId),
      selectedIds: s.selectedComponentIds,
      isHidden: s.hiddenComponentIds.includes(componentId),
      isLocked: s.lockedComponentIds.includes(componentId),
      totalPages: s.schema.pages.length,
      sampleData: s.sampleData,
    }))
  );

  // If component was deleted but React hasn't unmounted this wrapper yet
  if (!component) return null;

  const selectComponent = useDesignerStore((s) => s.selectComponent);
  const toggleComponentSelection = useDesignerStore((s) => s.toggleComponentSelection);
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const addComponent = useDesignerStore((s) => s.addComponent);

  const [isEditing, setIsEditing] = useState(false);

  const dragStateRef = useRef<{
    isActive: boolean;
    startX: number;
    startY: number;
    pointerId: number;
    primaryId: string;
    grabOffsetXmm: number;
    grabOffsetYmm: number;
    hasStartedDrag: boolean;
    initialPositions: Map<string, { x: number; y: number; element: HTMLElement }>;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.closest('button') ||
        target.closest('[data-resize-handle]') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[data-variable-dropdown="true"]') ||
        isEditing
      ) {
        return;
      }

      e.stopPropagation();

      const element = ref.current;
      if (!element) return;

      const store = useDesignerStore.getState();
      const currentZoom = store.zoom;

      const isPartOfSelection = store.selectedComponentIds.includes(componentId);
      let idsToDrag: string[];

      if (isPartOfSelection) {
        idsToDrag = store.selectedComponentIds;
      } else {
        store.selectComponent(componentId);
        idsToDrag = [componentId];
      }

      const initialPositions = new Map<string, { x: number; y: number; element: HTMLElement }>();

      for (const dragId of idsToDrag) {
        const dragEl = document.querySelector<HTMLDivElement>(`[data-component-id="${dragId}"]`);
        if (!dragEl) continue;

        const pos = getComponentPosition(dragId, store.schema);
        if (pos) {
          initialPositions.set(dragId, { x: pos.x, y: pos.y, element: dragEl });
        }
      }

      const rect = element.getBoundingClientRect();
      const grabXpx = (e.clientX - rect.left) / currentZoom;
      const grabYpx = (e.clientY - rect.top) / currentZoom;

      dragStateRef.current = {
        isActive: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        primaryId: componentId,
        grabOffsetXmm: LayoutEngine.pxToMm(grabXpx),
        grabOffsetYmm: LayoutEngine.pxToMm(grabYpx),
        hasStartedDrag: false,
        initialPositions,
      };

      const pageWrapper = element.closest('[data-page-wrapper]');
      if (pageWrapper) {
        pageWrapper.classList.add('is-drag-source');
      }

      const originalZone = { zoneKey, pageId };

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

          if (!dragState.hasStartedDrag) {
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
              dragState.hasStartedDrag = true;
              store.setDragState({ isDragging: true, draggedComponentId: componentId });
              document.body.classList.add('is-dragging-components');
            } else {
              return;
            }
          }

          const tx = dx / currentZoom;
          const ty = dy / currentZoom;

          for (const [, pos] of dragState.initialPositions) {
            pos.element.style.transform = `translate(${tx}px, ${ty}px)`;
          }

          // Sync SelectionToolbar in the same rAF frame — no store round-trip needed
          const toolbar = document.querySelector<HTMLElement>('[data-toolbar="true"]');
          if (toolbar) {
            toolbar.style.setProperty('--toolbar-drag-dx', `${tx}px`);
            toolbar.style.setProperty('--toolbar-drag-dy', `${ty}px`);
          }

          // Update store for other UI elements (like SelectionToolbar) to follow
          store.setDragState({
            isDragging: true,
            currentX: tx,
            currentY: ty
          });
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
        let targetZone = detectZoneAtPoint(event.clientX, event.clientY);

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
          const target = targetZone;

          const dragOffsetXpx = LayoutEngine.mmToPx(grabOffsetXmm) * currentZoom;
          const dragOffsetYpx = LayoutEngine.mmToPx(grabOffsetYmm) * currentZoom;

          const primaryPos = LayoutEngine.calculateAbsolutePosition(
            event.clientX,
            event.clientY,
            dragOffsetXpx,
            dragOffsetYpx,
            target.pageId
          );

          const dstZoneOffset = LayoutEngine.calculateZoneOffset(
            target.zoneKey,
            store.schema,
            target.pageId
          );

          const finalPrimaryX = primaryPos.x;
          const finalPrimaryY = Math.max(0, primaryPos.rawY - dstZoneOffset);
          const primaryInitial = initialPositions.get(primaryId);

          for (const [dragId, pos] of initialPositions) {
            const compData = getComponentById(dragId, store.schema);
            if (!compData) continue;

            const relX = primaryInitial ? pos.x - primaryInitial.x : 0;
            const relY = primaryInitial ? pos.y - primaryInitial.y : 0;

            const newX = finalPrimaryX + relX;
            const newY = finalPrimaryY + relY;

            if (isCrossZone) {
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
              store.updateComponent(dragId, { x: newX, y: newY });
            }

            pos.element.style.transform = '';
            pos.element.style.willChange = '';
            pos.element.style.transition = '';
          }
        } else {
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

        const pageWrapper = ref.current?.closest('[data-page-wrapper]');
        if (pageWrapper) {
          pageWrapper.classList.remove('is-drag-source');
        }

        dragStateRef.current = null;
        document.body.classList.remove('is-dragging-components');
        store.setDragState({ isDragging: false, draggedComponentId: null, currentX: 0, currentY: 0 });

        const toolbar = document.querySelector<HTMLElement>('[data-toolbar="true"]');
        if (toolbar) {
          toolbar.style.removeProperty('--toolbar-drag-dx');
          toolbar.style.removeProperty('--toolbar-drag-dy');
        }

        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    },
    [componentId, isEditing, zoneKey, pageId]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (component.type === 'text') {
        e.stopPropagation();
        setIsEditing(true);
        selectComponent(componentId);
      }
    },
    [componentId, component.type, selectComponent]
  );

  const handleTextChange = useCallback(
    (value: string) => {
      updateComponent(componentId, { content: value });
    },
    [componentId, updateComponent]
  );

  const handleExitEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isEditing) {
        if (e.shiftKey) {
          toggleComponentSelection(componentId);
        } else {
          selectComponent(componentId);
        }
      }
    },
    [componentId, isEditing, selectComponent, toggleComponentSelection]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectComponent(componentId);
      }
    },
    [componentId, selectComponent]
  );

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target) return;

      // Tippy suggestion popup is appended to body — don't close editor when clicking it
      if (target.closest?.('.tippy-box') || target.closest?.('.tippy-content')) return;

      if (
        target.closest?.('[data-variable-dropdown="true"]') ||
        target.parentElement?.classList.contains('z-50') ||
        target.parentElement?.parentElement?.classList.contains('z-50')
      ) {
        return;
      }

      if (
        editorContainerRef.current &&
        !editorContainerRef.current.contains(target)
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

  const zoom = useDesignerStore((s) => s.zoom);
  const { localBounds, isResizing, handleResizeStart, syncBounds } = useResizable(
    {
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: typeof component.height === 'number' ? component.height : 20,
    },
    (finalBounds) => {
      updateComponent(componentId, finalBounds);
    },
    zoom
  );

  useEffect(() => {
    syncBounds({
      x: component.x || 0,
      y: component.y || 0,
      width: component.width || 100,
      height: typeof component.height === 'number' ? component.height : 20,
    });
  }, [component.x, component.y, component.width, component.height, syncBounds]);

  const isMoving =
    dragStateRef.current?.isActive &&
    dragStateRef.current?.hasStartedDrag &&
    (dragStateRef.current.primaryId === componentId ||
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

  const { x, y, width, height } = useMemo(() => {
    return {
      x: LayoutEngine.mmToPx(localBounds.x),
      y: LayoutEngine.mmToPx(localBounds.y),
      width: LayoutEngine.mmToPx(localBounds.width),
      height: LayoutEngine.mmToPx(localBounds.height),
    };
  }, [localBounds.x, localBounds.y, localBounds.width, localBounds.height]);

  const containerStyle = useMemo(
    () => ({
      position: layoutType === 'flow' ? ('relative' as const) : ('absolute' as const),
      top: layoutType === 'flow' ? 'auto' : `${y}px`,
      left: layoutType === 'flow' ? 'auto' : `${x}px`,
      marginLeft: layoutType === 'flow' ? `${x}px` : 'auto',
      width: `${width}px`,
      height: layoutType === 'flow' && (component.type === 'table' || component.type === 'repeater' || component.height === 'auto') 
        ? 'auto' 
        : `${height}px`,
      minHeight: layoutType === 'flow' ? '10px' : 'auto',
      outline: 'none',
      boxSizing: 'border-box' as const,
      willChange: isMoving ? 'transform' : ('auto' as const),
      zIndex: isMoving ? 100 : 10,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden || (isLocked && !isMoving) ? ('none' as const) : ('auto' as const),
    }),
    [x, y, width, height, isMoving, isHidden, isLocked, layoutType, component.type, component.height]
  );

  const containerClassName = useMemo(
    () =>
      clsx(
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
        isMoving && 'is-moving z-[100] ring-2 ring-[var(--accent)] shadow-lg',
        isResizing && 'ring-2 ring-[var(--accent)] shadow-lg z-[100]'
      ),
    [isSelected, isLocked, isMoving, isResizing, component.type]
  );

  return (
    <div
      ref={ref}
      data-component-id={componentId}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      style={containerStyle}
      data-designer-component
      className={containerClassName}
    >
      {isLocked && (
        <div className="absolute -top-2 -left-2 z-[70] bg-orange-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
          <Lock className="w-2.5 h-2.5" />
        </div>
      )}

      {isEditing && component.type === 'text' && (
        <EditorOverlay
          component={component as TextComponent}
          sampleData={sampleData}
          handleTextChange={handleTextChange}
          handleExitEdit={handleExitEdit}
          editorContainerRef={editorContainerRef}
        />
      )}

      {!isLocked && (
        <ActionBar
          component={component}
          isSelected={isSelected}
          selectedIds={selectedIds}
          isDragging={!!dragStateRef.current?.isActive}
          handleDuplicate={handleDuplicate}
        />
      )}

      {!isEditing && (
        <div ref={previewRef} className="w-full h-full relative pointer-events-none">
          <ComponentPreview component={component} pageIndex={pageIndex} totalPages={totalPages} />
        </div>
      )}

      {isSelected && !isLocked && <ResizeHandles onResizeStart={handleResizeStart} />}
    </div>
  );
});

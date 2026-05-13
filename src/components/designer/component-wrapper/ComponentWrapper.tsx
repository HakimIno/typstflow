'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TextComponent, ZoneKey } from '@/types/schema';
import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { detectZoneAtPoint, isDifferentZone } from '@/lib/utils/zone-detector';
import { SnapEngine } from '@/lib/engine/snap-engine';
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
  flowMode?: boolean;
}

export const ComponentWrapper = memo(function ComponentWrapper({
  componentId,
  zoneKey,
  pageId,
  pageIndex = 0,
  flowMode = false,
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
  const moveUp = useDesignerStore((s) => s.moveUp);
  const moveDown = useDesignerStore((s) => s.moveDown);

  const handleFlowIndentLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateComponent(componentId, { x: Math.max(0, (component?.x ?? 0) - 5) });
  }, [componentId, component?.x, updateComponent]);

  const handleFlowIndentRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateComponent(componentId, { x: (component?.x ?? 0) + 5 });
  }, [componentId, component?.x, updateComponent]);

  const [isEditing, setIsEditing] = useState(false);

  // ── Flow-mode drag-to-reorder state (must be declared unconditionally) ──────
  const flowDragRef = useRef<{
    startY: number;
    pointerId: number;
    lastIndex: number;
    myIndex: number;
  } | null>(null);
  const [flowDragging, setFlowDragging] = useState(false);
  const [flowDeltaY, setFlowDeltaY] = useState(0);

  const handleFlowPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('[contenteditable="true"]') ||
      target.closest('[data-variable-dropdown="true"]') ||
      isEditing
    ) return;

    e.stopPropagation();
    selectComponent(componentId);

    const zoneContent = (e.currentTarget as HTMLElement).closest('[data-zone-key]');
    if (!zoneContent) return;
    const sibs = Array.from(zoneContent.querySelectorAll<HTMLElement>('[data-component-id]'));
    const myIndex = sibs.findIndex((el) => el.dataset.componentId === componentId);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    flowDragRef.current = { startY: e.clientY, pointerId: e.pointerId, lastIndex: myIndex, myIndex };
    setFlowDragging(true);
    setFlowDeltaY(0);
  }, [componentId, isEditing, selectComponent]);

  const handleFlowPointerMove = useCallback((e: React.PointerEvent) => {
    const state = flowDragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    setFlowDeltaY(e.clientY - state.startY);

    const zoneContent = (e.currentTarget as HTMLElement).closest('[data-zone-key]');
    if (!zoneContent) return;
    const sibs = Array.from(zoneContent.querySelectorAll<HTMLElement>('[data-component-id]'));
    for (let i = 0; i < sibs.length; i++) {
      const r = sibs[i].getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { state.lastIndex = i; break; }
    }
  }, []);

  const handleFlowPointerUp = useCallback((e: React.PointerEvent) => {
    const state = flowDragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    flowDragRef.current = null;
    setFlowDragging(false);
    setFlowDeltaY(0);

    const diff = state.lastIndex - state.myIndex;
    if (diff === 0) return;
    const steps = Math.abs(diff);
    const store = useDesignerStore.getState();
    // In flow zone: lower array index = higher on page.
    // store.moveUp  = swap with [idx+1] = increases index = moves DOWN visually.
    // store.moveDown = swap with [idx-1] = decreases index = moves UP visually.
    // So dragged DOWN (diff>0 → higher lastIndex) → call moveUp to increase index.
    //    dragged UP  (diff<0 → lower lastIndex)  → call moveDown to decrease index.
    for (let i = 0; i < steps; i++) {
      diff > 0 ? store.moveUp(componentId) : store.moveDown(componentId);
    }
  }, [componentId]);
  // ── End flow-mode state ──────────────────────────────────────────────────────

  const dragStateRef = useRef<{
    isActive: boolean;
    startX: number;
    startY: number;
    pointerId: number;
    primaryId: string;
    grabOffsetXmm: number;
    grabOffsetYmm: number;
    hasStartedDrag: boolean;
    initialPositions: Map<string, { x: number; y: number; absY: number; element: HTMLElement }>;
    snapTargets: { x: number; y: number; width: number; height: number }[];
    primaryCompWidth: number;
    primaryCompHeight: number;
    lastSnappedX: number;
    lastSnappedY: number;
    activePageId: string | null;
    // Cached at drag-start to avoid per-frame DOM queries
    paperContainerEl: HTMLElement | null;
    scrollParentEl: HTMLElement | null;
    dragOffsetXpx: number;
    dragOffsetYpx: number;
    // Snap throttling — only recalculate when mouse moves > SNAP_THRESHOLD_PX
    lastSnapClientX: number;
    lastSnapClientY: number;
    lastSnap: { x: number; y: number; guides: { vertical: number[]; horizontal: number[] } } | null;
    lastSpacingIndicators: any[] | null;
    cachedSnapPoints?: { x: any[]; y: any[] };
    // Absolute page y at drag start = zone-local y + zone offset (avoids coordinate mismatch with snap.y)
    initialAbsoluteY: number;
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

      const initialPositions = new Map<string, { x: number; y: number; absY: number; element: HTMLElement }>();

      for (const dragId of idsToDrag) {
        const dragEl = document.querySelector<HTMLDivElement>(`[data-component-id="${dragId}"]`);
        if (!dragEl) continue;

        const pos = getComponentPosition(dragId, store.schema);
        const zoneInfo = getComponentById(dragId, store.schema);
        if (pos && zoneInfo) {
          const zoneOffset = LayoutEngine.calculateZoneOffset(zoneInfo.zoneKey as any, store.schema, zoneInfo.pageId);
          initialPositions.set(dragId, {
            x: pos.x,
            y: pos.y,
            absY: pos.y + zoneOffset,
            element: dragEl
          });
        }
      }

      const rect = element.getBoundingClientRect();
      const grabXpx = (e.clientX - rect.left) / currentZoom;
      const grabYpx = (e.clientY - rect.top) / currentZoom;

      const snapTargets: { x: number; y: number; width: number; height: number }[] = [];
      const targetPageId = pageId || store.schema.pages[0]?.id;
      const page = store.schema.pages.find((p) => p.id === targetPageId);
      if (page) {
        const bodyOffset = LayoutEngine.calculateZoneOffset('body', store.schema, targetPageId);
        for (const c of page.body.components) {
          if (!idsToDrag.includes(c.id)) {
            snapTargets.push({
              x: c.x || 0,
              y: (c.y || 0) + bodyOffset,
              width: c.width || 40,
              height: c.height || 10,
            });
          }
        }
        const hOffset = LayoutEngine.calculateZoneOffset('header', store.schema, targetPageId);
        for (const c of store.schema.zones.header.components) {
          if (!idsToDrag.includes(c.id)) {
            snapTargets.push({ x: c.x || 0, y: (c.y || 0) + hOffset, width: c.width || 40, height: c.height || 10 });
          }
        }
        const fOffset = LayoutEngine.calculateZoneOffset('footer', store.schema, targetPageId);
        for (const c of store.schema.zones.footer.components) {
          if (!idsToDrag.includes(c.id)) {
            snapTargets.push({ x: c.x || 0, y: (c.y || 0) + fOffset, width: c.width || 40, height: c.height || 10 });
          }
        }

        const { width: pW, height: pH } = getPaperDimensions(store.schema.page.size, store.schema.page.orientation);
        const mT = parseTypstUnit(store.schema.page.margin.top);
        const mB = parseTypstUnit(store.schema.page.margin.bottom);
        const mL = parseTypstUnit(store.schema.page.margin.left);
        const mR = parseTypstUnit(store.schema.page.margin.right);

        // Margin target
        snapTargets.push({ x: mL, y: mT, width: pW - mL - mR, height: pH - mT - mB });
        // Page edges
        snapTargets.push({ x: 0, y: 0, width: pW, height: pH });
      }

      const grabOffsetXmm = LayoutEngine.pxToMm(grabXpx);
      const grabOffsetYmm = LayoutEngine.pxToMm(grabYpx);
      const cachedDragOffsetXpx = LayoutEngine.mmToPx(grabOffsetXmm) * currentZoom;
      const cachedDragOffsetYpx = LayoutEngine.mmToPx(grabOffsetYmm) * currentZoom;

      // targetPageId is already declared above (used for snap targets)
      const paperContainerEl = document.querySelector<HTMLElement>(
        targetPageId
          ? `[data-paper-container][data-page-id="${targetPageId}"]`
          : '[data-paper-container]'
      );
      const scrollParentEl = paperContainerEl?.closest<HTMLElement>('.overflow-auto') ?? null;

      const zoneOffset = LayoutEngine.calculateZoneOffset(zoneKey, store.schema, pageId);
      dragStateRef.current = {
        isActive: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        primaryId: componentId,
        grabOffsetXmm,
        grabOffsetYmm,
        hasStartedDrag: false,
        initialPositions,
        snapTargets,
        primaryCompWidth: component.width || 40,
        primaryCompHeight: component.height || 10,
        lastSnappedX: component.x || 0,
        lastSnappedY: (component.y || 0) + zoneOffset,
        activePageId: pageId || null,
        paperContainerEl: paperContainerEl ?? null,
        scrollParentEl,
        dragOffsetXpx: cachedDragOffsetXpx,
        dragOffsetYpx: cachedDragOffsetYpx,
        lastSnapClientX: e.clientX,
        lastSnapClientY: e.clientY,
        lastSnap: null,
        lastSpacingIndicators: null,
        cachedSnapPoints: SnapEngine.generateSnapPoints(store.schema, store.selectedComponentIds, pageId || undefined),
        initialAbsoluteY: (component.y || 0) + zoneOffset,
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

      // Minimum mouse movement (px) before recalculating snap — avoids O(n) work on micro-movements
      const SNAP_THRESHOLD_PX = 2;

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

          // --- Dynamic Page & Snap Point Management ---
          const viewportX = event.clientX;
          const viewportY = event.clientY;

          // Check if we crossed into a new page
          let detectedPageId = dragState.activePageId;
          const paperAtPoint = document.elementFromPoint(viewportX, viewportY)?.closest<HTMLElement>('[data-paper-container]');
          if (paperAtPoint) {
            const newPageId = paperAtPoint.getAttribute('data-page-id');
            if (newPageId && newPageId !== dragState.activePageId) {
              detectedPageId = newPageId;
              dragState.activePageId = newPageId;
              dragState.paperContainerEl = paperAtPoint;
              dragState.scrollParentEl = paperAtPoint.closest<HTMLElement>('.overflow-auto');
              // Refresh snap points for the new page context
              dragState.cachedSnapPoints = SnapEngine.generateSnapPoints(store.schema, componentId, newPageId);
            }
          }

          if (!dragState.cachedSnapPoints) {
            dragState.cachedSnapPoints = SnapEngine.generateSnapPoints(store.schema, componentId, dragState.activePageId || undefined);
          }

          // Use cached element refs — avoids document.querySelector on every frame
          const currentPos = dragState.paperContainerEl
            ? LayoutEngine.calculateAbsolutePositionWithElement(
              viewportX,
              viewportY,
              dragState.dragOffsetXpx,
              dragState.dragOffsetYpx,
              dragState.paperContainerEl,
              dragState.scrollParentEl
            )
            : LayoutEngine.calculateAbsolutePosition(
              viewportX,
              viewportY,
              dragState.dragOffsetXpx,
              dragState.dragOffsetYpx,
              dragState.activePageId || undefined
            );

          const paperRect = dragState.paperContainerEl?.getBoundingClientRect();
          const pageIndex = dragState.activePageId ? store.schema.pages.findIndex(p => p.id === dragState.activePageId) : 0;
          const { height: pageHeight } = getPaperDimensions(store.schema.page.size, store.schema.page.orientation);
          const pageAbsOffsetMM = pageIndex * pageHeight;

          // Standardized to absolute document-space (mm)
          const absRawX = currentPos.rawX;
          const absRawY = currentPos.rawY + pageAbsOffsetMM;

          // Only recalculate snap when mouse moved enough — avoids O(n) work on micro-movements
          const movedForSnap =
            Math.abs(viewportX - dragState.lastSnapClientX) > SNAP_THRESHOLD_PX ||
            Math.abs(viewportY - dragState.lastSnapClientY) > SNAP_THRESHOLD_PX;

          let snap = dragState.lastSnap;
          if (movedForSnap || !snap) {
            const selectedIds = store.selectedComponentIds;
            const snapResult = SnapEngine.calculateSnap(
              absRawX,
              absRawY,
              dragState.primaryCompWidth,
              dragState.primaryCompHeight,
              selectedIds,
              store.schema,
              event.altKey,
              dragState.activePageId || undefined,
              dragState.cachedSnapPoints
            );

            // Map SnapEngine.SnapResult to our expected format
            snap = {
              x: snapResult.snappedX,
              y: snapResult.snappedY,
              guides: {
                vertical: snapResult.activeGuidesX,
                horizontal: snapResult.activeGuidesY
              }
            };

            dragState.lastSnap = snap;
            dragState.lastSpacingIndicators = snapResult.spacingIndicators;
            dragState.lastSnapClientX = viewportX;
            dragState.lastSnapClientY = viewportY;
          }

          dragState.lastSnappedX = snap.x;
          dragState.lastSnappedY = snap.y;

          const primaryInitial = dragState.initialPositions.get(componentId);
          if (!primaryInitial) return;

          // dx, dy in mm (absolute document space)
          const dxMM = snap.x - primaryInitial.x;
          const dyMM = snap.y - primaryInitial.absY;

          // Convert MM delta to screen PX delta for DOM transform
          const tx = LayoutEngine.mmToPx(dxMM) / currentZoom;
          const ty = LayoutEngine.mmToPx(dyMM) / currentZoom;

          for (const [, pos] of dragState.initialPositions) {
            pos.element.style.transform = `translate(${tx}px, ${ty}px)`;
          }

          // Sync SelectionToolbar via CSS variable — also needs zoom compensation for the vars
          const toolbar = document.querySelector<HTMLElement>('[data-toolbar="true"]');
          if (toolbar) {
            toolbar.style.setProperty('--toolbar-drag-dx', `${tx * currentZoom}px`);
            toolbar.style.setProperty('--toolbar-drag-dy', `${ty * currentZoom}px`);
          }

          // Single store update per frame (Standardized to absolute mm!)
          store.setDragState({
            isDragging: true,
            currentX: snap.x,
            currentY: snap.y,
            lastSnappedX: snap.x,
            lastSnappedY: snap.y,
            activeGuides: snap.guides,
            spacingIndicators: dragState.lastSpacingIndicators || [],
            activePageId: dragState.activePageId
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

        const { startX, startY, initialPositions, hasStartedDrag } = dragState;
        
        if (hasStartedDrag) {
          const store = useDesignerStore.getState();
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
            const { lastSnappedX, lastSnappedY } = dragState;

            const dstZoneOffset = LayoutEngine.calculateZoneOffset(
              targetZone.zoneKey,
              store.schema,
              targetZone.pageId
            );

            // Calculate the document-absolute delta (mm)
            const dxMM = lastSnappedX - (initialPositions.get(componentId)?.x || 0);
            const dyMM = lastSnappedY - (initialPositions.get(componentId)?.absY || 0);

            const updatesMap: Record<string, Partial<ComponentNode>> = {};
            const moves: any[] = [];

            for (const [dragId, pos] of initialPositions) {
              const compData = getComponentById(dragId, store.schema);
              if (!compData) continue;

              // Calculate new absolute document-space coordinates
              const newAbsX = pos.x + dxMM;
              const newAbsY = pos.absY + dyMM;

              // Convert back to zone-local for store
              const newX = newAbsX;
              const newY = Math.max(0, newAbsY - dstZoneOffset);

              const compIsCrossZone = targetZone && isDifferentZone({
                zoneKey: compData.zoneKey as ZoneKey,
                pageId: compData.pageId,
                groupId: compData.groupId,
                groupType: compData.groupType as any
              }, targetZone);

              if (compIsCrossZone) {
                moves.push({
                  id: dragId,
                  fromZone: compData.zoneKey as any,
                  toZone: targetZone.zoneKey as any,
                  newIndex: -1, // Append to end of zone
                  x: newX,
                  y: newY,
                  fromPageId: compData.pageId || null,
                  toPageId: targetZone.pageId || null,
                  fromGroupId: compData.groupId,
                  toGroupId: targetZone.groupId,
                  fromGroupType: compData.groupType as any,
                  toGroupType: targetZone.groupType
                });
              } else {
                updatesMap[dragId] = { x: newX, y: newY };
              }

              // Cleanup visuals
              pos.element.style.transform = '';
              pos.element.style.willChange = '';
              pos.element.style.transition = '';
            }

            // Apply atomic updates
            store.batchApplyDrag(updatesMap, moves);
          } else {
            // Fallback if no target zone detected
            const visualDeltaX = event.clientX - startX;
            const visualDeltaY = event.clientY - startY;
            const deltaXmm = LayoutEngine.pxToMm(visualDeltaX / currentZoom);
            const deltaYmm = LayoutEngine.pxToMm(visualDeltaY / currentZoom);

            const updatesMap: Record<string, Partial<ComponentNode>> = {};
            for (const [dragId, pos] of initialPositions) {
              updatesMap[dragId] = {
                x: pos.x + deltaXmm,
                y: pos.y + deltaYmm
              };
              pos.element.style.transform = '';
              pos.element.style.willChange = '';
              pos.element.style.transition = '';
            }
            store.batchApplyDrag(updatesMap, []);
          }
        } else {
          // Cleanup visuals even if no drag happened
          for (const [, pos] of initialPositions) {
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
        store.setDragState({
          isDragging: false,
          draggedComponentId: null,
          currentX: 0,
          currentY: 0,
          activeGuides: { vertical: [], horizontal: [] },
          spacingIndicators: [],
        });

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
      height: component.height || 20,
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
      height: component.height || 20,
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
      position: 'absolute' as const,
      top: `${y}px`,
      left: `${x}px`,
      width: `${width}px`,
      height: `${height}px`,
      outline: 'none',
      boxSizing: 'border-box' as const,
      willChange: isMoving ? 'transform' : ('auto' as const),
      zIndex: isMoving ? 100 : 10,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden || (isLocked && !isMoving) ? ('none' as const) : ('auto' as const),
    }),
    [x, y, width, height, isMoving, isHidden, isLocked]
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

  // Flow mode: render as block in document flow (no absolute positioning).
  // Drag-to-reorder: dragging vertically swaps the component with its neighbours.
  // x coordinate = left indent (via marginLeft in designer, #pad(left:xmm) in Typst output).
  if (flowMode) {
    const flowHeight = LayoutEngine.mmToPx(component.height || 20);
    const flowWidth = component.width ? `${LayoutEngine.mmToPx(component.width)}px` : '100%';
    const flowXPx = LayoutEngine.mmToPx(component.x || 0);
    const componentX = Math.round(component.x || 0);

    return (
      <div
        data-component-id={componentId}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handleFlowPointerDown}
        onPointerMove={handleFlowPointerMove}
        onPointerUp={handleFlowPointerUp}
        onPointerCancel={handleFlowPointerUp}
        data-designer-component
        className={clsx(
          'relative select-none group focus:outline-none rounded touch-none',
          flowDragging ? 'cursor-grabbing z-50 opacity-80 ring-2 ring-[var(--accent)] shadow-xl' : 'cursor-grab',
          isSelected
            ? 'ring-2 ring-[var(--accent)] ring-inset shadow-md bg-white/10'
            : 'ring-inset hover:ring-1 hover:ring-white/20 bg-white/5 hover:bg-white/10',
          isHidden && 'opacity-40',
          'transition-shadow'
        )}
        style={{
          width: flowWidth,
          minHeight: `${flowHeight}px`,
          height: component.type === 'image' && component.height ? `${LayoutEngine.mmToPx(component.height)}px` : undefined,
          marginLeft: `${flowXPx}px`,
          marginTop: `${LayoutEngine.mmToPx(component.y || 0)}px`,
          opacity: isHidden ? 0.4 : 1,
          transform: flowDragging ? `translateY(${flowDeltaY}px)` : undefined,
          transition: flowDragging ? 'none' : 'transform 0.15s ease',
        }}
      >
        {!isLocked && (
          <ActionBar
            component={component}
            isSelected={isSelected}
            selectedIds={selectedIds}
            isDragging={flowDragging}
            flowMode={true}
            handleDuplicate={handleDuplicate}
            handleFlowIndentLeft={handleFlowIndentLeft}
            handleFlowIndentRight={handleFlowIndentRight}
          />
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

        <div ref={previewRef} className="w-full h-full relative pointer-events-none" style={{ minHeight: `${flowHeight}px` }}>
          <ComponentPreview component={component} pageIndex={pageIndex} totalPages={totalPages} />
        </div>
      </div>
    );
  }

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

'use client';

import { useDesignerStore } from '@/store/designer-store';
import type { ComponentNode, TextComponent, ZoneKey } from '@/types/schema';
import { clsx } from 'clsx';
import { Lock } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useResizable } from '@/hooks/use-resizable';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import {
  SNAP_PAGE_RADIUS,
  calculateComponentSnap,
  getSnapPageRange,
  loadWasmSnapNodes,
  reloadWasmSnapNodes,
  toPageLocalGuides,
  toPageLocalSpacingIndicators,
} from '@/lib/engine/wasm-snap';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { detectZoneAtPoint, isDifferentZone } from '@/lib/utils/zone-detector';
import { type ZoneLayoutCache, getZoneLayoutCache } from '@/lib/utils/zone-layout';
import type { WasmLayoutEngine } from '@/lib/wasm-layout-engine';
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
  isNested?: boolean;
}

export const ComponentWrapper = memo(function ComponentWrapper({
  componentId,
  zoneKey,
  pageId,
  pageIndex = 0,
  flowMode = false,
  isNested = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // ✅ Per-primitive selectors — each returns a scalar so Zustand only re-renders
  // when THIS component's specific state changes, not on every selection event.
  const component = useDesignerStore((s) => s.componentRegistry[componentId]);
  const isSelected = useDesignerStore((s) => s.selectedComponentIds.includes(componentId));
  const selectedCount = useDesignerStore((s) => s.selectedComponentIds.length);
  const isHidden = useDesignerStore((s) => s.hiddenComponentIds.includes(componentId));
  const isLocked = useDesignerStore((s) => s.lockedComponentIds.includes(componentId));
  const tableSheetEditId = useDesignerStore((s) => s.tableSheetEditId);
  const isTableSheetMode = component?.type === 'table' && tableSheetEditId === componentId;
  const totalPages = useDesignerStore((s) => s.schema.pages.length);
  const sampleData = useDesignerStore((s) => s.sampleData);

  // If component was deleted but React hasn't unmounted this wrapper yet
  if (!component) return null;

  const selectComponent = useDesignerStore((s) => s.selectComponent);
  const toggleComponentSelection = useDesignerStore((s) => s.toggleComponentSelection);
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const addComponent = useDesignerStore((s) => s.addComponent);

  const handleFlowIndentLeft = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateComponent(componentId, { x: Math.max(0, (component?.x ?? 0) - 5) });
    },
    [componentId, component?.x, updateComponent]
  );

  const handleFlowIndentRight = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateComponent(componentId, { x: (component?.x ?? 0) + 5 });
    },
    [componentId, component?.x, updateComponent]
  );

  const [isEditing, setIsEditing] = useState(false);

  // ── Flow-mode drag state (must be declared unconditionally) ─────────────────
  // Uses direct DOM transform (no useState for deltas) → zero React re-renders during drag → no bounce.
  const flowDragRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number;
    initialXmm: number;
  } | null>(null);
  const [flowDragging, setFlowDragging] = useState(false);

  const handleFlowPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('[data-resize-handle]') ||
        target.closest('[data-col-splitter]') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[data-variable-dropdown="true"]') ||
        target.closest('[data-toolbar="true"]') ||
        isEditing ||
        (isSelected &&
          component.type === 'table' &&
          (target.closest('td') ||
            target.closest('th') ||
            target.closest('.cursor-col-resize') ||
            target.closest('.cursor-row-resize')))
      )
        return;

      e.stopPropagation();
      selectComponent(componentId);

      const comp = useDesignerStore.getState().componentRegistry[componentId];
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      flowDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        initialXmm: comp?.x ?? 0,
      };
      setFlowDragging(true);
    },
    [componentId, isEditing, selectComponent, isSelected, component.type]
  );

  const handleFlowPointerMove = useCallback((e: React.PointerEvent) => {
    const state = flowDragRef.current;
    if (!state || e.pointerId !== state.pointerId) return;
    const zoom = useDesignerStore.getState().zoom;
    const dx = (e.clientX - state.startX) / zoom;
    const dy = (e.clientY - state.startY) / zoom;
    // Apply transform directly — no React state → no re-render → no bounce
    if (ref.current) {
      ref.current.style.transform = `translate(${dx}px, ${dy}px)`;
      ref.current.style.zIndex = '50';
    }
    window.dispatchEvent(
      new CustomEvent('flow-drag-move', { detail: { clientX: e.clientX, clientY: e.clientY } })
    );
  }, []);

  const handleFlowPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = flowDragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      flowDragRef.current = null;

      // Clear DOM transforms immediately — no transition, no bounce
      if (ref.current) {
        ref.current.style.transform = '';
        ref.current.style.zIndex = '';
      }
      setFlowDragging(false);
      window.dispatchEvent(new CustomEvent('flow-drag-end'));

      const zoom = useDesignerStore.getState().zoom;
      const dxMm = LayoutEngine.pxToMm((e.clientX - state.startX) / zoom);
      const newX = Math.max(0, state.initialXmm + dxMm);
      useDesignerStore.getState().updateComponent(componentId, { x: Math.round(newX * 10) / 10 });
    },
    [componentId]
  );
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
    wasmEngine: WasmLayoutEngine | null;
    zoneLayoutCache: ZoneLayoutCache;
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
    // Absolute page y at drag start = zone-local y + zone offset (avoids coordinate mismatch with snap.y)
    initialAbsoluteY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.closest('button') ||
        target.closest('[data-resize-handle]') ||
        target.closest('[data-col-splitter]') ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[data-variable-dropdown="true"]') ||
        target.closest('[data-toolbar="true"]') ||
        isEditing ||
        (isSelected &&
          component.type === 'table' &&
          (target.closest('td') ||
            target.closest('th') ||
            target.closest('.cursor-col-resize') ||
            target.closest('.cursor-row-resize')))
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

      const { height: pH } = getPaperDimensions(
        store.schema.page.size,
        store.schema.page.orientation
      );

      const initialPositions = new Map<
        string,
        { x: number; y: number; absY: number; element: HTMLElement }
      >();

      for (const dragId of idsToDrag) {
        const dragEl = document.querySelector<HTMLDivElement>(`[data-component-id="${dragId}"]`);
        if (!dragEl) continue;

        const pos = getComponentPosition(dragId, store.schema);
        const zoneInfo = getComponentById(dragId, store.schema);
        if (pos && zoneInfo) {
          const zoneOffset = LayoutEngine.calculateZoneOffset(
            zoneInfo.zoneKey as any,
            store.schema,
            zoneInfo.pageId
          );
          // Include the page's absolute offset so absY matches the document-absolute
          // coordinate space used by onPointerMove (rawY + pageIndex * pageHeight).
          const srcPageIdx = zoneInfo.pageId
            ? store.schema.pages.findIndex((p) => p.id === zoneInfo.pageId)
            : 0;
          const srcPageAbsOffset = Math.max(0, srcPageIdx) * pH;
          initialPositions.set(dragId, {
            x: pos.x,
            y: pos.y,
            absY: pos.y + zoneOffset + srcPageAbsOffset,
            element: dragEl,
          });
        }
      }

      const rect = element.getBoundingClientRect();
      const grabXpx = (e.clientX - rect.left) / currentZoom;
      const grabYpx = (e.clientY - rect.top) / currentZoom;

      const grabOffsetXmm = LayoutEngine.pxToMm(grabXpx);
      const grabOffsetYmm = LayoutEngine.pxToMm(grabYpx);
      const cachedDragOffsetXpx = LayoutEngine.mmToPx(grabOffsetXmm) * currentZoom;
      const cachedDragOffsetYpx = LayoutEngine.mmToPx(grabOffsetYmm) * currentZoom;

      // targetPageId is already declared above (used for snap targets)
      const targetPageId = pageId || store.schema.pages[0]?.id;
      const paperContainerEl = document.querySelector<HTMLElement>(
        targetPageId
          ? `[data-paper-container][data-page-id="${targetPageId}"]`
          : '[data-paper-container]'
      );
      const scrollParentEl = paperContainerEl?.closest<HTMLElement>('.overflow-auto') ?? null;

      const zoneLayoutCache = getZoneLayoutCache(store.schema);
      const zoneOffset = zoneLayoutCache.getZoneOffset(zoneKey, pageId);
      const primaryPageAbsOffset = zoneLayoutCache.getPageAbsOffsetMm(pageId);
      const primaryPageIdx = zoneLayoutCache.getPageIndex(pageId);
      const { pageStartIdx, pageEndIdx } = getSnapPageRange(
        primaryPageIdx,
        store.schema.pages.length,
        SNAP_PAGE_RADIUS
      );

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
        wasmEngine: null,
        zoneLayoutCache,
        primaryCompWidth: component.width || 40,
        primaryCompHeight: component.height || 10,
        lastSnappedX: component.x || 0,
        lastSnappedY: (component.y || 0) + zoneOffset + primaryPageAbsOffset,
        activePageId: pageId || null,
        paperContainerEl: paperContainerEl ?? null,
        scrollParentEl,
        dragOffsetXpx: cachedDragOffsetXpx,
        dragOffsetYpx: cachedDragOffsetYpx,
        lastSnapClientX: e.clientX,
        lastSnapClientY: e.clientY,
        lastSnap: null,
        lastSpacingIndicators: null,
        initialAbsoluteY: (component.y || 0) + zoneOffset + primaryPageAbsOffset,
      };

      loadWasmSnapNodes(store.schema, {
        excludeIds: idsToDrag,
        pageStartIdx,
        pageEndIdx,
        manualGuides: store.manualGuides,
        zoneLayout: zoneLayoutCache,
      })
        .then((engine) => {
          if (dragStateRef.current?.isActive) {
            dragStateRef.current.wasmEngine = engine;
          }
        })
        .catch(() => {});

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
          let _detectedPageId = dragState.activePageId;
          const paperAtPoint = document
            .elementFromPoint(viewportX, viewportY)
            ?.closest<HTMLElement>('[data-paper-container]');
          if (paperAtPoint) {
            const newPageId = paperAtPoint.getAttribute('data-page-id');
            if (newPageId && newPageId !== dragState.activePageId) {
              _detectedPageId = newPageId;
              dragState.activePageId = newPageId;
              dragState.paperContainerEl = paperAtPoint;
              dragState.scrollParentEl = paperAtPoint.closest<HTMLElement>('.overflow-auto');

              if (dragState.wasmEngine) {
                const newPageIdx = dragState.zoneLayoutCache.getPageIndex(newPageId);
                const { pageStartIdx, pageEndIdx } = getSnapPageRange(
                  newPageIdx,
                  store.schema.pages.length,
                  SNAP_PAGE_RADIUS
                );
                void reloadWasmSnapNodes(dragState.wasmEngine, store.schema, {
                  excludeIds: store.selectedComponentIds,
                  pageStartIdx,
                  pageEndIdx,
                  manualGuides: store.manualGuides,
                  zoneLayout: dragState.zoneLayoutCache,
                }).catch(() => {});
              }
            }
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

          const pageAbsOffsetMM = dragState.zoneLayoutCache.getPageAbsOffsetMm(
            dragState.activePageId || undefined
          );

          // Standardized to absolute document-space (mm)
          const absRawX = currentPos.rawX;
          const absRawY = currentPos.rawY + pageAbsOffsetMM;

          // Only recalculate snap when mouse moved enough — avoids O(n) work on micro-movements
          const movedForSnap =
            Math.abs(viewportX - dragState.lastSnapClientX) > SNAP_THRESHOLD_PX ||
            Math.abs(viewportY - dragState.lastSnapClientY) > SNAP_THRESHOLD_PX;

          let snap = dragState.lastSnap;
          if (movedForSnap || !snap) {
            if (dragState.wasmEngine) {
              const snapResult = calculateComponentSnap(
                dragState.wasmEngine,
                componentId,
                absRawX,
                absRawY,
                dragState.primaryCompWidth,
                dragState.primaryCompHeight,
                event.altKey,
                dragState.activePageId || undefined
              );

              snap = {
                x: snapResult.snappedX,
                y: snapResult.snappedY,
                guides: {
                  vertical: snapResult.activeGuidesX,
                  horizontal: snapResult.activeGuidesY,
                },
              };

              dragState.lastSpacingIndicators = snapResult.spacingIndicators;
            } else {
              snap = {
                x: absRawX,
                y: absRawY,
                guides: { vertical: [], horizontal: [] },
              };
              dragState.lastSpacingIndicators = [];
            }

            dragState.lastSnap = snap;
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

          const pageLocalGuides = toPageLocalGuides(
            snap.guides.vertical,
            snap.guides.horizontal,
            pageAbsOffsetMM
          );
          const pageLocalSpacing = toPageLocalSpacingIndicators(
            dragState.lastSpacingIndicators || [],
            pageAbsOffsetMM
          );

          // Single store update per frame (Standardized to absolute mm!)
          store.setDragState({
            isDragging: true,
            currentX: snap.x,
            currentY: snap.y,
            lastSnappedX: snap.x,
            lastSnappedY: snap.y,
            activeGuides: pageLocalGuides,
            spacingIndicators: pageLocalSpacing,
            activePageId: dragState.activePageId,
          });
          // Broadcast position so flow-mode zones can show row highlight
          window.dispatchEvent(
            new CustomEvent('flow-drag-move', {
              detail: { clientX: event.clientX, clientY: event.clientY },
            })
          );
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

          const _isCrossZone = targetZone && isDifferentZone(originalZone, targetZone);
          if (targetZone) {
            const tz = targetZone;
            const { lastSnappedX, lastSnappedY } = dragState;

            const dstZoneOffset = dragState.zoneLayoutCache.getZoneOffset(tz.zoneKey, tz.pageId);
            const dstPageAbsOffset = dragState.zoneLayoutCache.getPageAbsOffsetMm(tz.pageId);

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

              // Convert back to zone-local for store (strip zone offset and page offset)
              const newX = newAbsX;
              const newY = Math.max(0, newAbsY - dstZoneOffset - dstPageAbsOffset);

              const compIsCrossZone =
                tz &&
                isDifferentZone(
                  {
                    zoneKey: compData.zoneKey as ZoneKey,
                    pageId: compData.pageId,
                    groupId: compData.groupId,
                    groupType: compData.groupType as any,
                  },
                  tz
                );

              if (compIsCrossZone) {
                moves.push({
                  id: dragId,
                  fromZone: compData.zoneKey as any,
                  toZone: tz.zoneKey as any,
                  newIndex: -1, // Append to end of zone
                  x: newX,
                  y: newY,
                  fromPageId: compData.pageId || null,
                  toPageId: tz.pageId || null,
                  fromGroupId: compData.groupId,
                  toGroupId: tz.groupId,
                  fromGroupType: compData.groupType as any,
                  toGroupType: tz.groupType,
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
                y: pos.y + deltaYmm,
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

        window.dispatchEvent(new CustomEvent('flow-drag-end'));
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    },
    [
      componentId,
      isEditing,
      zoneKey,
      pageId,
      isSelected,
      component.type,
      component.x,
      component.y,
      component.width,
      component.height,
    ]
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
        const target = e.target as HTMLElement;
        // A selected table's cell stops click via its own onClick handler, but guard here
        // too so selectComponent (which clears selectedCell) never fires from a cell click.
        if (
          isSelected &&
          component.type === 'table' &&
          (target.closest('td') || target.closest('th'))
        )
          return;

        if (e.shiftKey) {
          toggleComponentSelection(componentId);
        } else {
          selectComponent(componentId);
        }
      }
    },
    [componentId, isEditing, isSelected, component.type, selectComponent, toggleComponentSelection]
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

      // Ignore clicks on designer UI elements (sidebars, panels, toolbar)
      if (
        target.closest('aside') ||
        target.closest('[data-designer-ui="true"]') ||
        target.closest('[data-toolbar="true"]')
      ) {
        return;
      }

      if (editorContainerRef.current && !editorContainerRef.current.contains(target)) {
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

  // Auto-measure height for text components in flow mode.
  // ResizeObserver fires whenever content reflows (text edit, width resize, font change).
  // Updates store with measured mm height (skipHistory) so drop-slot positions stay accurate.
  const isTextInFlow = flowMode && component.type === 'text';
  useEffect(() => {
    if (!isTextInFlow || !ref.current) return;
    const el = ref.current;
    let rafId: number;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const heightPx = entry.contentRect.height;
        if (heightPx <= 0) return;
        const heightMm = Math.round(LayoutEngine.pxToMm(heightPx) * 10) / 10;
        const current = useDesignerStore.getState().componentRegistry[componentId]?.height;
        if (current === undefined || Math.abs(heightMm - current) > 0.3) {
          useDesignerStore.getState().updateComponent(componentId, { height: heightMm }, true);
        }
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [isTextInFlow, componentId]);

  const isMoving =
    dragStateRef.current?.isActive &&
    dragStateRef.current?.hasStartedDrag &&
    (dragStateRef.current.primaryId === componentId || isSelected);

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
      zIndex: isMoving || isResizing ? 100 : isSelected ? 50 : 10,
      opacity: isHidden ? 0 : 1,
      pointerEvents: isHidden || (isLocked && !isMoving) ? ('none' as const) : ('auto' as const),
    }),
    [x, y, width, height, isMoving, isResizing, isSelected, isHidden, isLocked]
  );

  const containerClassName = useMemo(
    () =>
      clsx(
        'transition-none cursor-default select-none group focus:outline-none high-perf-gpu',
        isSelected
          ? clsx(
              component.type === 'table'
                ? isTableSheetMode
                  ? 'z-50 ring-0'
                  : 'z-50 ring-1 ring-[var(--accent)]/40 ring-inset'
                : 'z-50 ring-2 ring-[var(--accent)] ring-inset shadow-md',
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
    [isSelected, isLocked, isMoving, isResizing, component.type, isTableSheetMode]
  );

  // Flow mode: render as block in document flow (no absolute positioning).
  // Flow mode: elements stack in flex-col order (array position = visual order).
  // Uses localBounds so resize updates are reflected live without store commits.
  // x value = left indentation via marginLeft.
  // Text components use height:auto so content drives height (ResizeObserver syncs back to store).
  if (flowMode) {
    const flowXPx = isNested ? 0 : LayoutEngine.mmToPx(localBounds.x);
    const flowWidthPx = LayoutEngine.mmToPx(localBounds.width);
    const flowHeightPx = LayoutEngine.mmToPx(localBounds.height);
    // Dynamic components in flow mode: auto-height so content expands naturally
    const autoHeight =
      component.type === 'text' ||
      component.type === 'table' ||
      component.type === 'repeater' ||
      component.type === 'columns' ||
      component.type === 'summary-box' ||
      component.type === 'checklist';

    return (
      <div
        ref={ref}
        data-component-id={componentId}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handleFlowPointerDown}
        onPointerMove={handleFlowPointerMove}
        onPointerUp={handleFlowPointerUp}
        onPointerCancel={handleFlowPointerUp}
        data-designer-component
        data-columns-layout={component.type === 'columns' ? 'true' : undefined}
        className={clsx(
          'relative select-none group focus:outline-none touch-none transition-shadow',
          flowDragging
            ? 'cursor-grabbing opacity-80 ring-2 ring-[var(--accent)] shadow-xl'
            : 'cursor-grab',
          isSelected && !flowDragging
            ? component.type === 'table'
              ? 'ring-1 ring-[var(--accent)]/50 ring-inset bg-white/5'
              : 'ring-2 ring-[var(--accent)] ring-inset shadow-md bg-white/10'
            : !flowDragging &&
                'ring-inset hover:ring-1 hover:ring-white/20 bg-white/5 hover:bg-white/10',
          isHidden && 'opacity-40'
        )}
        style={{
          width: isNested ? '100%' : `${flowWidthPx}px`,
          height: autoHeight ? 'auto' : `${flowHeightPx}px`,
          minHeight: autoHeight ? `${LayoutEngine.mmToPx(4)}px` : undefined,
          marginLeft: isNested ? undefined : `${flowXPx}px`,
          opacity: isHidden ? 0.4 : 1,
          willChange: 'transform',
          boxSizing: 'border-box',
          zIndex: flowDragging ? 100 : isSelected ? 50 : 10,
        }}
      >
        {!isLocked && (
          <ActionBar
            component={component}
            isSelected={isSelected}
            selectedCount={selectedCount}
            isDragging={flowDragging}
            flowMode={true}
            handleDuplicate={handleDuplicate}
            handleFlowIndentLeft={handleFlowIndentLeft}
            handleFlowIndentRight={handleFlowIndentRight}
          />
        )}

        {isSelected && !isLocked && !isTableSheetMode && (
          <ResizeHandles onResizeStart={handleResizeStart} />
        )}

        {isEditing && component.type === 'text' ? (
          <EditorOverlay
            component={component as TextComponent}
            sampleData={sampleData}
            handleTextChange={handleTextChange}
            handleExitEdit={handleExitEdit}
            editorContainerRef={editorContainerRef}
            autoHeight={autoHeight}
          />
        ) : (
          <div
            ref={previewRef}
            className={clsx(
              'w-full relative',
              component.type !== 'columns' &&
                !(isSelected && component.type === 'table') &&
                'pointer-events-none',
              !autoHeight && 'h-full'
            )}
          >
            <ComponentPreview
              component={component}
              pageIndex={pageIndex}
              totalPages={totalPages}
              autoHeight={autoHeight}
            />
          </div>
        )}
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
      data-columns-layout={component.type === 'columns' ? 'true' : undefined}
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
          selectedCount={selectedCount}
          isDragging={!!dragStateRef.current?.isActive}
          handleDuplicate={handleDuplicate}
        />
      )}

      {!isEditing && (
        <div
          ref={previewRef}
          className={clsx(
            'w-full h-full relative',
            component.type !== 'columns' &&
              !(isSelected && component.type === 'table') &&
              'pointer-events-none'
          )}
        >
          <ComponentPreview component={component} pageIndex={pageIndex} totalPages={totalPages} />
        </div>
      )}

      {isSelected && !isLocked && !isTableSheetMode && (
        <ResizeHandles onResizeStart={handleResizeStart} />
      )}
    </div>
  );
});

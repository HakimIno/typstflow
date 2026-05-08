'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DesignerPage } from './DesignerPage';
import { DragMonitor } from './DragMonitor';
import { Ruler } from './Ruler';
import { SelectionMarquee } from './SelectionMarquee';
import { SelectionToolbar } from './SelectionToolbar';
import { TransientOverlay } from './TransientOverlay';
import { Zone } from './Zone';
import { useCanvasZoom } from '@/hooks/use-canvas-zoom';

// Constants for virtualization
const VISIBLE_PAGE_BUFFER = 4; // Increased for smoothness
const PADDING_TOP_PX = 48; // pt-12 = 48px
const GAP_VERTICAL_LIST = 32; // gap-8 = 32px
const GAP_VERTICAL_GRID = 48; // gap-12 = 48px

export const Canvas = memo(function Canvas() {
  const pageSize = useDesignerStore((state) => state.schema.page.size);
  const pageOrientation = useDesignerStore((state) => state.schema.page.orientation);
  const zoom = useDesignerStore((state) => state.zoom);
  const activePageId = useDesignerStore((state) => state.activePageId);
  const canvasLayout = useDesignerStore((state) => state.canvasLayout);
  const isDraggingGlobal = useDesignerStore((state) => state.dragState.isDragging);
  const margin = useDesignerStore((state) => state.schema.page.margin);
  
  const pageIds = useDesignerStore(useShallow((state) => state.schema.pages.map((p) => p.id)));
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  // ✅ Virtualized page range - only render pages in visible range + buffer
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

  // ✅ High-performance Ctrl+Scroll / Pinch zoom
  useCanvasZoom(scrollRef);

  const updateScrollPos = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollTop } = scrollRef.current;
      setScrollPos({
        x: scrollLeft - 64,
        y: scrollTop - 48,
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    requestAnimationFrame(updateScrollPos);

    // ✅ Calculate visible page range (Binary search equivalent)
    if (scrollRef.current) {
      const { scrollTop, clientHeight } = scrollRef.current;
      const { height: pageHeightMm } = getPaperDimensions(
        pageSize,
        pageOrientation
      );
      const currentGap = (canvasLayout === 'grid' ? GAP_VERTICAL_GRID : GAP_VERTICAL_LIST) * zoom;
      const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm) * zoom;
      const totalPageHeight = pageHeightPx + currentGap;
      const pagesPerRow = canvasLayout === 'grid' ? 2 : 1;

      // Find first visible page (O(1) calculation instead of loop)
      const firstRowIdx = Math.floor((scrollTop - PADDING_TOP_PX) / totalPageHeight);
      const firstVisibleIdx = Math.max(
        0,
        firstRowIdx * pagesPerRow - VISIBLE_PAGE_BUFFER * pagesPerRow
      );

      // Find last visible page based on viewport height
      const lastRowIdx = Math.ceil((scrollTop + clientHeight - PADDING_TOP_PX) / totalPageHeight);
      const lastVisibleIdx = Math.min(
        pageIds.length - 1,
        (lastRowIdx + VISIBLE_PAGE_BUFFER) * pagesPerRow
      );

      setVisibleRange((prev) => {
        // Only update if range changed significantly
        if (prev.start !== firstVisibleIdx || prev.end !== lastVisibleIdx) {
          return { start: firstVisibleIdx, end: lastVisibleIdx };
        }
        return prev;
      });
    }
  }, [
    updateScrollPos,
    pageSize,
    pageOrientation,
    pageIds.length,
    zoom,
    canvasLayout,
  ]);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('resize', updateScrollPos);
    return () => {
      window.removeEventListener('resize', updateScrollPos);
    };
  }, [updateScrollPos]);

  useEffect(() => {
    const t = setTimeout(updateScrollPos, 50);
    return () => clearTimeout(t);
  }, [updateScrollPos]);

  // Recalculate visible range when zoom or page count changes
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    pageSize,
    pageOrientation
  );

  const currentGap = (canvasLayout === 'grid' ? GAP_VERTICAL_GRID : GAP_VERTICAL_LIST) * zoom;
  const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm);
  const totalPageHeight = pageHeightPx * zoom + currentGap;

  // ✅ Pre-calculate pages to render (memoized) - BEFORE early return to fix Hooks order
  const pagesToRender = useMemo(() => {
    if (!mounted) return [];
    return pageIds.slice(visibleRange.start, visibleRange.end + 1).map((id, offset) => ({
      pageId: id,
      pIdx: visibleRange.start + offset,
    }));
  }, [pageIds, visibleRange, mounted]);

  if (!mounted) return <div className="flex-1 flex flex-col bg-[var(--bg-canvas)]" />;

  const marginTop = parseTypstUnit(margin.top);
  const marginBottom = parseTypstUnit(margin.bottom);
  const marginLeft = parseTypstUnit(margin.left);
  const marginRight = parseTypstUnit(margin.right);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-[var(--bg-canvas)] contain-layout">
      <DragMonitor />
      <div className="flex-1 flex flex-col relative overflow-hidden transform-gpu">
        {/* Top Ruler Row */}
        <div className="flex h-6 bg-[var(--bg-surface)] border-b border-[var(--border-default)] relative z-30">
          <div className="w-6 h-6 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex-shrink-0" />
          <div className="flex-1 relative overflow-hidden">
            <Ruler
              orientation="horizontal"
              length={pageWidthMm}
              scrollPos={scrollPos.x}
              zoom={zoom}
            />
          </div>
        </div>

        <div className="flex flex-1 relative overflow-hidden">
          {/* Left Ruler Column */}
          <div className="w-6 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex-shrink-0 relative z-30 overflow-hidden">
            <Ruler
              orientation="vertical"
              length={pageHeightMm * pageIds.length + (pageIds.length - 1) * 12}
              scrollPos={scrollPos.y}
              zoom={zoom}
            />
          </div>

          {/* Professional Drafting Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={clsx(
              'flex-1 overflow-auto p-0 bg-[var(--bg-canvas-dots)]',
              isDraggingGlobal && 'is-dragging-components'
            )}
          >
            {/* ✅ Top spacer for virtualization */}
            {visibleRange.start > 0 && (
              <div
                style={{
                  height: `${Math.floor(visibleRange.start / (canvasLayout === 'grid' ? 2 : 1)) * totalPageHeight}px`,
                  width:
                    canvasLayout === 'grid'
                      ? `${LayoutEngine.mmToPx(pageWidthMm) * 2 * zoom + 32}px`
                      : `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
                }}
                className="shrink-0"
              />
            )}

            <div
              className={clsx(
                'min-h-max pl-16 pr-16 pb-24 pt-12 relative',
                canvasLayout === 'grid' ? 'grid' : 'flex flex-col items-start'
              )}
              style={{
                display: canvasLayout === 'grid' ? 'grid' : 'flex',
                gridTemplateColumns:
                  canvasLayout === 'grid'
                    ? `repeat(2, ${LayoutEngine.mmToPx(pageWidthMm) * zoom}px)`
                    : undefined,
                gap: `${currentGap}px ${canvasLayout === 'grid' ? 32 * zoom : 0}px`,
                width: 'fit-content',
              }}
            >
              <TransientOverlay />

              {pagesToRender.map(({ pageId, pIdx }) => {
                return (
                  <DesignerPage key={pageId} pageId={pageId} pIdx={pIdx} />
                );
              })}

              {/* Add Page Button */}
              <div
                className="flex justify-center pt-4"
                style={{ width: `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px` }}
              >
                <button
                  type="button"
                  onClick={() => useDesignerStore.getState().addPage()}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-dashed border-slate-400/40 bg-white/5 hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] text-slate-400 hover:text-[var(--accent)] transition-all shadow-sm group"
                  title="Add New Page"
                >
                  <Plus className="w-4 h-4 group-active:scale-90 transition-transform" />
                </button>
              </div>
            </div>

            {/* ✅ Bottom spacer for virtualization */}
            {visibleRange.end < pageIds.length - 1 && (
              <div
                style={{
                  height: `${Math.ceil((pageIds.length - 1 - visibleRange.end) / (canvasLayout === 'grid' ? 2 : 1)) * totalPageHeight}px`,
                  width:
                    canvasLayout === 'grid'
                      ? `${LayoutEngine.mmToPx(pageWidthMm) * 2 * zoom + 32}px`
                      : `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
                }}
                className="shrink-0"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

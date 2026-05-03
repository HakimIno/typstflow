'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DragMonitor } from './DragMonitor';
import { Ruler } from './Ruler';
import { SelectionMarquee } from './SelectionMarquee';
import { SelectionToolbar } from './SelectionToolbar';
import { TransientOverlay } from './TransientOverlay';
import { Zone } from './Zone';

// Constants for virtualization
const VISIBLE_PAGE_BUFFER = 3; // Render N pages before/after visible area
const PADDING_TOP_PX = 48;
const GAP_BETWEEN_PAGES_PX = 32;

export const Canvas = memo(function Canvas() {
  const schema = useDesignerStore((state) => state.schema);
  const zoom = useDesignerStore((state) => state.zoom);
  const activePageId = useDesignerStore((state) => state.activePageId);
  const setActivePage = useDesignerStore((state) => state.setActivePage);
  const isDraggingGlobal = useDesignerStore((state) => state.dragState.isDragging);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  // ✅ Virtualized page range - only render pages in visible range + buffer
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 });

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
        schema.page.size,
        schema.page.orientation
      );
      const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm) * zoom;
      const totalPageHeight = pageHeightPx + GAP_BETWEEN_PAGES_PX;

      // Find first visible page (O(1) calculation instead of loop)
      const firstVisibleIdx = Math.max(
        0,
        Math.floor((scrollTop - PADDING_TOP_PX) / totalPageHeight) - VISIBLE_PAGE_BUFFER
      );

      // Find last visible page based on viewport height
      const lastVisibleIdx = Math.min(
        schema.pages.length - 1,
        Math.ceil((scrollTop + clientHeight - PADDING_TOP_PX) / totalPageHeight) +
          VISIBLE_PAGE_BUFFER
      );

      setVisibleRange((prev) => {
        // Only update if range changed significantly
        if (prev.start !== firstVisibleIdx || prev.end !== lastVisibleIdx) {
          return { start: firstVisibleIdx, end: lastVisibleIdx };
        }
        return prev;
      });
    }
  }, [updateScrollPos, schema.page.size, schema.page.orientation, schema.pages.length, zoom]);

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
    schema.page.size,
    schema.page.orientation
  );

  const pageHeightPx = LayoutEngine.mmToPx(pageHeightMm);
  const totalPageHeight = pageHeightPx * zoom + GAP_BETWEEN_PAGES_PX;

  // ✅ Pre-calculate pages to render (memoized) - BEFORE early return to fix Hooks order
  const pagesToRender = useMemo(() => {
    if (!mounted) return [];
    // ✅ CRITICAL FIX: Don't use findIndex inside map - create a lookup map instead
    const pageIndices = new Map(schema.pages.map((p, idx) => [p.id, idx]));
    return schema.pages.slice(visibleRange.start, visibleRange.end + 1).map((page) => ({
      page,
      pIdx: pageIndices.get(page.id) ?? 0,
    }));
  }, [schema.pages, visibleRange, mounted]);

  if (!mounted) return <div className="flex-1 flex flex-col bg-[var(--bg-canvas)]" />;

  const marginTop = parseTypstUnit(schema.page.margin.top);
  const marginBottom = parseTypstUnit(schema.page.margin.bottom);
  const marginLeft = parseTypstUnit(schema.page.margin.left);
  const marginRight = parseTypstUnit(schema.page.margin.right);

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
              length={pageHeightMm * schema.pages.length + (schema.pages.length - 1) * 12}
              scrollPos={scrollPos.y}
              zoom={zoom}
            />
          </div>

          {/* Professional Drafting Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className={clsx(
              'flex-1 overflow-auto p-0 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform bg-[var(--bg-canvas-dots)]',
              isDraggingGlobal && 'is-dragging-components'
            )}
          >
            {/* ✅ Top spacer for virtualization */}
            {visibleRange.start > 0 && (
              <div
                style={{
                  height: `${visibleRange.start * totalPageHeight}px`,
                  width: `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
                }}
                className="shrink-0"
              />
            )}

            <div className="min-w-max min-h-max pl-16 pr-16 pb-24 pt-12 flex flex-col items-start gap-8 relative">
              <TransientOverlay />

              {pagesToRender.map(({ page, pIdx }) => {
                return (
                  <div
                    key={`wrapper-${page.id}`}
                    style={{
                      width: `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
                      height: `${LayoutEngine.mmToPx(pageHeightMm) * zoom}px`,
                    }}
                    className="relative group"
                  >
                    <div
                      ref={pIdx === 0 ? paperRef : null}
                      data-paper-container
                      data-page-id={page.id}
                      data-zoom={zoom}
                      onClick={() => setActivePage(page.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActivePage(page.id);
                        }
                      }}
                      // biome-ignore lint/a11y/useSemanticElements: Container div with child interactive elements
                      role="button"
                      tabIndex={0}
                      className={clsx(
                        'bg-white border border-slate-300 absolute top-0 left-0 shadow-2xl origin-top-left flex-shrink-0 rounded-[4px] contain-page high-perf-gpu',
                        !isDraggingGlobal && 'transition-all duration-300',
                        activePageId === page.id && 'ring-2 ring-[var(--accent)] ring-offset-2'
                      )}
                      style={{
                        width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                        height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
                        transform: `scale(${zoom})`,
                      }}
                    >
                      <div className="absolute -left-16 top-0 text-[10px] font-bold text-slate-400 opacity-60 uppercase tracking-widest pointer-events-none">
                        Page {pIdx + 1}
                      </div>

                      {/* Margin Guides */}
                      <div
                        className="absolute border border-[var(--accent)] border-dashed pointer-events-none z-10 opacity-30"
                        style={{
                          top: `${LayoutEngine.mmToPx(marginTop)}px`,
                          bottom: `${LayoutEngine.mmToPx(marginBottom)}px`,
                          left: `${LayoutEngine.mmToPx(marginLeft)}px`,
                          right: `${LayoutEngine.mmToPx(marginRight)}px`,
                        }}
                      />

                      <SelectionMarquee pageId={page.id} />
                      <SelectionToolbar pageId={page.id} />

                      <div className="flex flex-col gap-0 absolute inset-0 z-20">
                        {/* Only show header if it's repeated or if it's the first page */}
                        {(schema.zones.header.repeatOnEveryPage || pIdx === 0) && (
                          <Zone
                            zoneKey="header"
                            label={
                              schema.zones.header.repeatOnEveryPage
                                ? 'Global Header'
                                : 'Report Header'
                            }
                            components={schema.zones.header.components}
                            minHeight={schema.zones.header.minHeight}
                            resizeEdge="bottom"
                            pageIndex={pIdx}
                          />
                        )}

                        {/* Group Headers */}
                        {(schema.groups || []).map((group) => (
                          <Zone
                            key={`group-h-${group.id}`}
                            zoneKey="body"
                            label={`Group Header: ${group.name}`}
                            components={group.header.components}
                            pageId={page.id}
                            minHeight={group.header.minHeight}
                            resizeEdge="bottom"
                            pageIndex={pIdx}
                            isGroupBand
                            groupType="header"
                            groupId={group.id}
                          />
                        ))}

                        <Zone
                          zoneKey="body"
                          label="Detail Band"
                          components={page.body.components}
                          pageId={page.id}
                          minHeight={page.body.minHeight}
                          resizeEdge="none"
                          pageIndex={pIdx}
                        />

                        {/* Group Footers (Reverse order for nested feel) */}
                        {[...(schema.groups || [])].reverse().map((group) => (
                          <Zone
                            key={`group-f-${group.id}`}
                            zoneKey="body"
                            label={`Group Footer: ${group.name} (Summary)`}
                            components={group.footer.components}
                            pageId={page.id}
                            minHeight={group.footer.minHeight}
                            resizeEdge="top"
                            pageIndex={pIdx}
                            isGroupBand
                            groupType="footer"
                            groupId={group.id}
                          />
                        ))}

                        {/* Footer — shown on first page, or every page if repeatOnEveryPage */}
                        {(schema.zones.footer.repeatOnEveryPage || pIdx === 0) && (
                          <Zone
                            zoneKey="footer"
                            label={
                              schema.zones.footer.repeatOnEveryPage
                                ? 'Global Footer'
                                : 'Report Footer'
                            }
                            components={schema.zones.footer.components}
                            minHeight={schema.zones.footer.minHeight}
                            resizeEdge="top"
                            pageIndex={pIdx}
                          />
                        )}
                      </div>

                      {/* Remove Page Button */}
                      {schema.pages.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            useDesignerStore.getState().removePage(page.id);
                          }}
                          className="absolute -right-12 top-0 p-2 rounded-full shadow-md text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove Page"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
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
            {visibleRange.end < schema.pages.length - 1 && (
              <div
                style={{
                  height: `${(schema.pages.length - 1 - visibleRange.end) * totalPageHeight}px`,
                  width: `${LayoutEngine.mmToPx(pageWidthMm) * zoom}px`,
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

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualElements } from '@/hooks/use-virtual-elements';

import { DragMonitor } from './DragMonitor';
import { Ruler } from './Ruler';
import { SelectionMarquee } from './SelectionMarquee';
import { SelectionToolbar } from './SelectionToolbar';
import { TransientOverlay } from './TransientOverlay';
import { Zone } from './Zone';

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

  // ✅ visibleIds ตอนนี้เป็น Set<string> | null
  // null = ยังไม่คำนวณ → Zone จะ render ทุก element (ป้องกัน element หายตอน mount)
  const { visibleIds, visiblePageIds } = useVirtualElements(scrollRef, zoom, schema, activePageId);

  const updateScrollPos = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollTop } = scrollRef.current;
      setScrollPos({
        x: scrollLeft - 64,
        y: scrollTop - 48,
      });
    }
  }, []);

  const handleScroll = () => {
    requestAnimationFrame(updateScrollPos);
  };

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

  if (!mounted) return <div className="flex-1 flex flex-col bg-[var(--bg-canvas)]" />;

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(
    schema.page.size,
    schema.page.orientation
  );

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
            <div className="min-w-max min-h-max pl-16 pr-16 pb-24 pt-12 flex flex-col items-start gap-8 relative">
              <TransientOverlay />

              {(schema.pages || []).map((page, pIdx) => {
                // ✅ null = ยังไม่คำนวณ → show ทุก page
                // Set = คำนวณแล้ว → filter ตามปกติ
                const isPageVisible =
                  visiblePageIds === null || visiblePageIds.has(page.id);

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
                      {isPageVisible ? (
                        <>
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
                            <Zone
                              zoneKey="header"
                              label="Report Header"
                              components={schema.zones.header.components}
                              minHeight={schema.zones.header.minHeight}
                              resizeEdge="bottom"
                              visibleIds={visibleIds}
                              pageIndex={pIdx}
                            />

                            {/* Group Headers */}
                            {(schema.groups || []).map((group, gIdx) => (
                              <Zone
                                key={`group-h-${group.id}`}
                                zoneKey="body" // We use body logic for components but it's a separate zone in group
                                label={`Group Header: ${group.name}`}
                                components={group.header.components}
                                minHeight={group.header.minHeight}
                                resizeEdge="bottom"
                                visibleIds={visibleIds}
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
                              visibleIds={visibleIds}
                              pageIndex={pIdx}
                            />

                            {/* Group Footers (Reverse order for nested feel) */}
                            {[...(schema.groups || [])].reverse().map((group, gIdx) => (
                              <Zone
                                key={`group-f-${group.id}`}
                                zoneKey="body"
                                label={`Group Footer: ${group.name} (Summary)`}
                                components={group.footer.components}
                                minHeight={group.footer.minHeight}
                                resizeEdge="top"
                                visibleIds={visibleIds}
                                pageIndex={pIdx}
                                isGroupBand
                                groupType="footer"
                                groupId={group.id}
                              />
                            ))}

                            <Zone
                              zoneKey="footer"
                              label="Page Footer"
                              components={schema.zones.footer.components}
                              minHeight={schema.zones.footer.minHeight}
                              resizeEdge="top"
                              visibleIds={visibleIds}
                              pageIndex={pIdx}
                            />
                          </div>
                        </>
                      ) : (
                        // ✅ Placeholder ขนาดเท่ากัน เพื่อ scroll ไม่กระตุก
                        // ไม่ unmount เลย แค่ render div เปล่าแทน
                        <div
                          style={{
                            width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                            height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
                          }}
                        />
                      )}

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
          </div>
        </div>
      </div>
    </div>
  );
});
'use client';

import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import { parseTypstUnit } from '@/lib/utils/units';
import { clsx } from 'clsx';
import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { Zone } from './Zone';
import { Ruler } from './Ruler';
import { AlignmentGuides } from './AlignmentGuides';
import { SelectionMarquee } from './SelectionMarquee';
import { DragMonitor } from './DragMonitor';

export const Canvas = memo(function Canvas() {
  const schema = useDesignerStore((state) => state.schema);
  const isSidebarOpen = useDesignerStore((state) => state.isSidebarOpen);
  const viewMode = useDesignerStore((state) => state.viewMode);
  const zoom = useDesignerStore((state) => state.zoom);
  const isDraggingGlobal = useDesignerStore((state) => state.dragState.isDragging);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  const updateScrollPos = useCallback(() => {
    if (scrollRef.current && paperRef.current) {
      const scrollRect = scrollRef.current.getBoundingClientRect();
      const paperRect = paperRef.current.getBoundingClientRect();

      setScrollPos({
        x: scrollRect.left - paperRect.left,
        y: scrollRect.top - paperRect.top,
      });
    }
  }, []);

  const handleScroll = () => {
    updateScrollPos();
  };

  useEffect(() => {
    setMounted(true);
    // Initial measurement after a short delay to ensure layout is done
    const t = setTimeout(updateScrollPos, 50);
    window.addEventListener('resize', updateScrollPos);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateScrollPos);
    };
  }, [updateScrollPos, schema, zoom, isSidebarOpen, viewMode]);

  if (!mounted) return <div className="flex-1 flex flex-col bg-[var(--bg-canvas)]" />;

  const { width: pageWidthMm, height: pageHeightMm } = getPaperDimensions(schema.page.size, schema.page.orientation);

  // Calculate Margin Guides
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
              length={pageHeightMm}
              scrollPos={scrollPos.y}
              zoom={zoom}
            />
          </div>

          {/* Professional Drafting Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto p-0 transition-transform duration-[200ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform"
          >
            <div className="min-w-max min-h-max pl-12 pr-12 pb-12 pt-12">
              <div
                ref={paperRef}
                data-paper-container
                data-zoom={zoom}
                className={clsx(
                  'bg-white pro-grid border border-[var(--border-subtle)] relative shadow-2xl origin-top-left overflow-visible rounded-[4px]',
                  !isDraggingGlobal && 'transition-all duration-300'
                )}
                style={{
                  width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                  height: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
                  transform: `scale(${zoom})`,
                }}
              >
                {/* Page End Indicator (Red Dashed Line) */}
                <div
                  className="absolute left-0 right-0 border-b-2 border-red-500/40 border-dashed z-[35] pointer-events-none"
                  style={{ top: `${LayoutEngine.mmToPx(pageHeightMm)}px` }}
                >
                  <div className="absolute right-2 top-0 -translate-y-full bg-red-500 text-white text-[7px] px-1.5 py-0.5 font-black uppercase tracking-widest rounded-t-sm shadow-sm opacity-80 backdrop-blur-sm">
                    Physical Page Limit ({pageHeightMm}mm)
                  </div>
                </div>

                {/* Margin Guides (Dashed) */}
                <div
                  className="absolute border border-[var(--accent)] border-dashed pointer-events-none z-10 opacity-30"
                  style={{
                    top: `${LayoutEngine.mmToPx(marginTop)}px`,
                    bottom: `${LayoutEngine.mmToPx(marginBottom)}px`,
                    left: `${LayoutEngine.mmToPx(marginLeft)}px`,
                    right: `${LayoutEngine.mmToPx(marginRight)}px`,
                  }}
                />

                {/* Snapping Alignment Guides Overlay */}
                <AlignmentGuides />
                <SelectionMarquee />

                <div className="flex flex-col gap-0 relative z-20">
                  <Zone
                    zoneKey="header"
                    label="Report Header"
                    components={schema.zones.header.components}
                    minHeight={schema.zones.header.minHeight}
                  />
                  <Zone
                    zoneKey="body"
                    label="Detail Band"
                    components={schema.zones.body.components}
                    minHeight={schema.zones.body.minHeight}
                  />
                  <Zone
                    zoneKey="footer"
                    label="Page Footer"
                    components={schema.zones.footer.components}
                    minHeight={schema.zones.footer.minHeight}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

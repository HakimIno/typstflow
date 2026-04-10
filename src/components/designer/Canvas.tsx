'use client';

import { useDesignerStore } from '@/store/designer-store';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { parseTypstUnit } from '@/lib/utils/units';
import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Zone } from './Zone';
import { Ruler } from './Ruler';
import { AlignmentGuides } from './AlignmentGuides';
import { DragMonitor } from './DragMonitor';

export function Canvas() {
  const schema = useDesignerStore((state) => state.schema);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPos({
      x: e.currentTarget.scrollLeft,
      y: e.currentTarget.scrollTop,
    });
  };

  if (!mounted) return <div className="flex-1 flex flex-col bg-slate-200" />;

  const isLandscape = schema.page.orientation === 'landscape';
  const pageWidthMm = isLandscape ? 297 : 210;
  const pageHeightMm = isLandscape ? 210 : 297;

  // Calculate Margin Guides
  const marginTop = parseTypstUnit(schema.page.margin.top);
  const marginBottom = parseTypstUnit(schema.page.margin.bottom);
  const marginLeft = parseTypstUnit(schema.page.margin.left);
  const marginRight = parseTypstUnit(schema.page.margin.right);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-800">
      <DragMonitor />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Ruler Row */}
        <div className="flex h-6 bg-slate-100 border-b border-slate-300 relative z-30">
          <div className="w-6 h-6 bg-slate-200 border-r border-slate-300 flex-shrink-0" />
          <div className="flex-1 relative overflow-hidden">
             <Ruler 
                orientation="horizontal" 
                length={pageWidthMm + 100} // Extra length for margins/padding
                scrollPos={scrollPos.x - 32} // Offset for p-8 (32px)
             />
          </div>
        </div>

        <div className="flex flex-1 relative overflow-hidden">
          {/* Left Ruler Column */}
          <div className="w-6 bg-slate-100 border-r border-slate-300 flex-shrink-0 relative z-30 overflow-hidden">
            <Ruler 
                orientation="vertical" 
                length={pageHeightMm + 200} 
                scrollPos={scrollPos.y - 32} 
            />
          </div>

          {/* Professional Drafting Area */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto scrollbar-thin bg-slate-300 shadow-inner p-8"
          >
            <div className="min-w-max min-h-max flex justify-center">
                <div
                className={clsx(
                    'bg-white pro-grid border border-slate-400 relative shadow-2xl transition-none',
                    isLandscape ? 'w-[29.7cm] min-h-[21cm]' : 'w-[21cm] min-h-[29.7cm]'
                )}
                style={{
                    width: `${LayoutEngine.mmToPx(pageWidthMm)}px`,
                    minHeight: `${LayoutEngine.mmToPx(pageHeightMm)}px`,
                }}
                >
                {/* Margin Guides (Dashed) */}
                <div 
                    className="absolute border border-blue-400 border-dashed pointer-events-none z-10 opacity-50"
                    style={{
                        top: `${LayoutEngine.mmToPx(marginTop)}px`,
                        bottom: `${LayoutEngine.mmToPx(marginBottom)}px`,
                        left: `${LayoutEngine.mmToPx(marginLeft)}px`,
                        right: `${LayoutEngine.mmToPx(marginRight)}px`,
                    }}
                />

                {/* Snapping Alignment Guides Overlay */}
                <AlignmentGuides />

                <div className="flex flex-col gap-0 min-h-full relative z-20">
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
}

'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { DragOverlay } from './DragOverlay';
import { Zone } from './Zone';

export function Canvas() {
  const schema = useDesignerStore((state) => state.schema);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="flex-1 flex flex-col bg-slate-200" />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-200">
      {/* Precision Top Ruler */}
      <div className="h-6 bg-slate-100 border-b border-slate-300 relative overflow-hidden flex items-end ml-6">
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[1cm] h-3 border-l border-slate-400 relative">
            <span className="absolute -top-4 left-1 text-[8px] font-bold text-slate-500">{i}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 relative overflow-auto scrollbar-thin">
        {/* Precision Left Ruler */}
        <div className="w-6 bg-slate-100 border-r border-slate-300 flex-shrink-0 relative overflow-hidden flex flex-col items-end">
          {Array.from({ length: 31 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 h-[1cm] w-3 border-t border-slate-400 relative">
              <span className="absolute top-1 left-0.5 text-[8px] font-bold text-slate-500 -rotate-90">
                {i}
              </span>
            </div>
          ))}
        </div>

        {/* Professional Drafting Area */}
        <div className="flex-1 p-8 flex justify-center min-h-max bg-slate-300 shadow-inner">
          <div
            className={clsx(
              'w-[21cm] min-h-[29.7cm] bg-white pro-grid border border-slate-400 relative shadow-2xl transition-none',
              schema.page.orientation === 'landscape' && 'w-[29.7cm] min-h-[21cm]'
            )}
          >
            <div className="flex flex-col gap-0 min-h-full">
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
  );
}

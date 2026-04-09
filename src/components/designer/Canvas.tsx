'use client';

import React from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Zone } from './Zone';
import { clsx } from 'clsx';

export function Canvas() {
  const { schema } = useDesignerStore();

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Top Left Corner Block */}
      <div className="w-8 h-8 bg-slate-200 border-r border-b border-slate-300 flex-shrink-0" />
      
      {/* Top Ruler */}
      <div className="h-8 flex-1 bg-slate-100 border-b border-slate-300 relative overflow-hidden flex items-end">
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[1cm] h-3 border-l border-slate-400 relative">
            <span className="absolute -top-4 left-1 text-[9px] font-bold text-slate-500">{i}</span>
            <div className="absolute left-1/2 bottom-0 w-px h-1.5 bg-slate-300" />
          </div>
        ))}
        <div className="absolute bottom-0 left-[21cm] h-full w-px bg-red-400 opacity-30" />
      </div>

      <div className="flex flex-1 absolute top-8 bottom-0 left-0 right-0 overflow-auto scrollbar-thin">
        {/* Left Ruler */}
        <div className="w-8 bg-slate-100 border-r border-slate-300 flex-shrink-0 relative overflow-hidden flex flex-col items-end">
          {Array.from({ length: 31 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 h-[1cm] w-3 border-t border-slate-400 relative">
              <span className="absolute top-1 left-0.5 text-[9px] font-bold text-slate-500 -rotate-90">{i}</span>
              <div className="absolute top-1/2 right-0 h-px w-1.5 bg-slate-300" />
            </div>
          ))}
          <div className="absolute right-0 top-[29.7cm] w-full h-px bg-red-400 opacity-30" />
        </div>

        {/* Paper Container */}
        <div className="flex-1 bg-slate-300 p-8 flex justify-center min-h-max group">
          <div className={clsx(
            "w-[21cm] min-h-[29.7cm] bg-white pro-grid border border-slate-400 relative shadow-md transition-none",
            schema.page.orientation === 'landscape' && "w-[29.7cm] min-h-[21cm]"
          )}>
            <div className="flex flex-col gap-0 min-h-full">
              <Zone zoneKey="header" label="Report Header" components={schema.zones.header.components} />
              <Zone zoneKey="body" label="Detail Band" components={schema.zones.body.components} />
              <Zone zoneKey="footer" label="Page Footer" components={schema.zones.footer.components} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

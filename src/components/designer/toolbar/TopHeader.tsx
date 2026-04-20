'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Cpu } from 'lucide-react';
import { InsertMenu } from './InsertMenu';
import { ViewSwitcher } from './ViewSwitcher';

export const TopHeader = memo(function TopHeader() {
  const version = useDesignerStore((state) => state.schema.version);

  return (
    <header className="h-8 bg-slate-800 flex items-center justify-between px-3 border-b border-slate-900">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-700">
          <Cpu className="w-3.5 h-3.5 text-white" />
          <span className="text-[10px] font-black text-white uppercase tracking-tighter">
            TypstFlow Pro
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {['File', 'Edit'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition-none"
            >
              {item}
            </button>
          ))}
          <InsertMenu />
          {['Format', 'View', 'Tools', 'Help'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition-none"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <ViewSwitcher />

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-mono">v{version}</span>
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <div className="flex items-center gap-1.5 px-2 py-0.5 border border-slate-700">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-none" />
          <span className="text-[9px] text-slate-400 font-bold uppercase">
            Live Mode
          </span>
        </div>
      </div>
    </header>
  );
});

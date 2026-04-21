'use client';

import { memo, useState, useEffect } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { Play, FileDown } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const InsertMenu = memo(function InsertMenu() {
  const loadTemplate = useDesignerStore((state) => state.loadTemplate);
  const [activeMenu, setActiveMenu] = useState<boolean>(false);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLoad = (name: 'blank' | 'invoice' | 'complex' | 'invoice-with-breaks') => {
    loadTemplate(name);
    setActiveMenu(false);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <ToolbarButton
        label="Insert"
        variant="toolbar-item"
        active={activeMenu}
        onClick={() => setActiveMenu(!activeMenu)}
        showChevron
      />

      <div className={clsx(
        "absolute top-[calc(100%+2px)] left-0 bg-white border border-slate-300 shadow-sm py-1 min-w-[200px] z-[100] rounded-none",
        activeMenu ? "block" : "hidden"
      )}>
        <div className="px-3 py-1 bg-slate-100 border-b border-slate-300 mb-1">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Insert Templates</span>
        </div>
        
        <button
          type="button"
          onClick={() => handleLoad('complex')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 active:bg-slate-200"
        >
          <Play className="w-3.5 h-3.5 text-slate-600" />
          Advanced Table Demo
        </button>
        
        <button
          type="button"
          onClick={() => handleLoad('tax-invoice' as any)}
          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 active:bg-slate-200"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 text-[10px] font-bold">T</div>
          Tax Invoice (Blue Sky)
        </button>
        
        <button
          type="button"
          onClick={() => handleLoad('invoice-with-breaks')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 active:bg-slate-200"
        >
          <FileDown className="w-3.5 h-3.5 text-slate-600" />
          Invoice w/ Page Breaks
        </button>
        
        <div className="h-px bg-slate-200 my-1 mx-2" />
        
        <button
          type="button"
          onClick={() => handleLoad('blank')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 flex items-center gap-2.5 active:bg-red-100 transition-none"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center font-bold text-red-400">×</div>
          Clear Canvas (Blank)
        </button>
      </div>
    </div>
  );
});

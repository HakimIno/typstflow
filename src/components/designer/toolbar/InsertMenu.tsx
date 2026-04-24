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
        "absolute top-[calc(100%+2px)] left-0 bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-xl py-1 min-w-[200px] z-[100] rounded-[6px]",
        activeMenu ? "block" : "hidden"
      )}>
        <div className="px-3 py-1 bg-[var(--bg-widget)] border-b border-[var(--border-default)] mb-1">
          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Insert Templates</span>
        </div>
        
        <button
          type="button"
          onClick={() => handleLoad('complex')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2.5 active:bg-[var(--bg-widget)]"
        >
          <Play className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          Advanced Table Demo
        </button>
        
        <button
          type="button"
          onClick={() => handleLoad('tax-invoice' as any)}
          className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2.5 active:bg-[var(--bg-widget)]"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[var(--accent-glow)] text-[var(--accent)] text-[10px] font-bold">T</div>
          Tax Invoice (Blue Sky)
        </button>
        
        <button
          type="button"
          onClick={() => handleLoad('invoice-with-breaks')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2.5 active:bg-[var(--bg-widget)]"
        >
          <FileDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          Invoice w/ Page Breaks
        </button>
        
        <div className="h-px bg-[var(--border-default)] my-1 mx-2" />
        
        <button
          type="button"
          onClick={() => handleLoad('blank')}
          className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-500/10 flex items-center gap-2.5 active:bg-red-500/20 transition-none"
        >
          <div className="w-3.5 h-3.5 flex items-center justify-center font-bold text-red-400">×</div>
          Clear Canvas (Blank)
        </button>
      </div>
    </div>
  );
});

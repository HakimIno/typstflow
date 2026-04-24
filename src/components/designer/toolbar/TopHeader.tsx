'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { Cpu } from 'lucide-react';
import { InsertMenu } from './InsertMenu';
import { ViewSwitcher } from './ViewSwitcher';
import { SettingsMenu } from './SettingsMenu';

export const TopHeader = memo(function TopHeader() {
  const version = useDesignerStore((state) => state.schema.version);

  return (
    <header className="h-[40px] bg-[var(--bg-surface)] flex items-center justify-between px-3 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" />
          <span className="text-[11px] font-bold  tracking-tight">
            TypstFlow
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {['File', 'Edit'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-none"
            >
              {item}
            </button>
          ))}
          <InsertMenu />
          {['Format', 'View', 'Tools', 'Help'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-none"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <ViewSwitcher />

      <div className="flex items-center gap-4">
        <SettingsMenu />
        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">v{version}</span>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#34D399]/10 border border-[#34D399]/20 rounded-none">
          <span className="text-[9px] text-[#34D399] font-bold uppercase tracking-wide">
            Live Mode
          </span>
        </div>
      </div>
    </header>
  );
});

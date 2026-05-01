'use client';

import { useDesignerStore } from '@/store/designer-store';
import { memo } from 'react';
import { InsertMenu } from './InsertMenu';
import { SettingsMenu } from './SettingsMenu';
import { ShortcutGuide } from './ShortcutGuide';
import { ViewSwitcher } from './ViewSwitcher';

export const TopHeader = memo(function TopHeader() {
  const _version = useDesignerStore((state) => state.schema.version);
  const _schemaName = useDesignerStore((state) => state.schema.name);
  const _updateSchema = useDesignerStore((state) => state.updateSchema);

  return (
    <header className="h-[40px] bg-[var(--bg-surface)] backdrop-blur-2xl flex items-center justify-between px-3 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" />
          <span className="text-[11px] font-bold  tracking-tight">TypstFlow</span>
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

      <div className="flex items-center gap-4">
        <ViewSwitcher />
      </div>

      <div className="flex items-center gap-2">
        <ShortcutGuide />
        <SettingsMenu />
      </div>
    </header>
  );
});

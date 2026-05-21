'use client';

import { memo } from 'react';
import { FileMenu } from './FileMenu';
import { HelpMenu } from './HelpMenu';
import { InsertMenu } from './InsertMenu';
import { SettingsMenu } from './SettingsMenu';
import { ViewSwitcher } from './ViewSwitcher';

export const TopHeader = memo(function TopHeader() {
  return (
    <header className="h-[40px] bg-[var(--bg-surface)] backdrop-blur-2xl flex items-center justify-between px-3 border-b border-[var(--border-default)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-5 h-5 rounded overflow-hidden">
          <img src="/icon-app.png" alt="Logo" className="w-full h-full object-cover" />
        </div>

        <nav className="flex items-center gap-1">
          <FileMenu />
          {['Edit'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-none"
            >
              {item}
            </button>
          ))}
          <InsertMenu />
          {['Format', 'View', 'Tools'].map((item) => (
            <button
              key={item}
              type="button"
              className="px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-none"
            >
              {item}
            </button>
          ))}
          <HelpMenu />
        </nav>
      </div>

      <div className="flex items-center gap-2 mr-80">
        <ViewSwitcher />
      </div>

      <div className="flex items-center gap-2">
        <SettingsMenu />
      </div>
    </header>
  );
});

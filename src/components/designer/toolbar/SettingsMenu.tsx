'use client';

import { clsx } from 'clsx';
import { Palette, Settings } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { ThemeSettings } from './ThemeSettings';

export const SettingsMenu = memo(function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-1.5 rounded-md transition-all flex items-center gap-1.5 border',
          isOpen
            ? 'bg-[var(--bg-widget-hover)] border-[var(--border-accent)] text-[var(--accent)]'
            : 'border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
        )}
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 pro-panel z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-widget)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Application Settings
            </span>
          </div>

          <div className="p-3 flex flex-col gap-4">
            {/* Theme Section */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" />
                Theme & Branding
              </div>
              <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-default)]">
                <ThemeSettings />
              </div>
            </div>

            {/* Other settings can go here */}
            <div className="pt-2 border-t border-[var(--border-default)]">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-[var(--text-muted)]">Auto-save</span>
                <div className="w-6 h-3 bg-[var(--green)] rounded-full opacity-50" />
              </div>
            </div>
          </div>

          <div className="px-3 py-2 bg-[var(--bg-widget)] border-t border-[var(--border-default)] flex justify-between items-center">
            <span className="text-[9px] text-[var(--text-muted)] font-mono">TypstFlow v1.0.0</span>
          </div>
        </div>
      )}
    </div>
  );
});

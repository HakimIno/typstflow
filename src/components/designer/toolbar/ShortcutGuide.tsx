'use client';

import { clsx } from 'clsx';
import { Keyboard, X } from 'lucide-react';
import { memo, useState } from 'react';

const SHORTCUTS = [
  { label: 'Undo', key: '⌘ Z' },
  { label: 'Redo', key: '⌘ ⇧ Z' },
  { label: 'Copy', key: '⌘ C' },
  { label: 'Paste', key: '⌘ V' },
  { label: 'Duplicate', key: '⌘ D' },
  { label: 'Delete', key: '⌫ / Del' },
  { label: 'Nudge', key: '↑ ↓ ← →' },
  { label: 'Fast Nudge', key: '⇧ + ↑ ↓ ← →' },
  { label: 'Deselect', key: 'Esc' },
];

export const ShortcutGuide = memo(function ShortcutGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors',
          isOpen
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
        )}
      >
        <Keyboard className="w-3.5 h-3.5" />
        Shortcuts
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            tabIndex={-1}
            role="presentation"
          />
          <div className="absolute right-0 mt-2 w-56 pro-panel z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-3 py-2 border-b border-[var(--border-default)] flex items-center justify-between bg-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Keyboard Shortcuts
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-1.5">
              {SHORTCUTS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-md group"
                >
                  <span className="text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {s.label}
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-white/5 text-[9px] font-mono text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 bg-[var(--accent)]/5 border-t border-[var(--border-default)]">
              <p className="text-[9px] text-[var(--text-muted)] leading-tight italic text-center">
                Use shortcuts to speed up your design workflow.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

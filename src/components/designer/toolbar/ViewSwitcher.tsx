'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { memo } from 'react';

export const ViewSwitcher = memo(function ViewSwitcher() {
  const viewMode = useDesignerStore((state) => state.viewMode);
  const setViewMode = useDesignerStore((state) => state.setViewMode);

  return (
    <div className="flex items-center  rounded-full p-0.5 border border-[var(--border-default)]">
      {(['design', 'preview', 'split'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={clsx(
            'px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-[0.04em] transition-all',
            viewMode === mode
              ? 'bg-[var(--accent-glow)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] '
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
});

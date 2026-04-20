'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';

export const ViewSwitcher = memo(function ViewSwitcher() {
  const viewMode = useDesignerStore((state) => state.viewMode);
  const setViewMode = useDesignerStore((state) => state.setViewMode);

  return (
    <div className="flex items-center bg-slate-900/50 rounded-sm p-0.5 border border-slate-700">
      {(['design', 'preview', 'split'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={clsx(
            'px-3 py-0.5 rounded-none text-[10px] font-bold uppercase tracking-wider',
            viewMode === mode
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
});

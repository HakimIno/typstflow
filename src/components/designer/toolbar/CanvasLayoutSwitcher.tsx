'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { memo } from 'react';

export const CanvasLayoutSwitcher = memo(function CanvasLayoutSwitcher() {
  const canvasLayout = useDesignerStore((state) => state.canvasLayout);
  const setCanvasLayout = useDesignerStore((state) => state.setCanvasLayout);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setCanvasLayout('vertical')}
        className={clsx(
          'p-1.5 rounded-[var(--radius-sm)] transition-all',
          canvasLayout === 'vertical'
            ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
        )}
        title="Vertical Layout"
      >
        <LayoutList className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setCanvasLayout('grid')}
        className={clsx(
          'p-1.5 rounded-[var(--radius-sm)] transition-all',
          canvasLayout === 'grid'
            ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
        )}
        title="Grid Layout (2 Columns)"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

'use client';

import { cn } from '@/lib/utils/cn';

interface ToolbarSeparatorProps {
  /** `default` for token-based toolbars, `dark` for floating dark toolbars */
  tone?: 'default' | 'dark';
  className?: string;
}

export function ToolbarSeparator({ tone = 'default', className }: ToolbarSeparatorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'w-px shrink-0',
        tone === 'default' ? 'h-4 bg-[var(--border-default)] mx-1' : 'h-3 bg-white/10 mx-0.5',
        className
      )}
    />
  );
}

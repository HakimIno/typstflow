'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface BasePanelProps {
  children: ReactNode;
  className?: string;
}

export function BasePanel({ children, className }: BasePanelProps) {
  return (
    <div
      className={clsx(
        'h-full flex flex-col bg-[var(--bg-surface)] overflow-hidden font-sans border-r border-[var(--border-default)]',
        className
      )}
    >
      {children}
    </div>
  );
}

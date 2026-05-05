'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface BasePanelProps {
  children: ReactNode;
  className?: string;
  allowOverflow?: boolean;
}

export function BasePanel({ children, className, allowOverflow = false }: BasePanelProps) {
  return (
    <div
      className={clsx(
        'h-full flex flex-col bg-[var(--bg-surface)] font-sans border-r border-[var(--border-default)]',
        !allowOverflow && 'overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
}

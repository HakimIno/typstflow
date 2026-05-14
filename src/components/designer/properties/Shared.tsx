import { clsx } from 'clsx';
import type React from 'react';

export const PropertyGrid = ({
  children,
  cols = 2,
  className,
}: { children: React.ReactNode; cols?: 1 | 2; className?: string }) => (
  <div
    className={clsx(
      'grid gap-px bg-[var(--border-default)] border-b border-[var(--border-default)]',
      cols === 1 ? 'grid-cols-1' : 'grid-cols-2',
      className
    )}
  >
    {children}
  </div>
);

export const ControlField = ({
  label,
  children,
  className,
  vertical = true,
}: { label: string; children: React.ReactNode; className?: string; vertical?: boolean }) => (
  <div
    className={clsx(
      'flex bg-[var(--bg-surface)] p-1.5 gap-1.5 transition-colors',
      vertical ? 'flex-col' : 'flex-row items-center justify-between',
      className
    )}
  >
    <span className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] leading-none truncate">
      {label}
    </span>
    <div className="flex items-center min-h-[20px] w-full">{children}</div>
  </div>
);

export const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col border-b border-[var(--border-default)] last:border-0  transition-colors p-1.5 gap-1.5">
    <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] ">
      {label}
    </div>
    <div className="flex-1 flex items-center min-w-0">{children}</div>
  </div>
);

export const SectionHeader = ({ label, className }: { label: string; className?: string }) => (
  <div
    className={clsx(
      'px-2 py-1.5 border-b border-[var(--border-default)] text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] flex items-center gap-2 bg-white/[0.01]',
      className
    )}
  >
    {label}
  </div>
);

import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export const PropertyGrid = ({
  children,
  cols = 2,
  className,
}: { children: React.ReactNode; cols?: 1 | 2 | 3 | 4; className?: string }) => (
  <div
    className={clsx(
      'grid gap-2',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-2',
      cols === 3 && 'grid-cols-3',
      cols === 4 && 'grid-cols-4',
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
      'flex gap-1 transition-colors w-full',
      vertical ? 'flex-col' : 'flex-row items-center justify-between',
      className
    )}
  >
    <span className="text-[9px] font-bold text-[var(--text-secondary)] leading-none select-none">
      {label}
    </span>
    <div className="flex items-center min-h-[20px] w-full">{children}</div>
  </div>
);

export const PropertyRow = ({
  label,
  children,
  inline = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
  className?: string;
}) => (
  <div
    className={clsx(
      'flex transition-colors py-1 gap-1.5 items-center w-full',
      inline ? 'flex-row justify-between' : 'flex-col items-start',
      className
    )}
  >
    <div className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none shrink-0">
      {label}
    </div>
    <div className="w-full flex items-center min-w-0">{children}</div>
  </div>
);

export const SectionHeader = ({ label, className }: { label: string; className?: string }) => (
  <div
    className={clsx(
      'px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-[var(--text-secondary)] flex items-center gap-2 bg-white/[0.01] border-b border-[var(--border-default)] select-none',
      className
    )}
  >
    {label}
  </div>
);

export const CollapsibleSection = ({
  label,
  children,
  defaultOpen = true,
  action,
  className,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={clsx('border-b border-[var(--border-default)] last:border-0', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.01] hover:bg-white/[0.03] transition-colors select-none text-left"
      >
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-primary)]">
          {label}
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <ChevronDown
            className={clsx(
              'w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 pointer-events-none',
              !isOpen && '-rotate-90'
            )}
          />
        </div>
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
};

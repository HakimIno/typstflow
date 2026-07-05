'use client';

import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  title?: string;
  /** Per-option active style override (e.g. amber sun / accent moon in ThemeSettings) */
  activeClassName?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Corner style for the container and items */
  shape?: 'rounded' | 'pill';
  /** Render only the buttons, without container chrome */
  bare?: boolean;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  inactiveItemClassName?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  shape = 'rounded',
  bare = false,
  className,
  itemClassName,
  activeItemClassName,
  inactiveItemClassName,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center',
        bare
          ? 'gap-0.5'
          : cn(
              'p-0.5 border border-[var(--border-default)]',
              shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-md)]'
            ),
        className
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.title}
            className={cn(
              'flex items-center justify-center transition-all cursor-pointer',
              shape === 'pill' ? 'rounded-full' : 'rounded-[var(--radius-sm)]',
              Icon && !option.label ? 'p-1.5' : 'px-3 py-1 text-[11px] font-medium',
              isActive
                ? (option.activeClassName ??
                    activeItemClassName ??
                    'bg-[var(--accent-glow)] text-[var(--accent)]')
                : (inactiveItemClassName ??
                    'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'),
              itemClassName
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5 pointer-events-none" />}
            {option.label && <span className="pointer-events-none">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

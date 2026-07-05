'use client';

import { cn } from '@/lib/utils/cn';
import type React from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Floating toolbars are deliberately dark (Figma-style): they sit over the
 * white paper canvas, so a dark surface guarantees contrast in both app themes.
 * Positioning and animation stay in the caller.
 */
export function FloatingToolbar({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 bg-black backdrop-blur-md p-1 border border-white/10 shadow-2xl rounded-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface FloatingToolbarButtonProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  badge?: ReactNode;
  shape?: 'square' | 'circle';
  className?: string;
  children?: ReactNode;
}

export function FloatingToolbarButton({
  icon: Icon,
  title,
  onClick,
  disabled,
  active,
  badge,
  shape = 'square',
  className,
  children,
}: FloatingToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      title={title}
      className={cn(
        'relative text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed',
        shape === 'circle' ? 'p-2 rounded-full' : 'p-1 rounded-md',
        active && 'bg-white/10 text-white',
        className
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {badge}
    </button>
  );
}

interface FloatingToolbarFlyoutProps {
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  isActive: boolean;
  onHover: (hovered: boolean) => void;
}

/** Hover-triggered flyout panel anchored above a floating toolbar icon. */
export function FloatingToolbarFlyout({
  icon: Icon,
  children,
  isActive,
  onHover,
}: FloatingToolbarFlyoutProps) {
  return (
    <div
      className="relative flex items-center group/group"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        className={cn(
          'p-1 rounded-md transition-all duration-200 cursor-default',
          isActive ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>

      {/* Floating Panel */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 pb-2 transition-all duration-300 origin-bottom z-[1100]',
          isActive
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        )}
      >
        <div className="pro-panel p-0.5 backdrop-blur-xl border-white/10 shadow-2xl relative bg-[var(--bg-surface-solid)]/95">
          {children}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-px w-2 h-1.5 bg-[var(--bg-surface-solid)]/95 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </div>
      </div>
    </div>
  );
}

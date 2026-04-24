'use client';

import { LucideIcon } from 'lucide-react';
import { memo, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ToolbarButtonProps {
  icon?: LucideIcon;
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'toolbar-item';
  className?: string;
  children?: ReactNode;
  title?: string;
  showChevron?: boolean;
}

export const ToolbarButton = memo(function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  variant = 'default',
  className,
  children,
  title,
  showChevron,
}: ToolbarButtonProps) {
  const baseStyles = "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border rounded-[4px] disabled:opacity-30 disabled:cursor-not-allowed select-none transition-all duration-150";
  
  const variants = {
    default: "bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-accent)]",
    primary: "bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-app)] hover:opacity-90 active:scale-95",
    danger: "bg-[var(--color-danger-subtle)] border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-hover)]",
    ghost: "bg-transparent border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
    'toolbar-item': "border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
  };

  const activeStyles = active ? (
    variant === 'toolbar-item' 
      ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" 
      : "bg-[var(--accent-glow)] border-[var(--accent)] text-[var(--accent)]"
  ) : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        baseStyles,
        variants[variant],
        activeStyles,
        className
      )}
    >
      {Icon && <Icon className={clsx("w-3.5 h-3.5 pointer-events-none", !label && "w-4 h-4")} />}
      {label && <span className="truncate pointer-events-none">{label}</span>}
      {children}
      {showChevron && (
        <svg
          className={clsx("w-3 h-3 ml-0.5 transition-transform pointer-events-none", active && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  );
});

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
  const baseStyles = "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border rounded-none disabled:opacity-30 disabled:cursor-not-allowed select-none";
  
  const variants = {
    default: "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 active:bg-slate-200",
    primary: "bg-blue-700 border-blue-800 text-white hover:bg-blue-800 active:bg-blue-900",
    danger: "bg-white border-red-300 text-red-600 hover:bg-red-50",
    ghost: "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100",
    'toolbar-item': "border-transparent text-slate-300 hover:bg-slate-700 hover:text-white",
  };

  const activeStyles = active ? (
    variant === 'toolbar-item' 
      ? "bg-slate-700 text-white" 
      : "bg-slate-200 border-slate-400 text-slate-900"
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

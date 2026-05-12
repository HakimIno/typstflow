import { clsx } from 'clsx';
import React from 'react';

export interface DesignerInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  variant?: 'default' | 'mini' | 'ghost';
  mono?: boolean;
  suffix?: string;
}

export const DesignerInput = React.forwardRef<HTMLInputElement, DesignerInputProps>(
  (
    {
      value,
      onChange,
      type = 'text',
      variant = 'default',
      mono = false,
      suffix,
      className,
      ...props
    },
    ref
  ) => {
    const input = (
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          // Base styles
          'w-full outline-none transition-colors text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',

          // Typography
          mono ? 'font-mono' : 'font-sans',

          // Variants
          {
            'bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-[4px] px-1.5 py-1 text-[10px] focus:border-[var(--accent)]':
              variant === 'default',
            'bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-[4px] px-1 h-5 text-[9px] focus:border-[var(--accent)]':
              variant === 'mini',
            'bg-transparent border-none text-[10px] font-medium min-w-0 px-1 py-0.5 focus:bg-[var(--bg-widget)] rounded-[4px]':
              variant === 'ghost',
          },

          suffix && 'pr-6',
          className
        )}
        {...props}
      />
    );

    if (!suffix) return input;

    return (
      <div className="relative w-full flex items-center">
        {input}
        <span className="absolute right-1.5 text-[8px] font-bold text-[var(--text-muted)] uppercase pointer-events-none select-none">
          {suffix}
        </span>
      </div>
    );
  }
);

DesignerInput.displayName = 'DesignerInput';

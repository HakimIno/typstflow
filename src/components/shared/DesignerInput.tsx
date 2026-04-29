import React from 'react';
import { clsx } from 'clsx';

export interface DesignerInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  variant?: 'default' | 'mini' | 'ghost';
  mono?: boolean;
}

export const DesignerInput = React.forwardRef<HTMLInputElement, DesignerInputProps>(
  (
    {
      value,
      onChange,
      type = 'text',
      variant = 'default',
      mono = false,
      className,
      ...props
    },
    ref
  ) => {
    return (
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
            'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[4px] px-2 py-1.5 text-[11px] focus:border-[var(--accent)]':
              variant === 'default',
            'bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 h-5 text-[10px] focus:border-[var(--accent)]':
              variant === 'mini',
            'bg-transparent border-none text-[11px] font-medium min-w-0 px-1 py-0.5 focus:bg-[var(--bg-surface)] rounded-[4px]':
              variant === 'ghost',
          },
          
          className
        )}
        {...props}
      />
    );
  }
);

DesignerInput.displayName = 'DesignerInput';

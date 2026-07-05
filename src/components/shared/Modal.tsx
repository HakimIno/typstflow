'use client';

import { cn } from '@/lib/utils/cn';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  /** Called on backdrop click; omit to disable backdrop dismissal */
  onClose?: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
  zIndexClassName?: string;
  /** Extra classes for the card */
  className?: string;
  /** Extra classes for the backdrop (e.g. `backdrop-blur-none`) */
  backdropClassName?: string;
  /**
   * Keep mounted and animate open/close transitions driven by `open`.
   * The caller controls unmount timing (see AlertDialog).
   */
  animated?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = 'max-w-md',
  zIndexClassName = 'z-[100]',
  className,
  backdropClassName,
  animated = false,
}: ModalProps) {
  if (!open && !animated) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4',
        zIndexClassName,
        animated && [
          'transition-all duration-300 ease-out',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ]
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm',
          animated && ['transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0'],
          backdropClassName
        )}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose?.();
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        className={cn(
          'relative w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden',
          maxWidthClassName,
          animated && [
            'transition-all duration-300 ease-out transform-gpu',
            open ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0',
          ],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  icon?: ReactNode;
  title: string;
  onClose?: () => void;
  className?: string;
}

export function ModalHeader({ icon, title, onClose, className }: ModalHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="font-semibold text-sm text-[var(--text-primary)]">{title}</h2>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

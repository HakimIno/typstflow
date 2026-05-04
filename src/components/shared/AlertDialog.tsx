'use client';

import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AlertDialog() {
  const dialog = useDesignerStore((state) => state.dialog);
  const hideDialog = useDesignerStore((state) => state.hideDialog);
  const [inputValue, setInputValue] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (dialog.isOpen) {
      setIsVisible(true);
      setInputValue(dialog.initialValue || '');
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [dialog.isOpen, dialog.initialValue]);

  if (!isVisible && !dialog.isOpen) return null;

  const handleCancel = () => {
    dialog.onCancel?.();
    hideDialog();
  };

  const handleConfirm = () => {
    dialog.onConfirm?.(dialog.showInput ? inputValue : undefined);
    hideDialog();
  };

  const getIcon = () => {
    switch (dialog.variant) {
      case 'danger':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-[var(--accent)]" />;
    }
  };

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ease-out',
        dialog.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          dialog.isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleCancel}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleCancel();
          }
        }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={clsx(
          'relative w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ease-out transform-gpu',
          dialog.isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-2 opacity-0'
        )}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {dialog.title}
              </h3>
              <p className="mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
                {dialog.message}
              </p>

              {dialog.showInput && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={dialog.inputPlaceholder}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all text-[var(--text-primary)]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirm();
                      }
                      if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-2 bg-[var(--bg-app)]/30 border-t border-[var(--border-default)]">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-md transition-colors"
          >
            {dialog.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={clsx(
              'px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all active:scale-95 shadow-sm',
              dialog.variant === 'danger'
                ? 'bg-red-600 text-white shadow-red-600/10 hover:bg-red-700'
                : 'bg-[var(--accent)] text-white shadow-[var(--accent-glow)] hover:opacity-90'
            )}
          >
            {dialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

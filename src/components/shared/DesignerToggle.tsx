'use client';

import { Icon } from '@iconify/react';
import { clsx } from 'clsx';
import { memo } from 'react';

interface DesignerToggleProps {
  value: boolean | string;
  onChange: (value: boolean | string) => void;
  className?: string;
  label?: string;
}

export const DesignerToggle = memo(function DesignerToggle({
  value,
  onChange,
  className,
}: DesignerToggleProps) {
  const isExpression = typeof value === 'string' && value.includes('{{');
  const isTrue = value === true || value === 'true';

  const handleToggle = () => {
    if (isExpression) return;
    onChange(!isTrue);
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
          isTrue ? 'bg-[var(--accent)]' : 'bg-white/10',
          isExpression && 'opacity-30 cursor-not-allowed'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            isTrue ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>

      {isExpression ? (
        <div className="flex-1 flex items-center gap-1 bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--accent)]/30 overflow-hidden">
          <Icon
            icon="solar:code-bold-duotone"
            className="w-2.5 h-2.5 text-[var(--accent)] shrink-0"
          />
          <input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[9px] font-mono text-[var(--accent)] min-w-0"
          />
          <button
            type="button"
            onClick={() => onChange(isTrue)}
            className="ml-1 hover:text-[var(--text-primary)] text-[var(--text-muted)]"
          >
            <Icon icon="solar:close-circle-bold" className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onChange('{{variable}}')}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          title="Switch to expression mode"
        >
          <Icon icon="solar:code-linear" className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});

'use client';

import { clsx } from 'clsx';
import { Image } from 'lucide-react';
import type { ComponentType } from 'react';

const PREVIEW_LABELS: Record<string, string> = {
  text: 'Editable text',
  table: 'Repeating rows',
  image: 'Image box',
  line: 'Divider',
  qr: 'QR block',
  spacer: 'Vertical space',
  columns: '2-column layout',
  'summary-box': 'Totals block',
  checklist: 'Checklist items',
  'page-break-indicator': 'Flow break',
  'page-number': 'Page counter',
  rectangle: 'Shape',
  signature: 'Signature block',
};

/**
 * A small "sheet" mock that visually previews what the component looks like,
 * rendered inside the drag overlay (like the thumbnail in a feature card).
 *
 * Cases here enumerate the same component types as `createDefaultComponent` in
 * `component-templates.ts`. Kept separate (different return shapes: visual mock
 * vs. data object) — if you add a type here, check whether `createDefaultComponent`
 * needs a matching case.
 */
function DragThumb({
  type,
  icon: Icon,
}: {
  type: string;
  icon: ComponentType<{ className?: string }>;
}) {
  // Neutral, theme-driven mock elements
  const bar = 'rounded-full bg-[var(--text-muted)] opacity-50';
  const barStrong = 'rounded-full bg-[var(--text-secondary)] opacity-70';
  const cell = 'border-[var(--border-default)]';

  switch (type) {
    case 'text':
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          <div className={clsx(barStrong, 'h-1.5 w-4/5')} />
          <div className={clsx(bar, 'h-1 w-full')} />
          <div className={clsx(bar, 'h-1 w-11/12')} />
          <div className={clsx(bar, 'h-1 w-2/3')} />
        </div>
      );
    case 'table':
      return (
        <div
          className={clsx('flex h-full w-full flex-col overflow-hidden rounded-md border', cell)}
        >
          <div className="grid grid-cols-3 bg-[var(--bg-widget)]">
            {[0, 1, 2].map((c) => (
              <div key={c} className={clsx('h-3 border-r last:border-r-0', cell)} />
            ))}
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} className={clsx('grid grid-cols-3 border-t', cell)}>
              {[0, 1, 2].map((c) => (
                <div
                  key={c}
                  className={clsx('flex h-2.5 items-center border-r px-1 last:border-r-0', cell)}
                >
                  <div className={clsx(bar, 'h-0.5 w-2/3')} />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    case 'image':
      return (
        <div
          className={clsx(
            'flex h-full w-full items-center justify-center rounded-md border bg-[var(--bg-widget)]',
            cell
          )}
        >
          <Image className="size-6 text-[var(--text-muted)]" />
        </div>
      );
    case 'line':
      return (
        <div className="flex h-full w-full items-center px-1">
          <div className="h-0.5 w-full rounded-full bg-[var(--text-muted)] opacity-70" />
        </div>
      );
    case 'rectangle':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={clsx('h-3/4 w-full rounded-md border bg-[var(--bg-widget)]', cell)} />
        </div>
      );
    case 'qr':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="grid grid-cols-5 gap-[2px]">
            {[1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1].map(
              (on, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static decorative cells
                  key={i}
                  className={clsx(
                    'size-1.5 rounded-[1px]',
                    on ? 'bg-[var(--text-primary)]' : 'bg-[var(--bg-widget)]'
                  )}
                />
              )
            )}
          </div>
        </div>
      );
    case 'columns':
      return (
        <div className="grid h-full w-full grid-cols-2 gap-1.5">
          {[0, 1].map((c) => (
            <div
              key={c}
              className={clsx('rounded-md border border-dashed bg-[var(--bg-widget)]', cell)}
            />
          ))}
        </div>
      );
    case 'spacer':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className={clsx(
              'flex h-3/4 w-2/3 items-center justify-center rounded-md border border-dashed text-[8px] font-medium text-[var(--text-muted)]',
              cell
            )}
          >
            space
          </div>
        </div>
      );
    case 'summary-box':
      return (
        <div
          className={clsx(
            'flex h-full w-full flex-col justify-center gap-1 rounded-md border bg-[var(--bg-widget)] px-1.5 py-1',
            cell
          )}
        >
          {[3, 4, 5].map((w, r) => (
            <div key={w} className="flex items-center justify-between">
              <div className={clsx(bar, 'h-1', r === 2 ? 'w-1/3' : 'w-2/5')} />
              <div className={clsx(r === 2 ? barStrong : bar, 'h-1 w-1/4')} />
            </div>
          ))}
        </div>
      );
    case 'checklist':
      return (
        <div className="flex h-full w-full flex-col justify-center gap-1.5 px-1">
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <div className={clsx('size-2 rounded-[3px] border bg-[var(--bg-widget)]', cell)} />
              <div className={clsx(bar, 'h-1 w-3/4')} />
            </div>
          ))}
        </div>
      );
    case 'signature':
      return (
        <div className="flex h-full w-full items-end justify-center gap-3 pb-1">
          {[0, 1].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="h-px w-12 bg-[var(--text-muted)] opacity-70" />
              <div className={clsx(bar, 'h-0.5 w-8')} />
            </div>
          ))}
        </div>
      );
    case 'page-break-indicator':
      return (
        <div className="flex h-full w-full items-center justify-center px-1">
          <div className="h-px w-full border-t border-dashed border-[var(--border-accent)]" />
        </div>
      );
    case 'page-number':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="rounded-full bg-[var(--bg-widget)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)]">
            Page 1 / 3
          </div>
        </div>
      );
    default:
      return (
        <div className="flex h-full w-full items-center justify-center">
          <Icon className="size-6 text-[var(--text-muted)]" />
        </div>
      );
  }
}

export function PaletteDragPreview({
  icon: Icon,
  label,
  type,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  type: string;
}) {
  return (
    <div
      className="w-[200px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-solid)]"
      style={{ boxShadow: 'var(--shadow-premium)' }}
    >
      {/* Preview thumbnail */}
      <div className="p-2.5 pb-0">
        <div className="flex h-[72px] items-stretch justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-widget)] p-2">
          <DragThumb type={type} icon={Icon} />
        </div>
      </div>

      {/* Title + description */}
      <div className="px-3 pb-2.5 pt-2">
        <div className="truncate text-[12px] font-semibold leading-tight text-[var(--text-primary)]">
          {label}
        </div>
        <div className="truncate text-[10px] leading-tight text-[var(--text-muted)]">
          {PREVIEW_LABELS[type] ?? type}
        </div>
      </div>
    </div>
  );
}

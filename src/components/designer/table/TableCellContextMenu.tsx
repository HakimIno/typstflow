'use client';

import { clsx } from 'clsx';
import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Lightweight right-click menu for table cells. Positioned in viewport (fixed)
 * coordinates at the cursor, clamped to stay on screen. Closes on outside
 * pointer-down, Escape, scroll, resize, or after an item is chosen.
 */
export function TableCellContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp to the viewport once the menu has measured itself.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
  }, [x, y]);

  useEffect(() => {
    // Only close on pointer-downs OUTSIDE the menu. Guarding by target (instead of
    // relying on stopPropagation) is required because this listener runs in the
    // capture phase — it fires before the menu item's own click handler, so an
    // unconditional close would unmount the menu before the action can run.
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const close = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  // Portal to <body> so the fixed menu escapes the canvas' `transform: scale(zoom)`
  // ancestor — otherwise it would be positioned relative to (and scaled by) the
  // zoomed container instead of the real viewport.
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[2000] min-w-[210px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-solid)] p-1 text-[13px] text-[var(--text-primary)] shadow-2xl ring-1 ring-black/5 select-none"
      style={{ left: pos.x, top: pos.y }}
      // Suppress the browser's own context menu on right-click inside our menu.
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <div key={item.key}>
          {item.separatorBefore && <div className="my-1 h-px bg-[var(--border-default)]" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors',
              item.disabled
                ? 'cursor-not-allowed text-[var(--text-muted)]'
                : item.danger
                  ? 'cursor-pointer text-red-500 hover:bg-red-500/10'
                  : 'cursor-pointer hover:bg-[var(--bg-hover)]'
            )}
          >
            {item.icon && (
              <item.icon
                className={clsx(
                  'h-4 w-4 shrink-0',
                  !item.disabled && !item.danger && 'text-[var(--text-secondary)]'
                )}
              />
            )}
            <span className="flex-1">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

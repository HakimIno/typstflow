'use client';

import { Icon } from '@iconify/react';
import { useDesignerStore } from '@/store/designer-store';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface PanelHeaderProps {
  title?: string;
  icon?: string;
  actions?: ReactNode;
  children?: ReactNode; // Alternative to title/icon for custom headers like DataPanel tabs
  onClose?: () => void;
}

export function PanelHeader({ title, icon, actions, children, onClose }: PanelHeaderProps) {
  const setSidebarOpen = useDesignerStore((state) => state.setSidebarOpen);

  return (
    <div className="px-3 py-2 bg-white/5 flex items-center justify-between border-b border-[var(--border-default)] shrink-0 min-h-[40px]">
      <div className="flex items-center gap-2">
        {children || (
          <>
            {icon && (
              <div className="w-5 h-5 flex items-center justify-center rounded p-1 bg-[var(--accent)]/10">
                <Icon icon={icon} className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
            )}
            {title && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {title}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onClose || (() => setSidebarOpen(false))}
          className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          aria-label="Close Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

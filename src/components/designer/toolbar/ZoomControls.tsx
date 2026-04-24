'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const ZoomControls = memo(function ZoomControls() {
  const zoom = useDesignerStore((state) => state.zoom);
  const setZoom = useDesignerStore((state) => state.setZoom);

  return (
    <div className="flex items-center bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-[4px] mr-3 h-7 overflow-hidden">
      <ToolbarButton
        icon={ZoomOut}
        onClick={() => setZoom(zoom - 0.1)}
        variant="ghost"
        title="Zoom Out"
        className="!border-none !bg-transparent h-full w-8 !p-1.5"
      />
      <div 
        className="flex items-center justify-center px-2 h-full text-[10px] font-mono text-[var(--text-secondary)] font-bold w-12 border-x border-[var(--border-default)] cursor-default bg-[var(--bg-surface)]"
        title="Current Zoom"
      >
        {Math.round(zoom * 100)}%
      </div>
      <ToolbarButton
        icon={ZoomIn}
        onClick={() => setZoom(zoom + 0.1)}
        variant="ghost"
        title="Zoom In"
        className="!border-none !bg-transparent h-full w-8 !p-1.5"
      />
    </div>
  );
});

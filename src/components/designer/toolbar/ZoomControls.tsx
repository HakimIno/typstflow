'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const ZoomControls = memo(function ZoomControls() {
  const zoom = useDesignerStore((state) => state.zoom);
  const setZoom = useDesignerStore((state) => state.setZoom);

  return (
    <div className="flex items-center bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-md shadow-sm mr-3 h-8 overflow-hidden p-0.5">
      <ToolbarButton
        icon={ZoomOut}
        onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
        variant="ghost"
        title="Zoom Out"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
      <div 
        className="flex items-center justify-center h-full text-[10px] font-mono text-[var(--text-secondary)] font-bold px-2 cursor-default"
        title="Current Zoom"
      >
        {Math.round(zoom * 100)}%
      </div>
      <ToolbarButton
        icon={ZoomIn}
        onClick={() => setZoom(Math.min(5, zoom + 0.1))}
        variant="ghost"
        title="Zoom In"
        className="!h-7 !w-7 !p-1.5 opacity-80 hover:opacity-100"
      />
    </div>
  );
});

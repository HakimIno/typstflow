'use client';

import { useDesignerStore } from '@/store/designer-store';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { memo } from 'react';
import { ToolbarButton } from './ToolbarButton';

export const ZoomControls = memo(function ZoomControls() {
  const zoom = useDesignerStore((state) => state.zoom);
  const setZoom = useDesignerStore((state) => state.setZoom);

  return (
    <div className="flex items-center h-7 overflow-hidden">
      <ToolbarButton
        icon={ZoomOut}
        onClick={() => setZoom(Math.max(0.2, zoom / 1.15))}
        variant="toolbar-item"
        title="Zoom Out (Cmd+-)"
        size="icon"
      />
      <button
        type="button"
        onClick={() => setZoom(1.0)}
        className="flex items-center justify-center h-full text-[10px] font-mono text-[var(--text-secondary)] font-bold px-2 cursor-pointer hover:text-[var(--accent)] transition-colors"
        title="Reset to 100% (Cmd+0)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ToolbarButton
        icon={ZoomIn}
        onClick={() => setZoom(Math.min(3.0, zoom * 1.15))}
        variant="toolbar-item"
        title="Zoom In (Cmd+=)"
        size="icon"
      />
    </div>
  );
});

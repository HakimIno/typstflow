'use client';

import { memo } from 'react';
import { useDesignerStore } from '@/store/designer-store';
import { getPaperWidth } from '@/lib/utils/paper-sizes';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export const AlignmentTools = memo(function AlignmentTools() {
  const selectedComponentId = useDesignerStore((state) => state.selectedComponentId);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const pageSize = useDesignerStore((state) => state.schema.page.size);
  const orientation = useDesignerStore((state) => state.schema.page.orientation);

  const handleAlign = (type: 'left' | 'center' | 'right') => {
    if (!selectedComponentId) return;

    const PAGE_WIDTH_MM = getPaperWidth(pageSize, orientation);
    const PAGE_CONTENT_WIDTH = PAGE_WIDTH_MM - 40; // Approx margin-aware

    switch (type) {
      case 'left':
        updateComponent(selectedComponentId, { x: 0 });
        break;
      case 'center':
        updateComponent(selectedComponentId, { x: PAGE_CONTENT_WIDTH / 2 - 50 });
        break; 
      case 'right':
        updateComponent(selectedComponentId, { x: PAGE_CONTENT_WIDTH - 100 });
        break;
    }
  };

  return (
    <div className="flex items-center gap-0.5 bg-[var(--bg-widget)] border border-[var(--border-default)] rounded-[4px] p-0.5 mr-2">
      <ToolbarButton
        icon={AlignLeft}
        onClick={() => handleAlign('left')}
        disabled={!selectedComponentId}
        variant="ghost"
        title="Align Left"
        className="!border-none !bg-transparent h-7 w-7 !p-1"
      />
      <ToolbarButton
        icon={AlignCenter}
        onClick={() => handleAlign('center')}
        disabled={!selectedComponentId}
        variant="ghost"
        title="Center Horizontally"
        className="!border-none !bg-transparent h-7 w-7 !p-1"
      />
      <ToolbarButton
        icon={AlignRight}
        onClick={() => handleAlign('right')}
        disabled={!selectedComponentId}
        variant="ghost"
        title="Align Right"
        className="!border-none !bg-transparent h-7 w-7 !p-1"
      />
    </div>
  );
});

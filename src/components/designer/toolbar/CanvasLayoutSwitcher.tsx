'use client';

import { useDesignerStore } from '@/store/designer-store';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { memo } from 'react';
import { SegmentedControl } from './SegmentedControl';

export const CanvasLayoutSwitcher = memo(function CanvasLayoutSwitcher() {
  const canvasLayout = useDesignerStore((state) => state.canvasLayout);
  const setCanvasLayout = useDesignerStore((state) => state.setCanvasLayout);

  return (
    <SegmentedControl
      bare
      options={[
        { value: 'vertical', icon: LayoutList, title: 'Vertical Layout' },
        { value: 'grid', icon: LayoutGrid, title: 'Grid Layout (2 Columns)' },
      ]}
      value={canvasLayout}
      onChange={setCanvasLayout}
      inactiveItemClassName="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
    />
  );
});

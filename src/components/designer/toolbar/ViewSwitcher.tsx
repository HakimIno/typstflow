'use client';

import { useDesignerStore } from '@/store/designer-store';
import { memo } from 'react';
import { SegmentedControl } from './SegmentedControl';

export const ViewSwitcher = memo(function ViewSwitcher() {
  const viewMode = useDesignerStore((state) => state.viewMode);
  const setViewMode = useDesignerStore((state) => state.setViewMode);

  return (
    <SegmentedControl
      shape="pill"
      options={(['design', 'preview', 'split'] as const).map((mode) => ({
        value: mode,
        label: mode,
      }))}
      value={viewMode}
      onChange={setViewMode}
      itemClassName="uppercase tracking-[0.04em]"
      activeItemClassName="bg-[var(--accent-glow)] text-[var(--text-primary)]"
    />
  );
});

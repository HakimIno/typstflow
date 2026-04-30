'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { useShallow } from 'zustand/react/shallow';

export function AlignmentGuides({ pageId }: { pageId?: string }) {
  const { isDragging, activeGuides, activePageId } = useDesignerStore(
    useShallow((state) => ({
      isDragging: state.dragState.isDragging,
      activeGuides: state.dragState.activeGuides,
      activePageId: state.dragState.activePageId,
    }))
  );

  if (!isDragging || activePageId !== pageId) return null;

  const { vertical, horizontal } = activeGuides;

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {vertical.map((x, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 border-l border-magenta-500 border-dashed"
          style={{
            left: `${LayoutEngine.mmToPx(x)}px`,
            borderColor: '#ff00ff', // High-visibility magenta
          }}
        />
      ))}
      {horizontal.map((y, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-magenta-500 border-dashed"
          style={{
            top: `${LayoutEngine.mmToPx(y)}px`,
            borderColor: '#ff00ff',
          }}
        />
      ))}
    </div>
  );
}

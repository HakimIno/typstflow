'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import { memo } from 'react';

interface Props {
  pageId: string;
}

import { useShallow } from 'zustand/react/shallow';

/**
 * Renders vertical and horizontal guide lines when snapping is active during drag.
 */
export const SnapGuides = memo(function SnapGuides({ pageId }: Props) {
  const { activeGuides, spacingIndicators, isDragging, dragActivePageId } = useDesignerStore(
    useShallow((state) => ({
      activeGuides: state.dragState.activeGuides,
      spacingIndicators: state.dragState.spacingIndicators,
      isDragging: state.dragState.isDragging,
      dragActivePageId: state.dragState.activePageId,
    }))
  );
  const _zoom = useDesignerStore((state) => state.zoom);

  if (!isDragging) return null;
  if (dragActivePageId && dragActivePageId !== pageId) return null;

  if (
    !activeGuides.vertical.length &&
    !activeGuides.horizontal.length &&
    !spacingIndicators.length
  ) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-[45]">
      {activeGuides.vertical.map((x, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 bottom-0 border-l border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          style={{
            left: `${LayoutEngine.mmToPx(x)}px`,
            width: '1px',
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-500 text-[8px] text-white px-1 rounded-b-sm whitespace-nowrap">
            {x.toFixed(1)}mm
          </div>
        </div>
      ))}
      {activeGuides.horizontal.map((y, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 border-t border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          style={{
            top: `${LayoutEngine.mmToPx(y)}px`,
            height: '1px',
          }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-blue-500 text-[8px] text-white px-1 rounded-r-sm whitespace-nowrap">
            {y.toFixed(1)}mm
          </div>
        </div>
      ))}

      {/* --- Spacing Indicators --- */}
      {spacingIndicators.map((ind, i) => {
        const isHorizontal = ind.side === 'left' || ind.side === 'right';
        const length = Math.abs(ind.lineEnd - ind.lineStart);

        return (
          <div
            key={`spacing-${i}`}
            className="absolute flex items-center justify-center"
            style={{
              left: `${LayoutEngine.mmToPx(isHorizontal ? Math.min(ind.lineStart, ind.lineEnd) : ind.crossPos)}px`,
              top: `${LayoutEngine.mmToPx(isHorizontal ? ind.crossPos : Math.min(ind.lineStart, ind.lineEnd))}px`,
              width: isHorizontal ? `${LayoutEngine.mmToPx(length)}px` : '1px',
              height: isHorizontal ? '1px' : `${LayoutEngine.mmToPx(length)}px`,
              background: 'rgba(239, 68, 68, 0.6)', // Red-500
              boxShadow: '0 0 4px rgba(239, 68, 68, 0.4)',
            }}
          >
            {/* T-Bar Ends */}
            <div
              className="absolute bg-red-500"
              style={{
                width: isHorizontal ? '1px' : '6px',
                height: isHorizontal ? '6px' : '1px',
                left: 0,
                top: isHorizontal ? '-3px' : 0,
              }}
            />
            <div
              className="absolute bg-red-500"
              style={{
                width: isHorizontal ? '1px' : '6px',
                height: isHorizontal ? '6px' : '1px',
                right: isHorizontal ? 0 : 'auto',
                bottom: isHorizontal ? 'auto' : 0,
                left: isHorizontal ? 'auto' : '-3px',
                top: isHorizontal ? '-3px' : 'auto',
              }}
            />

            {/* Distance Badge */}
            <div
              className="absolute bg-red-500 text-white text-[9px] px-1 rounded-sm font-medium z-10"
              style={{
                transform: isHorizontal ? 'translateY(-100%)' : 'translateX(8px)',
                top: isHorizontal ? '-2px' : '50%',
                left: isHorizontal ? '50%' : 'auto',
                marginTop: isHorizontal ? 0 : '-6px',
                marginLeft: isHorizontal ? '-15px' : 0,
              }}
            >
              {ind.distance.toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
});

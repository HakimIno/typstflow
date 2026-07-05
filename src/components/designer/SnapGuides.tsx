'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { useDesignerStore } from '@/store/designer-store';
import type { SpacingIndicator } from '@/store/store-types';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

interface Props {
  pageId: string;
}

const MAX_GUIDES_PER_AXIS = 2;
const MAX_SPACING_INDICATORS = 2;
const GUIDE_PRECISION_MM = 0.1;
const MIN_SPACING_LENGTH_MM = 0.5;

function dedupeGuides(guides: number[]): number[] {
  const deduped: number[] = [];

  for (const guide of guides) {
    const rounded = Math.round(guide / GUIDE_PRECISION_MM) * GUIDE_PRECISION_MM;
    if (!deduped.some((existing) => Math.abs(existing - rounded) < GUIDE_PRECISION_MM)) {
      deduped.push(rounded);
    }
  }

  return deduped.slice(0, MAX_GUIDES_PER_AXIS).sort((a, b) => a - b);
}

function getSmartSpacingIndicators(indicators: SpacingIndicator[]): SpacingIndicator[] {
  return indicators
    .filter((ind) => Math.abs(ind.lineEnd - ind.lineStart) >= MIN_SPACING_LENGTH_MM)
    .sort((a, b) => {
      const aLength = Math.abs(a.lineEnd - a.lineStart);
      const bLength = Math.abs(b.lineEnd - b.lineStart);
      return a.distance - b.distance || bLength - aLength;
    })
    .slice(0, MAX_SPACING_INDICATORS);
}

/**
 * Renders only the strongest active snap hints for the page being dragged.
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

  const smartGuides = useMemo(
    () => ({
      vertical: dedupeGuides(activeGuides.vertical),
      horizontal: dedupeGuides(activeGuides.horizontal),
    }),
    [activeGuides.horizontal, activeGuides.vertical]
  );

  const smartSpacingIndicators = useMemo(
    () => getSmartSpacingIndicators(spacingIndicators),
    [spacingIndicators]
  );

  if (!isDragging) return null;
  if (dragActivePageId && dragActivePageId !== pageId) return null;

  if (
    !smartGuides.vertical.length &&
    !smartGuides.horizontal.length &&
    !smartSpacingIndicators.length
  ) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-[45]">
      {smartGuides.vertical.map((x) => (
        <div
          key={`v-${x.toFixed(1)}`}
          className="absolute top-0 bottom-0 border-l border-blue-500/70 shadow-[0_0_6px_rgba(59,130,246,0.45)]"
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
      {smartGuides.horizontal.map((y) => (
        <div
          key={`h-${y.toFixed(1)}`}
          className="absolute left-0 right-0 border-t border-blue-500/70 shadow-[0_0_6px_rgba(59,130,246,0.45)]"
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
      {smartSpacingIndicators.map((ind) => {
        const isHorizontal = ind.side === 'left' || ind.side === 'right';
        const length = Math.abs(ind.lineEnd - ind.lineStart);

        return (
          <div
            key={`spacing-${ind.side}`}
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

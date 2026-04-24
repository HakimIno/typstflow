'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { memo, useMemo } from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // in mm
  scrollPos?: number;
  zoom?: number;
  unit?: string;
}

export const Ruler = memo(({ orientation, length, scrollPos = 0, zoom = 1.0, unit = 'mm' }: RulerProps) => {
  const isHorizontal = orientation === 'horizontal';
  const pxPerMm = LayoutEngine.mmToPx(1) * zoom;
  const totalPx = length * pxPerMm;

  const ticks = useMemo(() => {
    const result = [];
    // Render every 1mm
    for (let i = 0; i <= length; i++) {
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;
        
        result.push(
            <div
                key={i}
                className="absolute bg-[var(--text-muted)]"
                style={{
                    [isHorizontal ? 'left' : 'top']: `${i * pxPerMm}px`,
                    [isHorizontal ? 'bottom' : 'right']: 0,
                    [isHorizontal ? 'width' : 'height']: '1px',
                    [isHorizontal ? 'height' : 'width']: isMajor ? '12px' : isMedium ? '8px' : '4px',
                    opacity: isMajor ? 1 : 0.6,
                }}
            >
                {isMajor && (
                    <span 
                        className="absolute text-[8px] font-medium text-[var(--text-muted)]"
                        style={{
                            [isHorizontal ? 'left' : 'top']: '2px',
                            [isHorizontal ? 'bottom' : 'right']: '14px',
                            transform: isHorizontal ? 'none' : 'rotate(-90deg)',
                            transformOrigin: 'left bottom'
                        }}
                    >
                        {i}
                    </span>
                )}
            </div>
        );
    }
    return result;
  }, [length, isHorizontal, pxPerMm]);

  return (
    <div 
      className="relative bg-[var(--bg-surface)] overflow-hidden"
      style={{
        width: isHorizontal ? '100%' : '24px',
        height: isHorizontal ? '24px' : '100%',
      }}
    >
      <div 
        className="absolute inset-0"
        style={{
            transform: isHorizontal ? `translateX(${-scrollPos}px)` : `translateY(${-scrollPos}px)`,
            width: isHorizontal ? `${totalPx}px` : '100%',
            height: isHorizontal ? '100%' : `${totalPx}px`,
        }}
      >
        {ticks}
      </div>
    </div>
  );
});

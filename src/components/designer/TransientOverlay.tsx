'use client';

import { memo } from 'react';

/**
 * Global TransientOverlay
 *
 * This component handles high-frequency visual feedback (Alignment Guides,
 * Smart Spacing Indicators, etc.) as a singleton. Instead of one per page,
 * we have one for the entire drafting area.
 *
 * All positioning is done via direct DOM manipulation from DragMonitor
 * to avoid React re-renders during drag operations (60FPS).
 */
export const TransientOverlay = memo(function TransientOverlay() {
  return (
    <div
      id="global-transient-overlay"
      className="absolute inset-0 pointer-events-none z-[9999] overflow-hidden"
    >
      {/* Dynamic Alignment Guides (Maximum 4 per axis for performance) */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={`v-guide-${i}`}
          id={`v-guide-${i}`}
          className="absolute top-0 bottom-0 border-l border-magenta-500 border-dashed"
          style={{ display: 'none', borderColor: '#ff00ff', width: '1px' }}
        />
      ))}

      {[0, 1, 2, 3].map((i) => (
        <div
          key={`h-guide-${i}`}
          id={`h-guide-${i}`}
          className="absolute left-0 right-0 border-t border-magenta-500 border-dashed"
          style={{ display: 'none', borderColor: '#ff00ff', height: '1px' }}
        />
      ))}

      {/* Smart Spacing Indicators — 4 distance labels (left/right/top/bottom) */}
      {['left', 'right', 'top', 'bottom'].map((side) => (
        <div
          key={`spacing-${side}`}
          id={`spacing-${side}`}
          className="absolute flex items-center justify-center"
          style={{ display: 'none' }}
        >
          {/* The measurement line */}
          <div
            id={`spacing-line-${side}`}
            className="absolute"
            style={{
              backgroundColor: '#f43f5e',
              ...(side === 'left' || side === 'right'
                ? { height: '1px', width: '100%' }
                : { width: '1px', height: '100%' }),
            }}
          />
          {/* The distance label pill */}
          <div
            id={`spacing-label-${side}`}
            className="absolute px-1 py-0.5 bg-[#f43f5e] text-white text-[8px] font-mono font-bold rounded shadow-sm z-[10001] whitespace-nowrap"
            style={{ lineHeight: '1' }}
          >
            0mm
          </div>
        </div>
      ))}

      {/* Equal Spacing Indicators */}
      {[0, 1].map((i) => (
        <div
          key={`eq-spacing-${i}`}
          id={`eq-spacing-${i}`}
          className="absolute"
          style={{
            display: 'none',
            backgroundColor: '#8b5cf6',
            opacity: 0.6,
          }}
        />
      ))}

      {/* Floating Coordinate Pill */}
      <div
        id="drag-coord-pill"
        className="absolute hidden px-2 py-1 bg-[var(--accent)] text-white text-[10px] font-mono rounded shadow-lg z-[10000]"
        style={{ transform: 'translate(0, 0)' }}
      >
        0, 0
      </div>
    </div>
  );
});

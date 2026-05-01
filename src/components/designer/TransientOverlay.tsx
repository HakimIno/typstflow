'use client';

import { memo } from 'react';

/**
 * Global TransientOverlay
 *
 * This component handles high-frequency visual feedback (Alignment Guides, etc.)
 * as a singleton. Instead of one per page, we have one for the entire drafting area.
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

'use client';

import type { MouseEvent as ReactMouseEvent } from 'react';

/** start/end segment — column handles: px (top→bottom); row handles: % (left→right) */
export interface HandleSegment {
  start: number;
  end: number;
}

interface ColumnResizeHandleProps {
  index: number;
  cumPercent: number;
  headerMidPx: number;
  onMouseDown: (e: ReactMouseEvent) => void;
  /** Pixel segments where the line is visible. Undefined = full height. */
  segments?: HandleSegment[];
}

export function ColumnResizeHandle({
  index,
  cumPercent,
  headerMidPx,
  onMouseDown,
  segments,
}: ColumnResizeHandleProps) {
  const pillTop = Math.max(headerMidPx, 10);
  const useSegments = segments != null && segments.length > 0;

  return (
    <div
      data-col-handle-idx={index}
      className="absolute top-0 bottom-0 z-[25] pointer-events-auto cursor-col-resize group/colresizer"
      style={{ left: `calc(${cumPercent}% - 4px)`, width: '8px' }}
      onMouseDown={onMouseDown}
    >
      {/* Segmented or full-height divider line */}
      {useSegments ? (
        segments.map((seg, i) => (
          <div
            key={i}
            data-col-divider={index}
            className="absolute left-1/2 -translate-x-1/2 w-px bg-[var(--accent)] opacity-40 group-hover/colresizer:opacity-90 transition-opacity"
            style={{ top: seg.start, height: seg.end - seg.start }}
          />
        ))
      ) : (
        <div
          data-col-divider={index}
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--accent)] opacity-40 group-hover/colresizer:opacity-90 transition-opacity"
        />
      )}

      {/* Single vertical pill at header level — matches the column's vertical line */}
      <div
        aria-hidden
        className="absolute left-1/2 w-[5px] h-3 rounded-full border border-[var(--accent)] bg-white shadow-sm pointer-events-none opacity-80 group-hover/colresizer:opacity-100 group-hover/colresizer:scale-110 transition-all"
        style={{ top: pillTop, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

interface RowResizeHandleProps {
  rowId: string;
  onMouseDown: (e: ReactMouseEvent) => void;
  /** Percentage segments where the line is visible. Undefined = full width. */
  segments?: HandleSegment[];
}

export function RowResizeHandle({ rowId, onMouseDown, segments }: RowResizeHandleProps) {
  const useSegments = segments != null && segments.length > 0;
  // Center of the combined visible range — where the affordance pill sits
  const midPct = useSegments
    ? (segments[0].start + segments[segments.length - 1].end) / 2
    : 50;

  return (
    <div
      data-row-divider={rowId}
      className="absolute left-0 right-0 z-[25] h-[8px] pointer-events-auto cursor-row-resize group/rowresizer"
      style={{ top: 0, transform: 'translateY(-50%)' }}
      onMouseDown={onMouseDown}
    >
      {/* Segmented or full-width divider line */}
      {useSegments ? (
        segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--accent)] opacity-40 group-hover/rowresizer:opacity-90 transition-opacity"
            style={{ left: `${seg.start}%`, width: `${seg.end - seg.start}%` }}
          />
        ))
      ) : (
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--accent)] opacity-40 group-hover/rowresizer:opacity-90 transition-opacity" />
      )}

      {/* Single horizontal pill at center — matches the row's horizontal line */}
      <div
        aria-hidden
        className="absolute top-1/2 h-[5px] w-3 rounded-full border border-[var(--accent)] bg-white shadow-sm pointer-events-none opacity-80 group-hover/rowresizer:opacity-100 group-hover/rowresizer:scale-110 transition-all"
        style={{ left: `${midPct}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

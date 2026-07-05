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
  // An empty (but defined) segment list means this boundary lies entirely inside a
  // merged cell — there is no divider here, so render nothing.
  if (segments != null && segments.length === 0) return null;

  const pillTop = Math.max(headerMidPx, 10);
  const useSegments = segments != null && segments.length > 0;
  const lineStart = useSegments ? Math.min(...segments.map((seg) => seg.start)) : 0;
  const lineEnd = useSegments ? Math.max(...segments.map((seg) => seg.end)) : 0;
  // Keep the pill at header level when that spot is on a visible segment; otherwise
  // centre it in the widest visible segment so it never sits over a merged gap.
  const pillSegment =
    useSegments && segments.find((seg) => pillTop >= seg.start && pillTop <= seg.end);
  const widestSeg =
    useSegments && !pillSegment
      ? segments.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a))
      : null;
  const visiblePillTop = pillSegment
    ? pillTop
    : widestSeg
      ? (widestSeg.start + widestSeg.end) / 2
      : pillTop;

  return (
    <div
      data-col-handle-idx={index}
      className="absolute z-[25] pointer-events-auto cursor-col-resize group/colresizer"
      style={{
        left: `calc(${cumPercent}% - 4px)`,
        top: lineStart,
        width: '8px',
        height: Math.max(lineEnd - lineStart, 1),
      }}
      onMouseDown={onMouseDown}
    >
      {/* Segmented or full-height divider line */}
      {useSegments ? (
        segments.map((seg, i) => (
          <div
            key={i}
            data-col-divider={index}
            className="absolute left-1/2 -translate-x-1/2 w-px bg-[var(--accent)] opacity-0 group-hover/colresizer:opacity-90 transition-opacity"
            style={{ top: seg.start - lineStart, height: seg.end - seg.start }}
          />
        ))
      ) : (
        <div
          data-col-divider={index}
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--accent)] opacity-0 group-hover/colresizer:opacity-90 transition-opacity"
        />
      )}

      {/* Single vertical pill at header level — matches the column's vertical line */}
      <div
        aria-hidden
        className="absolute left-1/2 w-[5px] h-3 rounded-full border border-[var(--accent)] bg-white shadow-sm pointer-events-none opacity-55 group-hover/colresizer:opacity-100 group-hover/colresizer:scale-110 transition-all"
        style={{ top: visiblePillTop - lineStart, transform: 'translate(-50%, -50%)' }}
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
  // An empty (but defined) segment list means this boundary lies entirely inside a
  // merged cell — there is no divider here, so render nothing.
  if (segments != null && segments.length === 0) return null;

  const useSegments = segments != null && segments.length > 0;
  // Pill sits at the centre of the WIDEST visible segment so it never lands in a
  // merged gap (which would leave a stray dot floating over a merged cell).
  const midPct = useSegments
    ? (() => {
        const widest = segments.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
        return (widest.start + widest.end) / 2;
      })()
    : 50;

  return (
    <div
      data-row-divider={rowId}
      className="absolute left-0 right-0 z-[25] h-[8px] pointer-events-auto cursor-row-resize group/rowresizer"
      // `top` is set imperatively by TablePreview's layout pass. Deliberately NOT
      // set here so React doesn't reset it to 0 on every render — that would make
      // the divider jump whenever the layout pass is skipped (e.g. on cell clicks).
      style={{ transform: 'translateY(-50%)' }}
      onMouseDown={onMouseDown}
    >
      {/* Segmented or full-width divider line */}
      {useSegments ? (
        segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--accent)] opacity-0 group-hover/rowresizer:opacity-90 transition-opacity"
            style={{ left: `${seg.start}%`, width: `${seg.end - seg.start}%` }}
          />
        ))
      ) : (
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--accent)] opacity-0 group-hover/rowresizer:opacity-90 transition-opacity" />
      )}

      {/* Single horizontal pill at center — matches the row's horizontal line */}
      <div
        aria-hidden
        className="absolute top-1/2 h-[5px] w-3 rounded-full border border-[var(--accent)] bg-white shadow-sm pointer-events-none opacity-55 group-hover/rowresizer:opacity-100 group-hover/rowresizer:scale-110 transition-all"
        style={{ left: `${midPct}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}

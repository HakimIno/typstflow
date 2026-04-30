'use client';

import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';
import { memo, useRef } from 'react';
import { ComponentWrapper } from './ComponentWrapper';

import { useZoneDropTarget } from '@/hooks/use-zone-drop-target';
import { useZoneResize } from '@/hooks/use-zone-resize';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
  pageId?: string;
  minHeight?: string;
  resizeEdge?: 'top' | 'bottom' | 'none';
}

export const Zone = memo(function Zone({
  zoneKey,
  label,
  components,
  pageId,
  minHeight,
  resizeEdge = 'bottom',
}: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { isResizing, localHeight, handleResizeStart } = useZoneResize(
    zoneKey,
    minHeight || '50',
    components,
    resizeEdge,
    pageId
  );
  const { isDraggedOver } = useZoneDropTarget(zoneKey, contentRef, pageId);

  return (
    <div
      ref={containerRef}
      style={resizeEdge === 'none' ? { flex: 1 } : { height: `${localHeight}mm` }}
      className={clsx(
        'relative border-b last:border-b-0 border-dashed border-slate-200 transition-colors group/zone bg-transparent',
        isDraggedOver && 'bg-[var(--accent-glow)]/50',
        isResizing && 'ring-1 ring-[var(--accent)] z-50 shadow-lg'
      )}
    >
      {/* Vertical Side Label (External to Paper) */}
      <div className="absolute -left-10 top-0 bottom-0 w-10 flex flex-col items-center justify-center pointer-events-none select-none z-10 opacity-60 group-hover/zone:opacity-100 transition-opacity">
        <div className="absolute inset-y-0 right-0 w-px bg-[var(--border-default)]" />
        <span
          className={clsx(
            'text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] whitespace-nowrap'
          )}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {label}
        </span>
      </div>

      <div
        ref={contentRef}
        className="relative w-full h-full bg-transparent overflow-visible min-h-[inherit]"
      >
        {components.length === 0 && !isDraggedOver ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-40 select-none pointer-events-none">
            <Layers className="w-6 h-6 mb-1" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-center px-4">
              {label} EMPTY
              <br />
              <span className="text-[7px] font-medium tracking-normal opacity-60">
                DRAG COMPONENTS HERE
              </span>
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-visible">
            {components.map((comp) => (
              <ComponentWrapper key={comp.id} component={comp} zoneKey={zoneKey} pageId={pageId} />
            ))}
          </div>
        )}
      </div>

      {/* Height Indicator Label */}
      {isResizing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-[10px] px-2 py-1 rounded shadow-lg z-[60] font-mono">
          HEIGHT: {localHeight.toFixed(1)}mm
        </div>
      )}

      {/* Resize Handle */}
      {resizeEdge !== 'none' && (
        <div
          onMouseDown={handleResizeStart}
          className={clsx(
            'absolute left-0 right-0 h-2 cursor-ns-resize z-40 group/resize flex items-center justify-center',
            resizeEdge === 'top' ? '-top-1' : '-bottom-1'
          )}
        >
          {/* Visual Line */}
          <div
            className={clsx(
              'absolute left-0 right-0 h-[1.5px] transition-colors',
              isResizing
                ? 'bg-[var(--accent)]'
                : 'group-hover/resize:bg-[var(--accent)] group-hover/zone:bg-[var(--border-default)] bg-transparent'
            )}
          />

          {/* Full-width Horizontal Guide Line during Resize */}
          {isResizing && (
            <div className="absolute top-1/2 -translate-y-1/2 -left-[2000px] -right-[2000px] border-b border-dashed border-[var(--accent)] opacity-50 pointer-events-none" />
          )}

          {/* Drag Dots (Smaller) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/zone:opacity-100 transition-opacity z-10">
            <div className="w-1 h-1 rounded-full bg-[var(--accent)] shadow-sm" />
            <div className="w-1 h-1 rounded-full bg-[var(--accent)] shadow-sm" />
            <div className="w-1 h-1 rounded-full bg-[var(--accent)] shadow-sm" />
          </div>
        </div>
      )}
    </div>
  );
});

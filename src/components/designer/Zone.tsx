'use client';

import type { ComponentNode } from '@/types/schema';
import { clsx } from 'clsx';
import { Layers } from 'lucide-react';
import { memo, useRef } from 'react';
import { ComponentWrapper } from './component-wrapper';

import { useZoneDropTarget } from '@/hooks/use-zone-drop-target';
import { useZoneResize } from '@/hooks/use-zone-resize';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
  components: ComponentNode[];
  pageId?: string;
  minHeight?: string;
  resizeEdge?: 'top' | 'bottom' | 'none';
  pageIndex?: number;
  isGroupBand?: boolean;
  groupType?: 'header' | 'footer';
  groupId?: string;
  hidden?: boolean;
}

export const Zone = memo(function Zone({
  zoneKey,
  label,
  components,
  pageId,
  minHeight,
  resizeEdge = 'bottom',
  pageIndex,
  isGroupBand,
  groupType,
  groupId,
  hidden,
}: ZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const { isResizing, handleResizeStart } = useZoneResize(
    zoneKey,
    minHeight || '50',
    components,
    containerRef,
    labelRef,
    resizeEdge,
    pageId,
    groupId,
    groupType
  );
  const { isDraggedOver } = useZoneDropTarget(zoneKey, contentRef, pageId, groupId, groupType);

  return (
    <div
      ref={containerRef}
      data-is-group-band={isGroupBand}
      data-group-id={groupId}
      data-group-type={groupType}
      style={resizeEdge === 'none' ? { flex: 1 } : { height: minHeight || '50mm' }}
      className={clsx(
        'relative border-b last:border-b-0 border-dashed border-slate-200 group/zone bg-transparent overflow-visible',
        !isResizing && 'transition-all duration-300',
        isGroupBand && (groupType === 'header' ? 'bg-indigo-500/[0.03]' : 'bg-fuchsia-500/[0.03]'),
        isDraggedOver && 'bg-[var(--accent-glow)]/50',
        isResizing && 'ring-1 ring-[var(--accent)] z-50 shadow-lg !transition-none will-change-[height] [contain:size_layout]',
        hidden && 'border-none'
      )}
    >
      {/* Vertical Side Label (External to Paper) */}
      {!hidden && (
        <div className="absolute -left-10 top-0 bottom-0 w-10 flex flex-col items-center justify-center pointer-events-none select-none z-10 opacity-60 group-hover/zone:opacity-100 transition-opacity">
          <div className="absolute inset-y-0 right-0 w-px bg-[var(--border-default)]" />
          <span
            className={clsx(
              'text-[8px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] whitespace-nowrap px-1 py-4 rounded-l-md',
              isGroupBand &&
                (groupType === 'header'
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-fuchsia-400 bg-fuchsia-500/10')
            )}
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {label}
          </span>
        </div>
      )}

      <div
        ref={contentRef}
        data-zone-key={zoneKey}
        data-page-id={pageId}
        data-group-id={groupId}
        data-group-type={groupType}
        className="relative w-full h-full bg-transparent overflow-visible min-h-[inherit]"
      >
        {components.length === 0 && !isDraggedOver ? (
          !hidden && (
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
          )
        ) : (
          <div className="absolute inset-0 overflow-visible">
            {components.map((comp) => (
              <ComponentWrapper
                key={`${pageId ?? 'global'}-${comp.id}`}
                component={comp}
                zoneKey={zoneKey}
                pageId={pageId}
                pageIndex={pageIndex}
              />
            ))}
          </div>
        )}
      </div>

      {/* Height Indicator Label */}
      {isResizing && (
        <div
          ref={labelRef}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-[10px] px-2 py-1 rounded shadow-lg z-[60] font-mono"
        >
          HEIGHT: {Number.parseFloat(minHeight || '50').toFixed(1)}mm
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

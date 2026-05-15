'use client';

import { useZoneDropTarget } from '@/hooks/use-zone-drop-target';
import { useZoneResize } from '@/hooks/use-zone-resize';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getZoneComponents } from '@/lib/utils/schema-mutators';
import { useDesignerStore } from '@/store/designer-store';
import { cn } from '@/lib/utils/cn';
import { clsx } from 'clsx';
import { Layers, Workflow, Move } from 'lucide-react';
import { memo, useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ComponentWrapper } from './component-wrapper';

interface ZoneProps {
  zoneKey: 'header' | 'body' | 'footer';
  label: string;
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

  // ✅ Subscribes ONLY to its own component IDs list
  const componentIds = useDesignerStore(
    useShallow((s) => getZoneComponents(s.schema, zoneKey, pageId).map((c) => c.id))
  );

  const isFlowZone = useDesignerStore((s) => {
    if (zoneKey === 'body') {
      const page = s.schema.pages.find((p) => p.id === pageId) ?? s.schema.pages[0];
      return page?.body.layoutMode === 'flow';
    }
    return s.schema.zones[zoneKey as 'header' | 'footer']?.layoutMode === 'flow';
  });

  const updateZone = useDesignerStore((s) => s.updateZone);

  const toggleLayoutMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateZone(zoneKey, { layoutMode: isFlowZone ? 'absolute' : 'flow' }, pageId);
  }, [zoneKey, pageId, isFlowZone, updateZone]);

  const { isResizing, handleResizeStart } = useZoneResize(
    zoneKey,
    minHeight || '50',
    [], // This hook might need the full components, but let's see
    containerRef,
    labelRef,
    resizeEdge,
    pageId,
    groupId,
    groupType
  );
  const { isDraggedOver } = useZoneDropTarget(zoneKey, contentRef, pageId, groupId, groupType, isFlowZone);

  // Heights (px) in array order — used to compute slot positions for the drop highlight.
  const flowHeightsPx = useDesignerStore(
    useShallow((s) =>
      getZoneComponents(s.schema, zoneKey, pageId).map((c) => LayoutEngine.mmToPx(c.height ?? 10))
    )
  );

  // Cumulative slot tops: flowSlotTops[i] = top of slot i (px from zone top).
  const flowSlotTops = useMemo(() => {
    const tops = [0];
    for (const h of flowHeightsPx) tops.push(tops[tops.length - 1] + h);
    return tops;
  }, [flowHeightsPx]);

  // Ref so the event listener always sees the latest slot data without re-registering.
  const flowSlotsRef = useRef({ heights: flowHeightsPx, tops: flowSlotTops });
  useEffect(() => { flowSlotsRef.current = { heights: flowHeightsPx, tops: flowSlotTops }; }, [flowHeightsPx, flowSlotTops]);

  const [dragHighlight, setDragHighlight] = useState<{ topPx: number; heightPx: number } | null>(null);

  useEffect(() => {
    if (!isFlowZone) return;

    const onMove = (e: Event) => {
      const { clientX, clientY } = (e as CustomEvent<{ clientX: number; clientY: number }>).detail;
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setDragHighlight(null);
        return;
      }
      const cursorYpx = clientY - rect.top;
      const { heights, tops } = flowSlotsRef.current;
      // Find which slot the cursor is inside
      let slotIdx = heights.length; // default: after last element
      for (let i = 0; i < tops.length - 1; i++) {
        if (cursorYpx < tops[i + 1]) { slotIdx = i; break; }
      }
      if (slotIdx < heights.length) {
        setDragHighlight({ topPx: tops[slotIdx], heightPx: heights[slotIdx] });
      } else {
        setDragHighlight({ topPx: tops[tops.length - 1] ?? 0, heightPx: LayoutEngine.mmToPx(10) });
      }
    };

    const onEnd = () => setDragHighlight(null);
    window.addEventListener('flow-drag-move', onMove);
    window.addEventListener('flow-drag-end', onEnd);
    return () => {
      window.removeEventListener('flow-drag-move', onMove);
      window.removeEventListener('flow-drag-end', onEnd);
    };
  }, [isFlowZone]);

  return (
    <div
      ref={containerRef}
      data-is-group-band={isGroupBand}
      data-group-id={groupId}
      data-group-type={groupType}
      style={
        hidden
          ? { height: 0, overflow: 'hidden', border: 'none' }
          : resizeEdge === 'none'
            ? { flex: 1 }
            : isFlowZone
              ? { minHeight: minHeight || '50mm' }
              : { height: minHeight || '50mm' }
      }
      className={clsx(
        'relative border-b last:border-b-0 border-dashed border-slate-200 group/zone bg-transparent overflow-visible',
        isGroupBand && (groupType === 'header' ? 'bg-indigo-500/[0.03]' : 'bg-fuchsia-500/[0.03]'),
        isDraggedOver && 'bg-[var(--accent-glow)]/50',
        isResizing &&
        'ring-1 ring-[var(--accent)] z-50 shadow-lg !transition-none will-change-[height] [contain:size_layout]',
        hidden && 'pointer-events-none'
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

      {/* Layout Mode Toggle (External to Paper - Right Side) */}
      {!hidden && (
        <div className={cn(
          "absolute left-full top-16 -translate-y-1/2 z-20 flex items-center transition-opacity",
          isFlowZone ? "opacity-100" : "opacity-0 group-hover/zone:opacity-100"
        )}>
          <button
            type="button"
            onClick={toggleLayoutMode}
            className={cn(
              "group/toggle flex flex-col items-center gap-1.5 py-2 px-1 rounded-r-xl border border-l-0  hover:pl-3 bg-black",
              isFlowZone
                ? "border-blue-500 text-blue-500 "
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
            title={isFlowZone ? "Switch to Absolute Layout" : "Switch to Flow Layout"}
          >
            {isFlowZone ? (
              <Workflow className="w-4 h-4 " />
            ) : (
              <Move className="w-4 h-4 group-hover/toggle:rotate-12 transition-transform" />
            )}
            <span
              className="text-[7px] font-black uppercase tracking-[0.2em] leading-none"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {isFlowZone ? 'Flow' : 'Fixed'}
            </span>
          </button>
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
        {!hidden && (
          <>
            {/* Layout content starts here */}

            {componentIds.length === 0 && !isDraggedOver ? (
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
            ) : isFlowZone ? (
              <div className="relative w-full min-h-full flex flex-col overflow-visible">
                {/* Drop highlight overlay — height matches the target slot */}
                {dragHighlight && (
                  <div
                    className="absolute left-0 right-0 bg-[var(--accent-glow)]/40 border-y-2 border-[var(--accent)]/60 pointer-events-none z-[5]"
                    style={{ top: dragHighlight.topPx, height: dragHighlight.heightPx }}
                  />
                )}

                {componentIds.map((id, i) => (
                  <div
                    key={`${pageId ?? 'global'}-${id}`}
                    className="relative w-full shrink-0"
                  >
                    <ComponentWrapper
                      componentId={id}
                      zoneKey={zoneKey}
                      pageId={pageId}
                      pageIndex={pageIndex}
                      flowMode
                    />
                    {/* Divider line at the bottom of each element */}
                    {i < componentIds.length - 1 && (
                      <div className="absolute bottom-0 left-0 right-0 h-px border-b border-dashed border-slate-300/25 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 overflow-visible">
                {componentIds.map((id) => (
                  <ComponentWrapper
                    key={`${pageId ?? 'global'}-${id}`}
                    componentId={id}
                    zoneKey={zoneKey}
                    pageId={pageId}
                    pageIndex={pageIndex}
                  />
                ))}
              </div>
            )}
          </>
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
      {resizeEdge !== 'none' && !hidden && (
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

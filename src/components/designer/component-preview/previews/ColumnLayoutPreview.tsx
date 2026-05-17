'use client';

import React, { useRef } from 'react';
import type { ColumnLayoutComponent } from '@/types/schema';
import { ComponentWrapper } from '../../component-wrapper/ComponentWrapper';
import { findComponentZone } from '@/lib/utils/schema-mutators';
import { useDesignerStore } from '@/store/designer-store';
import { useColumnDropTarget } from '@/hooks/use-column-drop-target';
import { LayoutEngine } from '@/lib/engine/layout-engine';
import { cn } from '@/lib/utils/cn';

interface Props {
  component: ColumnLayoutComponent;
  pageIndex?: number;
  totalPages?: number;
}

/**
 * Converts a column width string from the schema into a valid CSS grid column value.
 */
function toCssGridWidth(w: string): string {
  if (!w) return '1fr';
  if (w.endsWith('fr')) return w;
  if (/^\d+(\.\d+)?(mm|cm|pt|px|%)$/.test(w)) return w;
  if (w === 'auto') return 'auto';
  return '1fr';
}

export function ColumnLayoutPreview({ component, pageIndex, totalPages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const schema = useDesignerStore((s) => s.schema);
  const zoom = useDesignerStore((s) => s.zoom);
  const updateComponent = useDesignerStore((s) => s.updateComponent);

  const isSelected = useDesignerStore((s) => s.selectedComponentIds.includes(component.id));

  const zoneInfo = findComponentZone(schema, component.id);
  const zoneKey = zoneInfo?.zoneKey || 'body';
  const pageId = zoneInfo?.pageId;

  const gap = component.gap ?? '10mm';

  // 1. Generate columns for CSS Grid template
  // We insert a resizer track of the exact 'gap' width between each column slot
  const colTracks: string[] = [];
  component.columns.forEach((col, idx) => {
    colTracks.push(toCssGridWidth(col.width));
    if (idx < component.columns.length - 1) {
      colTracks.push(gap); // Gutter track size equals columns gap
    }
  });
  const gridTemplateColumns = colTracks.join(' ');

  // 2. Drag resize mouse handlers
  const handleSplitterMouseDown = (e: React.MouseEvent, leftColIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const gridEl = containerRef.current;
    if (!gridEl) return;

    // Find all column slot DOM elements to measure their current client widths
    const columnSlotEls = Array.from(gridEl.children).filter((child) =>
      child.classList.contains('column-slot-wrapper')
    ) as HTMLElement[];

    if (columnSlotEls.length !== component.columns.length) return;

    // Calculate initial column widths in millimeters
    const initialWidthsMm = columnSlotEls.map((el) => {
      const rect = el.getBoundingClientRect();
      return LayoutEngine.pxToMm(rect.width / zoom);
    });

    // Parse the initial fr values of all columns
    const initialFrs = component.columns.map((col, idx) => {
      const w = col.width || '1fr';
      if (w.endsWith('fr')) {
        return parseFloat(w) || 1.0;
      }
      // If it's in absolute mm, convert it to an fr representation proportional to its DOM width
      const totalMm = initialWidthsMm.reduce((a, b) => a + b, 0);
      const N = component.columns.length;
      return (initialWidthsMm[idx] / totalMm) * N;
    });

    const startX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      // Convert screen pixel delta to millimeter scale
      const dxMm = LayoutEngine.pxToMm(dx / zoom);

      // Adjust left and right adjacent columns visually
      const leftColWidth = initialWidthsMm[leftColIdx];
      const rightColWidth = initialWidthsMm[leftColIdx + 1];

      const minWidthMm = 10; // minimum column width to prevent collapse
      const newLeftWidth = Math.max(minWidthMm, leftColWidth + dxMm);
      // The sum of visual widths of the two columns remains constant
      const newRightWidth = Math.max(minWidthMm, leftColWidth + rightColWidth - newLeftWidth);

      // Calculate new fractional proportions (fr) based on the visual widths
      const adjustedFrSum = initialFrs[leftColIdx] + initialFrs[leftColIdx + 1];
      const newLeftFr = (newLeftWidth / (leftColWidth + rightColWidth)) * adjustedFrSum;
      const newRightFr = (newRightWidth / (leftColWidth + rightColWidth)) * adjustedFrSum;

      // Adjust column sizes immutably using fr units for perfect responsiveness
      const updatedCols = component.columns.map((col, idx) => {
        if (idx === leftColIdx) {
          return { ...col, width: `${Math.round(newLeftFr * 100) / 100}fr` };
        }
        if (idx === leftColIdx + 1) {
          return { ...col, width: `${Math.round(newRightFr * 100) / 100}fr` };
        }
        // Preserve other columns in fr format (if they are fr) or their original format
        const colFr = initialFrs[idx];
        return { ...col, width: `${Math.round(colFr * 100) / 100}fr` };
      });

      // Quick visual updates — bypass undo/redo history to prevent lag
      updateComponent(component.id, { columns: updatedCols }, true);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      // Commit final column layouts — registers undo/redo history action
      const currentLatestState = useDesignerStore.getState().componentRegistry[
        component.id
      ] as ColumnLayoutComponent;
      if (currentLatestState) {
        updateComponent(component.id, { columns: currentLatestState.columns }, false);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[60px]"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: '0px', // We use explicit gutter tracks, so no grid container gaps
      }}
    >
      {component.columns.map((col, colIdx) => {
        return (
          <React.Fragment key={colIdx}>
            {/* Column Slot Container */}
            <ColumnSlot
              columnLayoutId={component.id}
              colIdx={colIdx}
              col={col}
              zoneKey={zoneKey}
              pageId={pageId}
              pageIndex={pageIndex}
              totalPages={totalPages}
            />

            {/* Splitter Resizer handle rendered between adjacent column slots */}
            {colIdx < component.columns.length - 1 && (
              <div
                data-col-splitter="true"
                className="w-full h-full cursor-col-resize group/resizer relative select-none z-30"
                onMouseDown={(e) => handleSplitterMouseDown(e, colIdx)}
              >
                {/* Visual hover indicator line centered inside the gutter */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] h-full bg-slate-700/30 group-hover/resizer:bg-[var(--accent)] group-hover/resizer:scale-x-150 transition-all rounded-full" />

                {/* Premium pill-shaped handle centered vertically in the middle of the splitter height */}
                {isSelected && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-white border-[1.5px] border-[var(--accent)] w-1.5 h-4 rounded-full shadow-sm flex items-center justify-center pointer-events-none transition-all group-hover/resizer:scale-110">
                    {/* Subtle vertical grip indicator dots */}
                    <div className="flex flex-col gap-[2px]">
                      <div className="w-[1.5px] h-[1.5px] bg-[var(--accent)] rounded-full" />
                      <div className="w-[1.5px] h-[1.5px] bg-[var(--accent)] rounded-full" />
                      <div className="w-[1.5px] h-[1.5px] bg-[var(--accent)] rounded-full" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

interface ColumnSlotProps {
  columnLayoutId: string;
  colIdx: number;
  col: any;
  zoneKey: any;
  pageId: any;
  pageIndex: any;
  totalPages: any;
}

function ColumnSlot({
  columnLayoutId,
  colIdx,
  col,
  zoneKey,
  pageId,
  pageIndex,
  totalPages,
}: ColumnSlotProps) {
  const { isDraggedOver, ref } = useColumnDropTarget(columnLayoutId, colIdx);

  return (
    <div
      ref={ref}
      className={cn(
        'column-slot-wrapper flex flex-col relative w-full min-h-[50px] rounded-lg transition-all border border-transparent',
        isDraggedOver
          ? 'bg-[var(--accent-glow)]/15 border-dashed border-[var(--accent)]'
          : 'bg-transparent hover:border-slate-800/10 dark:hover:border-slate-300/5'
      )}
      style={{ gap: '6px', padding: '4px' }}
    >
      {col.components.map((child: any) => (
        <ComponentWrapper
          key={child.id}
          componentId={child.id}
          zoneKey={zoneKey}
          pageId={pageId}
          pageIndex={pageIndex}
          flowMode={true}
          isNested={true}
        />
      ))}

      {col.components.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center border border-dashed border-slate-700/50 p-2 select-none pointer-events-none">
          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">
            Empty Column
          </span>
        </div>
      )}
    </div>
  );
}

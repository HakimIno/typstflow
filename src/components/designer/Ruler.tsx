import { LayoutEngine } from '@/lib/engine/layout-engine';
import { getPaperDimensions } from '@/lib/utils/paper-sizes';
import {
  horizontalRulerClickToMm,
  pageMmToRulerPx,
  verticalRulerClickToMm,
} from '@/lib/utils/ruler-guide-coords';
import { useDesignerStore } from '@/store/designer-store';
import { memo, useCallback, useRef } from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // in mm
  scrollPos?: number;
  zoom?: number;
  pageWidthMm: number;
  pageHeightMm: number;
  pageGapMm: number;
  guideMarks?: number[];
}

/**
 * CSS-gradient ruler. Double-click to toggle a guide at that position.
 */
export const Ruler = memo(
  ({
    orientation,
    length,
    scrollPos = 0,
    zoom = 1.0,
    pageWidthMm,
    pageHeightMm,
    pageGapMm,
    guideMarks = [],
  }: RulerProps) => {
    const isHorizontal = orientation === 'horizontal';
    const pxPerMm = LayoutEngine.mmToPx(1) * zoom;

    const tickColor = 'var(--text-muted)';
    const majorTickColor = 'var(--text-secondary)';

    const dragRef = useRef<{
      axis: 'vertical' | 'horizontal';
      startX: number;
      startY: number;
      moved: boolean;
      currentValue: number;
      paperContainer: HTMLElement | null;
    } | null>(null);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const axis = isHorizontal ? 'horizontal' : 'vertical';
        dragRef.current = {
          axis,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
          currentValue: 0,
          paperContainer: null,
        };

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      },
      [isHorizontal]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;

        if (
          !drag.moved &&
          Math.abs(e.clientX - drag.startX) < 3 &&
          Math.abs(e.clientY - drag.startY) < 3
        ) {
          return;
        }

        drag.moved = true;

        // Find the paper container under the pointer
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let paper = elements.find((el) => el.hasAttribute('data-paper-container')) as HTMLElement | null;
        if (!paper) {
          paper = document.querySelector('[data-paper-container]') as HTMLElement | null;
        }

        if (!paper) return;

        const rect = paper.getBoundingClientRect();
        const zoomVal = Number.parseFloat(paper.dataset.zoom || '1');
        const { schema } = useDesignerStore.getState();
        const { width, height } = getPaperDimensions(schema.page.size, schema.page.orientation);

        let clamped = 0;
        if (drag.axis === 'horizontal') {
          // Dragging down from top ruler -> horizontal line (Y coordinate)
          const mm = LayoutEngine.snap(LayoutEngine.pxToMm((e.clientY - rect.top) / zoomVal), 1);
          clamped = Math.max(0, Math.min(height, mm));
        } else {
          // Dragging right from left ruler -> vertical line (X coordinate)
          const mm = LayoutEngine.snap(LayoutEngine.pxToMm((e.clientX - rect.left) / zoomVal), 1);
          clamped = Math.max(0, Math.min(width, mm));
        }

        drag.currentValue = clamped;

        // Manage temporary DOM indicator
        let tempLine = document.getElementById('temp-ruler-guide');
        if (!tempLine) {
          tempLine = document.createElement('div');
          tempLine.id = 'temp-ruler-guide';
          tempLine.className = 'absolute pointer-events-none z-[38] overflow-visible';
          
          const innerLine = document.createElement('div');
          innerLine.className = 'absolute border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]';
          
          const badge = document.createElement('div');
          badge.id = 'temp-ruler-guide-badge';
          badge.className = 'absolute bg-blue-600 text-[8px] font-bold text-white px-1 py-0.5 rounded shadow-md whitespace-nowrap z-10';

          if (drag.axis === 'horizontal') {
            tempLine.style.left = '0';
            tempLine.style.right = '0';
            tempLine.style.height = '6px';
            tempLine.style.marginTop = '-3px';
            tempLine.style.cursor = 'row-resize';

            innerLine.className += ' absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t';
            innerLine.style.height = '1px';

            badge.style.left = '12px';
            badge.style.top = '6px';
          } else {
            tempLine.style.top = '0';
            tempLine.style.bottom = '0';
            tempLine.style.width = '6px';
            tempLine.style.marginLeft = '-3px';
            tempLine.style.cursor = 'col-resize';

            innerLine.className += ' absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l';
            innerLine.style.width = '1px';

            badge.style.top = '12px';
            badge.style.left = '6px';
          }

          tempLine.appendChild(innerLine);
          tempLine.appendChild(badge);
        }

        // If the paper container has changed, move the element
        if (drag.paperContainer !== paper) {
          if (tempLine.parentNode) {
            tempLine.parentNode.removeChild(tempLine);
          }
          paper.appendChild(tempLine);
          drag.paperContainer = paper;
        }

        // Update position and badge text
        if (drag.axis === 'horizontal') {
          tempLine.style.top = `${LayoutEngine.mmToPx(clamped)}px`;
        } else {
          tempLine.style.left = `${LayoutEngine.mmToPx(clamped)}px`;
        }

        const badge = document.getElementById('temp-ruler-guide-badge');
        if (badge) {
          badge.textContent = `${clamped.toFixed(1)}mm`;
        }
      },
      []
    );

    const handlePointerUp = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;

        if (drag.moved) {
          // Remove the temporary guide from DOM
          const tempLine = document.getElementById('temp-ruler-guide');
          if (tempLine && tempLine.parentNode) {
            tempLine.parentNode.removeChild(tempLine);
          }

          // Add the manual guide permanently to the store
          const { addManualGuide } = useDesignerStore.getState();
          addManualGuide(drag.axis, drag.currentValue);
        }

        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (_err) {}
        dragRef.current = null;
      },
      []
    );

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const { toggleManualGuide } = useDesignerStore.getState();

        if (isHorizontal) {
          const x = horizontalRulerClickToMm(e.clientX, rect.left, scrollPos, zoom, pageWidthMm);
          if (x !== null) toggleManualGuide('vertical', x);
        } else {
          const y = verticalRulerClickToMm(
            e.clientY,
            rect.top,
            scrollPos,
            zoom,
            pageHeightMm,
            pageGapMm
          );
          if (y !== null) toggleManualGuide('horizontal', y);
        }
      },
      [isHorizontal, scrollPos, zoom, pageWidthMm, pageHeightMm, pageGapMm]
    );

    return (
      <div
        data-ruler={orientation}
        title="Double-click to toggle guide · drag from ruler to create new guide"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="relative bg-[var(--bg-surface)] overflow-hidden w-full h-full select-none"
        style={{
          cursor: 'default',
          backgroundImage: isHorizontal
            ? `
            linear-gradient(90deg, ${majorTickColor} 1px, transparent 1px),
            linear-gradient(90deg, ${tickColor} 1px, transparent 1px),
            linear-gradient(90deg, ${tickColor} 1px, transparent 1px)
          `
            : `
            linear-gradient(180deg, ${majorTickColor} 1px, transparent 1px),
            linear-gradient(180deg, ${tickColor} 1px, transparent 1px),
            linear-gradient(180deg, ${tickColor} 1px, transparent 1px)
          `,
          backgroundSize: isHorizontal
            ? `${pxPerMm * 10}px 12px, ${pxPerMm * 5}px 8px, ${pxPerMm}px 4px`
            : `12px ${pxPerMm * 10}px, 8px ${pxPerMm * 5}px, 4px ${pxPerMm}px`,
          backgroundRepeat: isHorizontal ? 'repeat-x' : 'repeat-y',
          backgroundPosition: isHorizontal ? `${-scrollPos}px bottom` : `right ${-scrollPos}px`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: isHorizontal ? `translateX(${-scrollPos}px)` : `translateY(${-scrollPos}px)`,
          }}
        >
          {guideMarks.map((mm) => (
            <div
              key={`mark-${mm}`}
              className="absolute"
              style={{
                [isHorizontal ? 'left' : 'top']: `${pageMmToRulerPx(mm, zoom)}px`,
                [isHorizontal ? 'top' : 'left']: 0,
                [isHorizontal ? 'width' : 'height']: '1px',
                [isHorizontal ? 'height' : 'width']: '100%',
                backgroundColor: 'var(--accent)',
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: isHorizontal ? `translateX(${-scrollPos}px)` : `translateY(${-scrollPos}px)`,
          }}
        >
          {Array.from({ length: Math.min(Math.ceil(length / 50) + 1, 100) }).map((_, i) => {
            if (length > 10000 && i % 10 !== 0) return null;

            const val = i * 50;
            if (val > length) return null;
            return (
              <span
                key={val}
                className="absolute text-[9px] font-medium text-[var(--text-muted)] opacity-80"
                style={{
                  [isHorizontal ? 'left' : 'top']: `${val * pxPerMm + 2}px`,
                  [isHorizontal ? 'top' : 'left']: isHorizontal ? '2px' : '2px',
                  transform: isHorizontal ? 'none' : 'rotate(-90deg) translate(-10px, 0)',
                  transformOrigin: 'left top',
                }}
              >
                {val}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
);

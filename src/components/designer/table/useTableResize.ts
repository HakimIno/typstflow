import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildFormTableFillerRows } from '@/lib/utils/form-table';
import type { FormTableComponent, TableComponent, TableRow } from '@/types/schema';
import type { MutableRefObject, MouseEvent as ReactMouseEvent, RefObject } from 'react';

interface ResizeRefs {
  tableRef: RefObject<HTMLTableElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  colGhostRef: RefObject<HTMLDivElement | null>;
  rowGhostRef: RefObject<HTMLDivElement | null>;
  tooltipRef: RefObject<HTMLDivElement | null>;
  isResizingRef: MutableRefObject<boolean>;
}

export function useTableResize(
  component: TableComponent | FormTableComponent,
  refs: ResizeRefs,
  zoom: number,
  updateComponent: (id: string, updates: Record<string, unknown>) => void
) {
  const handleColResizeStart = (e: ReactMouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const tableEl = refs.tableRef.current;
    const containerEl = refs.containerRef.current;
    if (!tableEl || !containerEl) return;

    refs.isResizingRef.current = true;
    const totalMm = component.width || 180;
    const colEls = Array.from(tableEl.querySelectorAll<HTMLElement>('col'));
    const tableRect = tableEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const tableLeftPx = (tableRect.left - containerRect.left) / zoom;
    const pxPerMm = tableRect.width > 0 ? tableRect.width / zoom / totalMm : LayoutEngine.mmToPx(1);

    const initialWidths = colEls.map((col, idx) => {
      const w = col.style.width;
      if (w?.endsWith('%')) return (Number.parseFloat(w) / 100) * totalMm;
      const cellEl = tableEl.querySelector<HTMLElement>(
        `tr th:nth-child(${idx + 1}), tr td:nth-child(${idx + 1})`
      );
      return cellEl
        ? LayoutEngine.pxToMm(cellEl.getBoundingClientRect().width / zoom)
        : totalMm / Math.max(colEls.length, 1);
    });

    const boundaryMm = initialWidths.slice(0, index + 1).reduce((sum, width) => sum + width, 0);
    const initialGhostLeft = tableLeftPx + boundaryMm * pxPerMm;

    const ghostEl = refs.colGhostRef.current;
    if (ghostEl) {
      ghostEl.style.left = `${initialGhostLeft}px`;
      ghostEl.classList.remove('hidden');
    }
    const dividerEl = containerEl.querySelector<HTMLElement>(`[data-col-divider="${index}"]`);
    if (dividerEl) dividerEl.style.backgroundColor = 'var(--accent)';

    const lastWidths = [...initialWidths];

    const handleWrapper = containerEl.querySelector<HTMLElement>(
      `[data-col-handle-idx="${index}"]`
    );

    const onMouseMove = (ev: MouseEvent) => {
      const rawDeltaMm = (ev.clientX - e.clientX) / zoom / pxPerMm;
      const siblingIdx = index + 1;
      let newGhostLeft = initialGhostLeft;

      if (siblingIdx < colEls.length) {
        const clampedTarget = Math.max(5, initialWidths[index] + rawDeltaMm);
        const actualDelta = clampedTarget - initialWidths[index];
        const clampedSibling = Math.max(5, initialWidths[siblingIdx] - actualDelta);
        const finalDelta = initialWidths[siblingIdx] - clampedSibling;
        lastWidths[index] = initialWidths[index] + finalDelta;
        lastWidths[siblingIdx] = clampedSibling;
        colEls[index].style.width = `${(lastWidths[index] / totalMm) * 100}%`;
        colEls[siblingIdx].style.width = `${(lastWidths[siblingIdx] / totalMm) * 100}%`;
        newGhostLeft = initialGhostLeft + finalDelta * pxPerMm;
      } else {
        lastWidths[index] = Math.max(5, initialWidths[index] + rawDeltaMm);
        const actualDelta = lastWidths[index] - initialWidths[index];
        colEls[index].style.width = `${(lastWidths[index] / totalMm) * 100}%`;
        newGhostLeft = initialGhostLeft + actualDelta * pxPerMm;
      }

      if (ghostEl) ghostEl.style.left = `${newGhostLeft}px`;
      // Move the overlay handle wrapper directly so it tracks the drag in real-time
      if (handleWrapper) handleWrapper.style.left = `${newGhostLeft - 4}px`;

      const tooltip = refs.tooltipRef.current;
      if (tooltip) {
        tooltip.textContent = `W: ${lastWidths[index].toFixed(1)} mm`;
        tooltip.style.left = `${newGhostLeft}px`;
        tooltip.style.top = '6px';
        tooltip.classList.remove('hidden');
      }
    };

    const onMouseUp = () => {
      refs.isResizingRef.current = false;
      ghostEl?.classList.add('hidden');
      refs.tooltipRef.current?.classList.add('hidden');
      if (dividerEl) dividerEl.style.backgroundColor = '';
      // Clear the inline style — React will re-render with the new cumPercent after store update
      if (handleWrapper) handleWrapper.style.left = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const finalCols = component.columns.map((col, i) => ({
        ...col,
        width: `${(lastWidths[i] ?? initialWidths[i]).toFixed(1)}mm`,
      }));
      updateComponent(component.id, { columns: finalCols });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRowResizeStart = (e: ReactMouseEvent, sectionKey: string, rowIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    const tableEl = refs.tableRef.current;
    const containerEl = refs.containerRef.current;
    if (!tableEl || !containerEl) return;

    // The generated filler row (form-table bottom mode) is backed by bodyMinHeight,
    // not a schema row array — dragging its divider resizes the blank body area.
    const isFillerRow = sectionKey === '__fillerRow';
    let rows: TableRow[] = isFillerRow
      ? buildFormTableFillerRows(component as FormTableComponent)
      : ((component as unknown as Record<string, unknown>)[sectionKey] as TableRow[]) || [];
    if (rows.length === 0) {
      if (sectionKey === 'headerRows') {
        rows = [
          {
            id: 'synthetic-header',
            type: 'header',
            cells: component.columns.map((c) => ({
              id: c.id,
              content: c.header || '',
              align: c.align || 'left',
            })),
          },
        ];
      } else if (sectionKey === 'detailRows') {
        rows = [
          {
            id: 'synthetic-detail',
            type: 'data',
            cells: component.columns.map((c) => ({
              id: `detail-${c.id}`,
              content: c.field ? `{{${c.field}}}` : '',
              align: c.align || 'left',
            })),
          },
        ];
      } else {
        return;
      }
    }

    const row = rows[rowIdx];
    if (!row) return;

    const rowEl =
      tableEl.querySelector<HTMLElement>(`tr[data-row-id="${row.id}"]`) ||
      (Array.from(tableEl.querySelectorAll('tr'))[rowIdx] as HTMLElement | undefined) ||
      null;
    if (!rowEl) return;

    refs.isResizingRef.current = true;
    const containerRect = containerEl.getBoundingClientRect();
    const initialHeightMm = LayoutEngine.pxToMm(rowEl.getBoundingClientRect().height / zoom);
    const initialGhostTop = (rowEl.getBoundingClientRect().bottom - containerRect.top) / zoom;

    const ghostEl = refs.rowGhostRef.current;
    if (ghostEl) {
      ghostEl.style.top = `${initialGhostTop}px`;
      ghostEl.classList.remove('hidden');
    }

    const rowDividerWrapper = containerEl.querySelector<HTMLElement>(
      `[data-row-divider="${row.id}"]`
    );

    let lastHeightMm = initialHeightMm;

    const onMouseMove = (ev: MouseEvent) => {
      const deltaMm = LayoutEngine.pxToMm((ev.clientY - e.clientY) / zoom);
      lastHeightMm = Math.max(5, initialHeightMm + deltaMm);
      rowEl.style.height = `${LayoutEngine.mmToPx(lastHeightMm)}px`;
      const newGhostTop = initialGhostTop + LayoutEngine.mmToPx(lastHeightMm - initialHeightMm);
      if (ghostEl) ghostEl.style.top = `${newGhostTop}px`;
      // Move the overlay row divider wrapper directly so it tracks the drag in real-time
      if (rowDividerWrapper) rowDividerWrapper.style.top = `${newGhostTop}px`;
      const tooltip = refs.tooltipRef.current;
      if (tooltip) {
        tooltip.textContent = `H: ${lastHeightMm.toFixed(1)} mm`;
        tooltip.style.left = `${(ev.clientX - containerRect.left) / zoom}px`;
        tooltip.style.top = `${Math.max(4, newGhostTop - 26)}px`;
        tooltip.classList.remove('hidden');
      }
    };

    const onMouseUp = () => {
      refs.isResizingRef.current = false;
      ghostEl?.classList.add('hidden');
      refs.tooltipRef.current?.classList.add('hidden');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (isFillerRow) {
        updateComponent(component.id, { bodyMinHeight: `${lastHeightMm.toFixed(1)}mm` });
        return;
      }
      const newRows = rows.map((r, i) =>
        i === rowIdx ? { ...r, height: `${lastHeightMm.toFixed(1)}mm` } : r
      );
      updateComponent(component.id, { [sectionKey]: newRows });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return { handleColResizeStart, handleRowResizeStart };
}

'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildLogicalGrid, physToLogical } from '@/lib/utils/table-grid';
import { resolveTableColumnPercentages } from '@/lib/utils/table-widths';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import type { TableCell as TCell, TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CellEditor } from './table/CellEditor';
import { ColumnResizeHandle, RowResizeHandle } from './table/SheetResizeChrome';
import type { HandleSegment } from './table/SheetResizeChrome';
import type { SectionType } from './table/useCellSelection';
import { useCellSelection } from './table/useCellSelection';
import { useTableActions } from './table/useTableActions';
import { useTableResize } from './table/useTableResize';

// ─── Main Component ─────────────────────────────────────────────────────────
export function TablePreview({ component }: { component: TableComponent }) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const selectedCell = useDesignerStore((s) => s.selectedCell);
  const selectedCells = useDesignerStore((s) => s.selectedCells);
  const setSelectedCell = useDesignerStore((s) => s.setSelectedCell);
  const setSelectedCells = useDesignerStore((s) => s.setSelectedCells);
  const setTableSheetEditId = useDesignerStore((s) => s.setTableSheetEditId);
  const isTableSelected = useDesignerStore((s) => s.selectedComponentIds.includes(component.id));
  const zoom = useDesignerStore((s) => s.zoom);

  const [isTableEditing, setIsTableEditing] = useState(false);

  // Merge-aware overlay segments — recomputed after each layout pass
  const [colSegments, setColSegments] = useState<HandleSegment[][]>([]);
  const [rowSegments, setRowSegments] = useState<Map<string, HandleSegment[]>>(new Map());
  const segKeyRef = useRef<string>('');

  // DOM-measured column handle positions (zoom-independent %, pixel-accurate)
  const [domColPercents, setDomColPercents] = useState<number[]>([]);
  const domColKeyRef = useRef<string>('');

  useEffect(() => {
    if (!isTableSelected) setIsTableEditing(false);
  }, [isTableSelected]);

  useEffect(() => {
    if (isTableEditing) {
      setTableSheetEditId(component.id);
      return () => setTableSheetEditId(null);
    }
    if (useDesignerStore.getState().tableSheetEditId === component.id) {
      setTableSheetEditId(null);
    }
  }, [isTableEditing, component.id, setTableSheetEditId]);

  const [headerMidPx, setHeaderMidPx] = useState(20);
  const [tableHeightPx, setTableHeightPx] = useState(0);

  const handleTableDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTableEditing(true);
  }, []);

  useEffect(() => {
    if (!isTableEditing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsTableEditing(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTableEditing]);

  const tableRef = useRef<HTMLTableElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const colGhostRef = useRef<HTMLDivElement>(null);
  const rowGhostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const resizeOverlayRef = useRef<HTMLDivElement>(null);

  // ─── Auto-fit component height to actual table height ──────────────────
  useEffect(() => {
    if (!tableRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (isResizingRef.current) return;
      for (const entry of entries) {
        const tableMm = LayoutEngine.pxToMm(entry.contentRect.height);
        if (Math.abs(tableMm - (component.height || 60)) > 2) {
          updateComponent(component.id, { height: Math.ceil(tableMm) } as any);
        }
      }
    });
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [component.id, component.height, updateComponent]);

  // Sync row-divider tops + header pill position to actual DOM layout, and compute
  // merge-aware overlay segments for column/row handles.
  useLayoutEffect(() => {
    const overlay = resizeOverlayRef.current;
    const table = tableRef.current;
    const container = tableContainerRef.current;
    if (!table || !container) return;

    const tableRect = table.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const containerW = containerRect.width;
    const nextTableHeightPx = tableRect.height / zoom;
    setTableHeightPx((current) =>
      Math.abs(current - nextTableHeightPx) > 0.5 ? nextTableHeightPx : current
    );

    // All BoundingClientRect values are in screen pixels.
    // The overlay uses logical CSS pixels, so we divide by zoom throughout.
    const headerRow = table.querySelector<HTMLElement>('thead tr[data-row-id]');
    if (headerRow) {
      const hRect = headerRow.getBoundingClientRect();
      const topLogical = (hRect.top - containerRect.top) / zoom;
      const heightLogical = hRect.height / zoom;
      setHeaderMidPx(topLogical + heightLogical / 2);
    } else {
      setHeaderMidPx(12);
    }

    // Row logical positions (screen px ÷ zoom = logical CSS px)
    const rowTopPx = new Map<string, number>();
    const rowBottomPx = new Map<string, number>();
    const allTrs = Array.from(table.querySelectorAll<HTMLElement>('tr[data-row-id]'));
    for (const tr of allTrs) {
      const rowId = tr.getAttribute('data-row-id');
      if (!rowId) continue;
      const r = tr.getBoundingClientRect();
      rowTopPx.set(rowId, (r.top - tableRect.top) / zoom);
      rowBottomPx.set(rowId, (r.bottom - tableRect.top) / zoom);
    }

    // Update row-divider DOM positions (already in logical px)
    if (overlay) {
      for (const tr of allTrs) {
        const rowId = tr.getAttribute('data-row-id');
        if (!rowId) continue;
        const divider = overlay.querySelector<HTMLElement>(`[data-row-divider="${rowId}"]`);
        if (!divider) continue;
        divider.style.top = `${rowBottomPx.get(rowId) ?? 0}px`;
      }
    }

    // ── Column boundary positions from DOM (pixel-accurate, zoom-independent %) ──
    // Using (screen_right - container_screen_left) / container_screen_width gives
    // the same % in both screen and logical space, so no zoom division needed.
    const totalCols = component.columns.length;
    const newDomColPercents: number[] = [];
    for (const tr of allTrs) {
      const cells = Array.from(tr.querySelectorAll<HTMLElement>('th, td'));
      const totalSpan = cells.reduce(
        (s, c) => s + Number.parseInt(c.getAttribute('colspan') || '1'),
        0
      );
      if (totalSpan !== totalCols) continue;
      // Reset before measuring this row (each eligible row re-measures from scratch)
      newDomColPercents.length = 0;
      for (let i = 0; i < cells.length - 1; i++) {
        const right = cells[i].getBoundingClientRect().right;
        newDomColPercents.push(((right - containerRect.left) / containerW) * 100);
      }
      // Only break when we have a full set of measurements
      if (newDomColPercents.length === totalCols - 1) break;
    }
    const domColKey = newDomColPercents.map((p) => p.toFixed(3)).join(',');
    if (domColKey !== domColKeyRef.current) {
      domColKeyRef.current = domColKey;
      setDomColPercents(newDomColPercents.length === totalCols - 1 ? newDomColPercents : []);
    }

    // Compute segments only when the sheet-edit overlay is active
    if (!isTableSelected || !isTableEditing) return;

    const allFlatRows: TableRow[] = [...headerRows, ...previewSections.flatMap((sec) => sec.rows)];
    if (totalCols < 2 || allFlatRows.length === 0) return;

    // Use freshly measured col percents for segment edges (falls back to cumColWidths).
    // When falling back, normalize to [0,100] range — cumColWidths can exceed 100% if
    // component.width drifted from the sum of column mm widths after a resize.
    const effectiveColPercents = (() => {
      if (newDomColPercents.length === totalCols - 1) return [...newDomColPercents, 100];
      const maxVal = cumColWidths[cumColWidths.length - 1] || 100;
      return cumColWidths.map((p) => (p / maxVal) * 100);
    })();

    const grid = buildLogicalGrid(allFlatRows, totalCols);

    // ── Column boundary segments (logical px top/bottom) ──────────────────────
    const newColSegs: HandleSegment[][] = [];
    for (let b = 0; b < totalCols - 1; b++) {
      const raw: HandleSegment[] = [];
      for (let ri = 0; ri < allFlatRows.length; ri++) {
        const slotL = grid[ri]?.[b];
        const slotR = grid[ri]?.[b + 1];
        const merged =
          slotL != null &&
          slotR != null &&
          slotL.ownerRowIdx === slotR.ownerRowIdx &&
          slotL.ownerPhysIdx === slotR.ownerPhysIdx;
        if (!merged) {
          const top = Math.round(rowTopPx.get(allFlatRows[ri].id) ?? 0);
          const bottom = Math.round(rowBottomPx.get(allFlatRows[ri].id) ?? 0);
          raw.push({ start: top, end: bottom });
        }
      }
      const segs: HandleSegment[] = [];
      for (const s of raw) {
        if (segs.length > 0 && s.start <= segs[segs.length - 1].end + 1) {
          segs[segs.length - 1].end = Math.max(segs[segs.length - 1].end, s.end);
        } else {
          segs.push({ ...s });
        }
      }
      newColSegs.push(segs);
    }

    // ── Row boundary segments (% left/right from DOM-measured col positions) ──
    const newRowSegs = new Map<string, HandleSegment[]>();
    for (let ri = 0; ri < allFlatRows.length - 1; ri++) {
      const row = allFlatRows[ri];
      const raw: HandleSegment[] = [];
      for (let c = 0; c < totalCols; c++) {
        const slotT = grid[ri]?.[c];
        const slotB = grid[ri + 1]?.[c];
        const merged =
          slotT != null &&
          slotB != null &&
          slotT.ownerRowIdx === slotB.ownerRowIdx &&
          slotT.ownerPhysIdx === slotB.ownerPhysIdx;
        if (!merged) {
          const left = Math.max(0, c === 0 ? 0 : (effectiveColPercents[c - 1] ?? 0));
          const right = Math.min(100, effectiveColPercents[c] ?? 100);
          raw.push({ start: left, end: right });
        }
      }
      const segs: HandleSegment[] = [];
      for (const s of raw) {
        if (segs.length > 0 && s.start <= segs[segs.length - 1].end + 0.1) {
          segs[segs.length - 1].end = Math.max(segs[segs.length - 1].end, s.end);
        } else {
          segs.push({ ...s });
        }
      }
      newRowSegs.set(row.id, segs);
    }

    const newKey = JSON.stringify([newColSegs, [...newRowSegs.entries()]]);
    if (newKey !== segKeyRef.current) {
      segKeyRef.current = newKey;
      setColSegments(newColSegs);
      setRowSegments(newRowSegs);
    }
  });

  // ─── Hooks ────────────────────────────────────────────────────────────
  const { handleColResizeStart, handleRowResizeStart } = useTableResize(
    component,
    {
      tableRef,
      containerRef: tableContainerRef,
      colGhostRef,
      rowGhostRef,
      tooltipRef,
      isResizingRef,
    },
    zoom,
    (id, updates) => updateComponent(id, updates as any)
  );

  const { isCellSelected, handleCellMouseDown, handleCellMouseEnter } = useCellSelection(
    component,
    selectedCells as any,
    setSelectedCell as any,
    setSelectedCells as any
  );

  const { handleCellSave } = useTableActions(
    component,
    selectedCell as any,
    selectedCells as any,
    (id, updates) => updateComponent(id, updates as any),
    setSelectedCell as any
  );

  // ─── Build row sections ────────────────────────────────────────────────
  const headerRows: TableRow[] = component.headerRows?.length
    ? component.headerRows
    : component.showHeader !== false
      ? [
          {
            id: 'synthetic-header',
            type: 'header',
            cells: component.columns.map((c) => ({
              id: c.id,
              content: c.header || '',
              align: c.align || 'left',
            })),
          },
        ]
      : [];

  type PreviewSection = {
    rows: TableRow[];
    sectionKey: string;
    section: SectionType;
    isHeader: boolean;
  };

  const buildPreviewSections = (): PreviewSection[] => {
    const sections: PreviewSection[] = [];

    if (component.groupBy) {
      sections.push({
        rows: [
          {
            id: 'preview-group-header',
            type: 'group-header',
            cells: [
              {
                id: 'gh-cell-0',
                content: component.groupHeaderFormat || `Group: {{${component.groupBy}}}`,
                colspan: component.columns.length,
                align: 'left',
              },
            ],
          },
        ],
        sectionKey: 'detailRows',
        section: 'data',
        isHeader: false,
      });
    }

    const detailRows: TableRow[] = component.detailRows?.length
      ? component.detailRows
      : [
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
    sections.push({ rows: detailRows, sectionKey: 'detailRows', section: 'data', isHeader: false });

    if (component.autoGroupFooter) {
      sections.push({
        rows: [
          {
            id: 'preview-group-footer',
            type: 'group-footer',
            cells: component.columns.map((col, idx) => ({
              id: `gf-cell-${idx}`,
              content:
                idx === 0 ? component.autoGroupFooterLabel || 'Subtotal' : col.footerExpr || '',
              align: col.align || 'left',
            })),
          },
        ],
        sectionKey: 'detailRows',
        section: 'data',
        isHeader: false,
      });
    }

    if (component.footerRows?.length) {
      sections.push({
        rows: component.footerRows,
        sectionKey: 'footerRows',
        section: 'footer',
        isHeader: false,
      });
    }

    return sections;
  };

  const previewSections = buildPreviewSections();

  // ─── Flat row list for overlay dividers ──────────────────────────────────
  const allRenderedRows: {
    rowId: string;
    sectionKey: string;
    rowIdx: number;
    isGroupRow: boolean;
  }[] = [
    ...headerRows.map((row, i) => ({
      rowId: row.id,
      sectionKey: 'headerRows',
      rowIdx: i,
      isGroupRow: false,
    })),
    ...previewSections.flatMap((sec) =>
      sec.rows.map((row, i) => ({
        rowId: row.id,
        sectionKey: sec.sectionKey,
        rowIdx: i,
        isGroupRow: row.type === 'group-header' || row.type === 'group-footer',
      }))
    ),
  ];

  // ─── Style helpers ────────────────────────────────────────────────────
  const style = component.style || {};
  const isStaticTable = component.isStatic ?? false;
  const sides = style.borderSides ?? {
    top: true,
    bottom: true,
    left: true,
    right: true,
    innerH: true,
    innerV: true,
  };
  const cellPaddingPx = LayoutEngine.mmToPx(parseTypstUnit(style.inset || '2mm'));
  const headerBg = style.headerBackground || '#f1f5f9';
  const headerColor = style.headerColor || '#000000';
  const bodyColor = style.bodyColor || '#334155';
  const headerFontSize = style.headerFontSize || 10;
  const bodyFontSize = style.bodyFontSize || 10;
  const headerFontWeight = style.headerFontWeight || 'bold';
  const pattern = style.fillPattern || 'header-only';
  const c1 = style.stripedColor1 || '#ffffff';
  const c2 = style.stripedColor2 || '#f8fafc';

  const obWidth = LayoutEngine.mmToPx(parseTypstUnit(style.borderWidth || '0.5pt'));
  const obColor = style.borderColor || '#cbd5e1';
  const ihWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.innerHBorderWidth || style.borderWidth || '0.5pt')
  );
  const ihColor = style.innerHBorderColor || style.borderColor || '#cbd5e1';
  const ihDash = style.horizontalDash || 'solid';
  const ivWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.innerVBorderWidth || style.borderWidth || '0.5pt')
  );
  const ivColor = style.innerVBorderColor || style.borderColor || '#cbd5e1';
  const ivDash = style.verticalDash || 'solid';
  const hsBorderWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.headerBorderWidth || style.borderWidth || '0.5pt')
  );
  const hsBorderColor = style.headerBorderColor || style.borderColor || '#cbd5e1';

  const toCssDash = (d: string) =>
    d === 'dashed' ? 'dashed' : d === 'dotted' ? 'dotted' : 'solid';
  const makeBorder = (show: boolean, w: number, c: string, dash = 'solid') =>
    show ? `${w}px ${toCssDash(dash)} ${c}` : 'none';

  // ─── Render single cell ────────────────────────────────────────────────
  const renderCell = (
    cell: TCell,
    logicalCol: number, // LOGICAL column — used for selection highlight & resize handles
    row: TableRow,
    rowIdx: number,
    sectionKey: string,
    section: SectionType,
    isHeader: boolean,
    sectionRows: TableRow[] // all rows in this section (for border calc)
  ) => {
    const isGroupHeader = row.type === 'group-header';
    const isGroupFooter = row.type === 'group-footer' || (row.type === 'footer' && !isHeader);
    const isSelected = isCellSelected(section, row.id, logicalCol);
    const isActiveCell =
      selectedCell?.tableId === component.id &&
      selectedCell.section === section &&
      selectedCell.rowId === row.id &&
      selectedCell.cellIdx === logicalCol;
    const cellStyle = cell.style;

    // Background
    let cellFill = cell.fill || '';
    if (!cellFill) {
      if (isHeader) cellFill = headerBg;
      else if (isGroupHeader)
        cellFill = (component.groupHeaderStyle as any)?.background || 'transparent';
      else if (isGroupFooter)
        cellFill = (component.groupFooterStyle as any)?.background || 'transparent';
      else if (pattern === 'striped-rows') cellFill = rowIdx % 2 === 0 ? c1 : c2;
      else if (pattern === 'striped-cols') cellFill = logicalCol % 2 === 0 ? c1 : c2;
      else if (pattern === 'checkerboard') cellFill = (rowIdx + logicalCol) % 2 === 0 ? c1 : c2;
      else cellFill = 'transparent';
    }

    // Text styling
    const ghStyle = component.groupHeaderStyle as any;
    const gfStyle = component.groupFooterStyle as any;
    const textColor =
      cellStyle?.color ||
      (isHeader
        ? headerColor
        : isGroupHeader
          ? ghStyle?.color
          : isGroupFooter
            ? gfStyle?.color
            : undefined) ||
      bodyColor;
    const fontSize =
      cellStyle?.fontSize ||
      (isHeader
        ? headerFontSize
        : isGroupHeader
          ? ghStyle?.fontSize
          : isGroupFooter
            ? gfStyle?.fontSize
            : undefined) ||
      bodyFontSize;
    const fontWeightRaw =
      cellStyle?.fontWeight ||
      (isHeader
        ? headerFontWeight
        : isGroupHeader
          ? ghStyle?.fontWeight
          : isGroupFooter
            ? gfStyle?.fontWeight
            : undefined) ||
      'normal';

    const fontWeight = (() => {
      const w = fontWeightRaw;
      if (!w) return 'normal';
      if (typeof w === 'number') return String(w);
      switch (w) {
        case 'thin':
          return '100';
        case 'light':
          return '300';
        case 'regular':
          return 'normal';
        case 'medium':
          return '500';
        case 'semibold':
          return '600';
        case 'bold':
          return 'bold';
        case 'extrabold':
          return '800';
        case 'black':
          return '900';
        default:
          return w;
      }
    })();
    const isItalic =
      cellStyle?.italic ??
      (isGroupFooter ? !!gfStyle?.italic : isGroupHeader ? !!ghStyle?.italic : false);
    const isUnderline = cellStyle?.underline ?? (isGroupFooter ? !!gfStyle?.underline : false);
    const isStrikethrough =
      cellStyle?.strikethrough ??
      (isGroupFooter ? !!gfStyle?.strikethrough : isGroupHeader ? !!ghStyle?.strikethrough : false);

    const cellDecorations: string[] = [];
    if (isUnderline) cellDecorations.push('underline');
    if (isStrikethrough) cellDecorations.push('line-through');
    const cellTextDecoration = cellDecorations.length > 0 ? cellDecorations.join(' ') : 'none';

    const cellFontFamily = cellStyle?.fontFamily || style.fontFamily;
    const resolvedAlign = cell.align || 'left';
    const isVertical = (cell.textDirection || 'horizontal') === 'vertical';
    const placeholder =
      isHeader || isGroupHeader || isGroupFooter ? '' : isStaticTable ? '' : '{{binding}}';

    // Border calculation
    const isFirstRow = sectionRows.indexOf(row) === 0;
    const isLastRow = sectionRows.indexOf(row) === sectionRows.length - 1;
    const isFirstCol = logicalCol === 0;
    const isLastCol = logicalCol + (cell.colspan || 1) === component.columns.length;
    const isLastHeaderRow = isHeader && isLastRow;
    const colSpan = cell.colspan || 1;

    const isSelectedAt = (targetRowIdx: number, targetCol: number) => {
      const targetRow = sectionRows[targetRowIdx];
      return targetRow ? isCellSelected(section, targetRow.id, targetCol) : false;
    };

    const selectionEdges = isSelected
      ? {
          top: !isSelectedAt(rowIdx - 1, logicalCol),
          bottom: !isSelectedAt(rowIdx + 1, logicalCol),
          left: !isSelectedAt(rowIdx, logicalCol - 1),
          right: !isSelectedAt(rowIdx, logicalCol + colSpan),
        }
      : null;

    const borderStyle: React.CSSProperties = {
      borderTop: isFirstRow
        ? makeBorder(sides.top, obWidth, obColor)
        : makeBorder(sides.innerH, ihWidth, ihColor, ihDash),
      borderBottom: isLastHeaderRow
        ? makeBorder(true, hsBorderWidth, hsBorderColor)
        : isLastRow
          ? makeBorder(sides.bottom, obWidth, obColor)
          : makeBorder(sides.innerH, ihWidth, ihColor, ihDash),
      borderLeft: isFirstCol
        ? makeBorder(sides.left, obWidth, obColor)
        : makeBorder(sides.innerV, ivWidth, ivColor, ivDash),
      borderRight: isLastCol
        ? makeBorder(sides.right, obWidth, obColor)
        : makeBorder(sides.innerV, ivWidth, ivColor, ivDash),
    };

    const Tag = isHeader ? 'th' : 'td';

    // For saving: find which section rows array to use
    const schemaRows = (component[sectionKey as keyof TableComponent] as TableRow[]) || [];

    return (
      <Tag
        key={`${section}-${row.id}-${logicalCol}`}
        colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
        rowSpan={cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined}
        onMouseDown={(e) => handleCellMouseDown(section, row.id, logicalCol, e)}
        onMouseEnter={() => handleCellMouseEnter(section, row.id, logicalCol)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsTableEditing(true);
        }}
        className={clsx(
          'relative group/cell',
          isTableEditing ? 'cursor-text' : 'cursor-default',
          isSelected && 'z-10',
          isActiveCell && isTableEditing && 'z-20'
        )}
        style={{
          ...borderStyle,
          backgroundColor: cellFill,
          padding: `${cellPaddingPx}px`,
          textAlign: resolvedAlign as any,
          verticalAlign: cell.verticalAlign || 'middle',
          ...(isVertical
            ? { writingMode: 'vertical-rl' as any, textOrientation: 'mixed' as any }
            : {}),
        }}
      >
        {/* Figma-style cell selection — thin outline on active cell only */}
        {isSelected && isTableEditing && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none z-[5] bg-[var(--accent)]/[0.03]"
            style={{
              borderTop: selectionEdges?.top ? '1px solid var(--accent)' : undefined,
              borderBottom: selectionEdges?.bottom ? '1px solid var(--accent)' : undefined,
              borderLeft: selectionEdges?.left ? '1px solid var(--accent)' : undefined,
              borderRight: selectionEdges?.right ? '1px solid var(--accent)' : undefined,
              boxShadow: isActiveCell ? 'inset 0 0 0 1px var(--accent)' : undefined,
            }}
          />
        )}
        {isSelected && !isTableEditing && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none z-[5] bg-[var(--accent)]/[0.04]"
          />
        )}
        <CellEditor
          readOnly={!isTableEditing}
          className="w-full bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300/60"
          style={{
            textAlign: resolvedAlign as any,
            fontFamily: cellFontFamily || 'inherit',
            color: textColor,
            fontSize: `${fontSize}pt`,
            fontWeight,
            fontStyle: isItalic ? 'italic' : 'normal',
            textDecoration: cellTextDecoration,
            lineHeight: 1.4,
            ...(isVertical
              ? {
                  writingMode: 'vertical-rl' as any,
                  textOrientation: 'mixed' as any,
                  width: 'auto',
                  height: '100%',
                }
              : {}),
          }}
          initialValue={cell.content || ''}
          placeholder={placeholder}
          onSave={(newVal) => {
            if (newVal === cell.content) return;
            // Legacy: no real schema rows → update columns array
            if (!schemaRows.length) {
              const newCols = [...component.columns];
              if (isHeader) {
                if (newCols[logicalCol]) newCols[logicalCol].header = newVal;
                updateComponent(component.id, { columns: newCols } as any);
              } else {
                const fieldVal = newVal.replace(/[{}]/g, '');
                if (newCols[logicalCol]) newCols[logicalCol].field = fieldVal;
                updateComponent(component.id, { columns: newCols } as any);
              }
              return;
            }
            handleCellSave(sectionKey, schemaRows, rowIdx, cell.id, newVal);
          }}
        />
      </Tag>
    );
  };

  // ─── Render rows — uses logical grid to map physical→logical column ────
  const renderRows = (
    rows: TableRow[],
    sectionKey: string,
    section: SectionType,
    isHeader: boolean
  ) => {
    const totalCols = component.columns.length;
    const grid = buildLogicalGrid(rows, totalCols);

    return rows.map((row, rowIdx) => {
      const logicalCols = physToLogical(grid, rowIdx, row.cells.length);
      const rowHeight = row.height
        ? `${LayoutEngine.mmToPx(parseTypstUnit(row.height))}px`
        : undefined;
      return (
        <tr key={row.id} data-row-id={row.id} style={{ height: rowHeight }}>
          {row.cells.map((cell, physIdx) => {
            const logicalCol = logicalCols[physIdx] ?? physIdx;
            return renderCell(cell, logicalCol, row, rowIdx, sectionKey, section, isHeader, rows);
          })}
        </tr>
      );
    });
  };

  // ─── Column widths via <colgroup> ─────────────────────────────────────
  const colWidths = resolveTableColumnPercentages(component.columns, component.width || 180);

  // Cumulative column percentages — used to position column dividers in the overlay
  const cumColWidths = (() => {
    let cum = 0;
    return colWidths.map((w) => {
      cum += w ? Number.parseFloat(w) : 0;
      return cum;
    });
  })();

  return (
    <div
      ref={tableContainerRef}
      className="w-full h-full relative"
      data-table-editing={isTableEditing || undefined}
      onDoubleClick={handleTableDoubleClick}
    >
      {isTableEditing && (
        <span className="absolute -top-5 right-0 z-30 text-[10px] font-medium text-[var(--accent)] pointer-events-none select-none">
          Sheet
        </span>
      )}

      {isTableEditing && (
        <div
          aria-hidden
          className="absolute inset-0 z-[12] pointer-events-none outline outline-1 outline-[var(--accent)]"
        />
      )}

      <table
        ref={tableRef}
        className="w-full"
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: style.fontFamily || 'inherit',
        }}
      >
        <colgroup>
          {component.columns.map((col, i) => (
            <col key={col.id} style={colWidths[i] ? { width: colWidths[i] } : undefined} />
          ))}
        </colgroup>

        {headerRows.length > 0 && (
          <thead>{renderRows(headerRows, 'headerRows', 'header', true)}</thead>
        )}

        <tbody>
          {previewSections.map((sec) =>
            renderRows(sec.rows, sec.sectionKey, sec.section, sec.isHeader)
          )}
        </tbody>
      </table>

      <div
        ref={resizeOverlayRef}
        className="absolute inset-0 pointer-events-none z-[20] overflow-hidden"
      >
        {isTableSelected &&
          isTableEditing &&
          // Use DOM-measured positions when available (pixel-accurate after resize)
          // Fall back to cumColWidths for the initial render before DOM is measured.
          (domColPercents.length > 0 ? domColPercents : cumColWidths.slice(0, -1)).map((cum, i) => (
            <ColumnResizeHandle
              key={`col-divider-${i}`}
              index={i}
              cumPercent={cum}
              headerMidPx={headerMidPx}
              onMouseDown={(e) => handleColResizeStart(e, i)}
              segments={colSegments[i] ?? [{ start: 0, end: tableHeightPx }]}
            />
          ))}
        {isTableSelected &&
          isTableEditing &&
          allRenderedRows.map((row) =>
            row.isGroupRow ? null : (
              <RowResizeHandle
                key={`row-divider-${row.rowId}`}
                rowId={row.rowId}
                onMouseDown={(e) => handleRowResizeStart(e, row.sectionKey, row.rowIdx)}
                segments={rowSegments.get(row.rowId)}
              />
            )
          )}
      </div>

      {/* Ghost guide lines — always mounted, shown/hidden via direct DOM */}
      <div
        ref={colGhostRef}
        className="hidden absolute top-0 w-px bg-[var(--accent)] z-[60] pointer-events-none"
        style={{ height: tableHeightPx }}
      />
      <div
        ref={rowGhostRef}
        className="hidden absolute left-0 right-0 h-px bg-[var(--accent)] z-[60] pointer-events-none"
      />
      <div
        ref={tooltipRef}
        className="hidden absolute z-[70] px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums text-[var(--text-primary)] bg-[var(--bg-widget)] border border-[var(--border-default)] shadow-sm pointer-events-none whitespace-nowrap -translate-x-1/2"
      />
    </div>
  );
}

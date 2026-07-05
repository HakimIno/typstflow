'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildFormTableFillerRows, buildFormTableSummaryRows } from '@/lib/utils/form-table';
import { buildPreviewFontStack } from '@/lib/utils/preview-fonts';
import { buildLogicalGrid, physToLogical } from '@/lib/utils/table-grid';
import { resolveTableColumnPercentages } from '@/lib/utils/table-widths';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import type {
  FormTableComponent,
  TableCell as TCell,
  TableComponent,
  TableRow,
} from '@/types/schema';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Columns2,
  Eraser,
  Merge,
  Rows3,
  Split,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ColumnResizeHandle, RowResizeHandle } from './table/SheetResizeChrome';
import type { HandleSegment } from './table/SheetResizeChrome';
import type { ContextMenuItem } from './table/TableCellContextMenu';
import { TableCellContextMenu } from './table/TableCellContextMenu';
import type { CellStyleCtx } from './table/TableCellView';
import { TableCellView } from './table/TableCellView';
import { TableToolbar } from './table/TableToolbar';
import type { SectionType } from './table/useCellSelection';
import { useCellSelection } from './table/useCellSelection';
import { useTableActions } from './table/useTableActions';
import { useTableResize } from './table/useTableResize';

// ─── Main Component ─────────────────────────────────────────────────────────
export const TablePreview = memo(function TablePreview({
  component,
}: {
  component: TableComponent | FormTableComponent;
}) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  // Scope selection to THIS table: return null when the active cell/cells belong to
  // another table. Otherwise every TablePreview subscribes to the global selection
  // and a cell click in any table re-renders every table on the page.
  const selectedCell = useDesignerStore((s) =>
    s.selectedCell?.tableId === component.id ? s.selectedCell : null
  );
  const selectedCells = useDesignerStore((s) =>
    s.selectedCells?.tableId === component.id ? s.selectedCells : null
  );
  const setSelectedCell = useDesignerStore((s) => s.setSelectedCell);
  const setSelectedCells = useDesignerStore((s) => s.setSelectedCells);
  const setTableSheetEditId = useDesignerStore((s) => s.setTableSheetEditId);
  const isTableSelected = useDesignerStore((s) => s.selectedComponentIds.includes(component.id));
  const zoom = useDesignerStore((s) => s.zoom);
  const bodyFontFamily = useDesignerStore(
    (s) =>
      s.schema.fonts.find((f) => f.role === 'body')?.family ??
      s.schema.fonts[0]?.family ??
      'Sarabun'
  );

  const [isTableEditing, setIsTableEditing] = useState(false);

  // Merge-aware overlay segments — recomputed after each layout pass
  const [colSegments, setColSegments] = useState<HandleSegment[][]>([]);
  const [rowSegments, setRowSegments] = useState<Map<string, HandleSegment[]>>(new Map());
  const segKeyRef = useRef<string>('');

  // DOM-measured column handle positions (zoom-independent %, pixel-accurate)
  const [domColPercents, setDomColPercents] = useState<number[]>([]);
  const domColKeyRef = useRef<string>('');

  // Signature of everything that affects overlay geometry. Lets the layout pass
  // skip its (forced-reflow) DOM measurement when only the selection/hover changed
  // — which is what makes clicking cells in edit mode feel heavy.
  const layoutSigRef = useRef<string>('');

  useEffect(() => {
    if (!isTableSelected) setIsTableEditing(false);
  }, [isTableSelected]);

  useLayoutEffect(() => {
    if (isTableEditing) {
      setTableSheetEditId(component.id);
      return () => {
        if (useDesignerStore.getState().tableSheetEditId === component.id) {
          setTableSheetEditId(null);
        }
      };
    }
    if (useDesignerStore.getState().tableSheetEditId === component.id) {
      setTableSheetEditId(null);
    }
  }, [isTableEditing, component.id, setTableSheetEditId]);

  const [headerMidPx, setHeaderMidPx] = useState(20);
  const [tableHeightPx, setTableHeightPx] = useState(0);

  const handleTableDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setTableSheetEditId(component.id);
      setIsTableEditing(true);
    },
    [component.id, setTableSheetEditId]
  );

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
  // Applies to form-table bottom mode too: the generated Typst table is always
  // content-sized (filler row = bodyMinHeight), so the component frame must track
  // the real table height for the preview to match the PDF.
  useEffect(() => {
    if (!tableRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (isResizingRef.current) return;
      for (const entry of entries) {
        const tableMm = LayoutEngine.pxToMm(entry.contentRect.height);
        if (Math.abs(tableMm - (component.height || 60)) > 2) {
          // Auto-fit height is a derived value — never record it in history,
          // otherwise it pushes a junk entry after every real edit (delete/merge/
          // resize) which truncates the redo stack and breaks undo/redo.
          updateComponent(component.id, { height: Math.ceil(tableMm) } as any, true);
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

    // Everything below only drives the sheet-edit resize overlay (handles, ghost
    // lines, merge segments). This effect has no dependency array, so it runs on
    // every render — and since TablePreview subscribes to the global selectedCell/
    // selectedCells, a cell click in ANY table re-renders EVERY table. Bailing out
    // here keeps idle tables from force-reflowing the DOM (getBoundingClientRect on
    // every row/cell) when they have nothing to draw.
    if (!isTableSelected || !isTableEditing) {
      // Reset so re-entering edit mode always re-measures (row-divider tops are
      // applied imperatively and would otherwise stay stale on the next session).
      layoutSigRef.current = '';
      return;
    }

    // Selection/hover changes re-render the table but never move a handle. Skip the
    // measurement below unless something that actually affects the overlay geometry
    // changed (zoom, table size, column widths, row heights, or cell spans). This is
    // what keeps clicking cells in edit mode snappy instead of forcing a full reflow.
    const flatRows = [...headerRows, ...previewSections.flatMap((sec) => sec.rows)];
    const layoutSig = [
      zoom,
      component.width,
      component.height,
      component.columns.map((c) => c.width).join(','),
      flatRows
        .map(
          (r) =>
            `${r.id}:${r.height ?? ''}:${r.cells
              .map((c) => `${c.colspan ?? 1}x${c.rowspan ?? 1}`)
              .join('-')}`
        )
        .join(';'),
    ].join('|');
    if (layoutSig === layoutSigRef.current) return;
    layoutSigRef.current = layoutSig;

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

  const {
    handleCellSave,
    handleMerge,
    handleSplit,
    handleInsertRow,
    handleInsertCol,
    handleDeleteRows,
    handleDeleteColumns,
    handleClearContents,
    handleAlign,
    canMerge,
    canSplit,
    canDeleteRow,
    canDeleteColumn,
    canClear,
  } = useTableActions(
    component,
    selectedCell as any,
    selectedCells as any,
    (id, updates) => updateComponent(id, updates as any),
    setSelectedCell as any,
    setSelectedCells as any
  );

  // Right-click cell context menu (viewport coordinates)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleCellContextMenu = useCallback(
    (section: SectionType, rowId: string, logicalCol: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Right-click also enters sheet mode so the selection is visible.
      setIsTableEditing(true);
      // If the clicked cell isn't part of the current selection, select just it.
      if (!isCellSelected(section, rowId, logicalCol)) {
        setSelectedCell({ tableId: component.id, section, rowId, cellIdx: logicalCol });
        setSelectedCells({
          tableId: component.id,
          section,
          rowIds: [rowId],
          cellIndices: [logicalCol],
        });
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [component.id, isCellSelected, setSelectedCell, setSelectedCells]
  );

  // ─── Build row sections ────────────────────────────────────────────────
  // Memoized so synthetic rows keep a stable identity across selection re-renders —
  // required for the memoized cells to skip re-rendering when only selection changed.
  const headerRows: TableRow[] = useMemo(
    () =>
      component.headerRows?.length
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
          : [],
    [component.headerRows, component.showHeader, component.columns]
  );

  const generatedFillerRows = useMemo(
    () => (component.type === 'form-table' ? buildFormTableFillerRows(component) : []),
    [component]
  );

  type PreviewSection = {
    rows: TableRow[];
    sectionKey: string;
    section: SectionType;
    isHeader: boolean;
  };

  // Footer sections, one per schema source so canvas edits write back to the right
  // key. Order must mirror the generator (buildFormTableFooterRows): footerRows →
  // footerGridRows → footerSummary. Only the synthesized summary rows are read-only.
  const footerSections: PreviewSection[] = useMemo(() => {
    const sections: PreviewSection[] = [];
    const push = (rows: TableRow[] | undefined, sectionKey: string) => {
      if (rows?.length) sections.push({ rows, sectionKey, section: 'footer', isHeader: false });
    };
    push(component.footerRows, 'footerRows');
    if (component.type === 'form-table') {
      push(component.footerGridRows, 'footerGridRows');
      push(buildFormTableSummaryRows(component), '__generatedRows');
    }
    return sections;
  }, [component]);

  // Memoized (stable identity) so cells inside these sections don't re-render on
  // unrelated changes like selection. Recomputed only when the underlying data changes.
  const previewSections: PreviewSection[] = useMemo(() => {
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

    if (generatedFillerRows.length) {
      // Dedicated key: content is generated (not editable) but the row IS resizable —
      // dragging its divider updates bodyMinHeight (see useTableResize).
      sections.push({
        rows: generatedFillerRows,
        sectionKey: '__fillerRow',
        section: 'data',
        isHeader: false,
      });
    }

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

    sections.push(...footerSections);

    return sections;
  }, [
    component.groupBy,
    component.groupHeaderFormat,
    component.detailRows,
    component.columns,
    component.autoGroupFooter,
    component.autoGroupFooterLabel,
    generatedFillerRows,
    footerSections,
  ]);

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
        isGroupRow:
          sec.sectionKey === '__generatedRows' ||
          row.type === 'group-header' ||
          row.type === 'group-footer',
      }))
    ),
  ];

  // ─── Style context (memoized so its identity is stable across selection re-renders) ──
  const cellCtx: CellStyleCtx = useMemo(() => {
    const style = component.style || {};
    const previewFontStack = buildPreviewFontStack(style.fontFamily ?? bodyFontFamily);
    const toCssDash = (d: string) =>
      d === 'dashed' ? 'dashed' : d === 'dotted' ? 'dotted' : 'solid';
    return {
      style,
      isStaticTable: component.isStatic ?? false,
      sides: style.borderSides ?? {
        top: true,
        bottom: true,
        left: true,
        right: true,
        innerH: true,
        innerV: true,
      },
      // Mirror the generator's inset resolution (table.ts): inset → cellPadding → '7pt'
      cellPaddingPx: LayoutEngine.mmToPx(parseTypstUnit(style.inset || style.cellPadding || '7pt')),
      headerBg: style.headerBackground || '#f1f5f9',
      headerColor: style.headerColor || '#000000',
      bodyColor: style.bodyColor || '#334155',
      headerFontSize: style.headerFontSize || 10,
      bodyFontSize: style.bodyFontSize || 10,
      headerFontWeight: style.headerFontWeight || 'bold',
      pattern: style.fillPattern || 'header-only',
      c1: style.stripedColor1 || '#ffffff',
      c2: style.stripedColor2 || '#f8fafc',
      obWidth: LayoutEngine.mmToPx(parseTypstUnit(style.borderWidth || '0.5pt')),
      obColor: style.borderColor || '#cbd5e1',
      ihWidth: LayoutEngine.mmToPx(
        parseTypstUnit(style.innerHBorderWidth || style.borderWidth || '0.5pt')
      ),
      ihColor: style.innerHBorderColor || style.borderColor || '#cbd5e1',
      ihDash: style.horizontalDash || 'solid',
      ivWidth: LayoutEngine.mmToPx(
        parseTypstUnit(style.innerVBorderWidth || style.borderWidth || '0.5pt')
      ),
      ivColor: style.innerVBorderColor || style.borderColor || '#cbd5e1',
      ivDash: style.verticalDash || 'solid',
      hsBorderWidth: LayoutEngine.mmToPx(
        parseTypstUnit(style.headerBorderWidth || style.borderWidth || '0.5pt')
      ),
      hsBorderColor: style.headerBorderColor || style.borderColor || '#cbd5e1',
      makeBorder: (show: boolean, w: number, c: string, dash = 'solid') =>
        show ? `${w}px ${toCssDash(dash)} ${c}` : 'none',
      groupHeaderStyle: component.groupHeaderStyle,
      groupFooterStyle: component.groupFooterStyle,
      columnsLength: component.columns.length,
      previewFontStack,
    };
  }, [
    component.style,
    component.isStatic,
    component.groupHeaderStyle,
    component.groupFooterStyle,
    component.columns.length,
    bodyFontFamily,
  ]);

  // Stable per-cell callbacks (latest-ref pattern) so memoized cells don't re-render
  // just because these closures got a new identity on the parent's re-render.
  const cellFnRef = useRef<{
    mouseDown: typeof handleCellMouseDown;
    mouseEnter: typeof handleCellMouseEnter;
    contextMenu: typeof handleCellContextMenu;
    save: (
      sectionKey: string,
      rowIdx: number,
      cell: TCell,
      logicalCol: number,
      isHeader: boolean,
      newVal: string
    ) => void;
  }>({
    mouseDown: handleCellMouseDown,
    mouseEnter: handleCellMouseEnter,
    contextMenu: handleCellContextMenu,
    save: () => {},
  });
  cellFnRef.current.mouseDown = handleCellMouseDown;
  cellFnRef.current.mouseEnter = handleCellMouseEnter;
  cellFnRef.current.contextMenu = handleCellContextMenu;
  cellFnRef.current.save = (sectionKey, rowIdx, cell, logicalCol, isHeader, newVal) => {
    if (sectionKey === '__generatedRows' || sectionKey === '__fillerRow') return;
    if (newVal === cell.content) return;
    // Record<string, unknown> access: sectionKey may be a FormTableComponent-only
    // key (footerGridRows) that doesn't exist on the TableComponent side of the union.
    const schemaRows =
      ((component as unknown as Record<string, unknown>)[sectionKey] as TableRow[]) || [];
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
  };

  const onCellMouseDown = useCallback(
    (section: SectionType, rowId: string, logicalCol: number, e: React.MouseEvent) =>
      cellFnRef.current.mouseDown(section, rowId, logicalCol, e),
    []
  );
  const onCellMouseEnter = useCallback(
    (section: SectionType, rowId: string, logicalCol: number) =>
      cellFnRef.current.mouseEnter(section, rowId, logicalCol),
    []
  );
  const onCellContextMenu = useCallback(
    (section: SectionType, rowId: string, logicalCol: number, e: React.MouseEvent) =>
      cellFnRef.current.contextMenu(section, rowId, logicalCol, e),
    []
  );
  const onCellSave = useCallback(
    (
      sectionKey: string,
      rowIdx: number,
      cell: TCell,
      logicalCol: number,
      isHeader: boolean,
      newVal: string
    ) => cellFnRef.current.save(sectionKey, rowIdx, cell, logicalCol, isHeader, newVal),
    []
  );
  const onEnterEdit = useCallback(() => setIsTableEditing(true), []);

  // ─── Render single cell ────────────────────────────────────────────────
  // Computes only the per-cell selection state (cheap) and delegates all styling to
  // the memoized TableCellView, so a selection change re-renders just the affected cells.
  const renderCell = (
    cell: TCell,
    logicalCol: number, // LOGICAL column — used for selection highlight & resize handles
    row: TableRow,
    rowIdx: number,
    sectionKey: string,
    section: SectionType,
    isHeader: boolean,
    sectionRows: TableRow[], // all rows in this section (for border calc)
    rowHeightPx?: number // set when the row has an explicit height (Typst treats it as fixed)
  ) => {
    const isSelected = isCellSelected(section, row.id, logicalCol);
    const isActiveCell =
      selectedCell?.tableId === component.id &&
      selectedCell.section === section &&
      selectedCell.rowId === row.id &&
      selectedCell.cellIdx === logicalCol;

    const isFirstRow = sectionRows.indexOf(row) === 0;
    const isLastRow = sectionRows.indexOf(row) === sectionRows.length - 1;
    const colSpan = cell.colspan || 1;

    const isSelectedAt = (targetRowIdx: number, targetCol: number) => {
      const targetRow = sectionRows[targetRowIdx];
      return targetRow ? isCellSelected(section, targetRow.id, targetCol) : false;
    };
    // Non-null only when selected, so unselected cells keep a stable `null` prop.
    const selectionEdges = isSelected
      ? {
          top: !isSelectedAt(rowIdx - 1, logicalCol),
          bottom: !isSelectedAt(rowIdx + 1, logicalCol),
          left: !isSelectedAt(rowIdx, logicalCol - 1),
          right: !isSelectedAt(rowIdx, logicalCol + colSpan),
        }
      : null;

    // HTML rows only grow (height is a minimum) while Typst fixed rows never do.
    // Clamp the cell's content box to the exact row height so the preview matches
    // the PDF. Skip merged cells — their height spans multiple rows.
    const fixedContentHeightPx =
      rowHeightPx !== undefined && (cell.rowspan ?? 1) <= 1
        ? Math.max(0, rowHeightPx - 2 * cellCtx.cellPaddingPx)
        : undefined;

    return (
      <TableCellView
        key={`${section}-${row.id}-${logicalCol}`}
        cell={cell}
        logicalCol={logicalCol}
        rowId={row.id}
        rowIdx={rowIdx}
        rowType={row.type}
        section={section}
        sectionKey={sectionKey}
        isHeader={isHeader}
        isFirstRow={isFirstRow}
        isLastRow={isLastRow}
        isTableEditing={isTableEditing}
        isSelected={isSelected}
        isActiveCell={!!isActiveCell}
        selectionEdges={selectionEdges}
        fixedContentHeightPx={fixedContentHeightPx}
        ctx={cellCtx}
        onCellMouseDown={onCellMouseDown}
        onCellMouseEnter={onCellMouseEnter}
        onCellContextMenu={onCellContextMenu}
        onEnterEdit={onEnterEdit}
        onCellSave={onCellSave}
      />
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
      const rowHeightPx = row.height ? LayoutEngine.mmToPx(parseTypstUnit(row.height)) : undefined;
      const logicalCols = physToLogical(grid, rowIdx, row.cells.length);
      return (
        <tr
          key={row.id}
          data-row-id={row.id}
          style={{ height: rowHeightPx !== undefined ? `${rowHeightPx}px` : undefined }}
        >
          {row.cells.map((cell, physIdx) => {
            const logicalCol = logicalCols[physIdx] ?? physIdx;
            return renderCell(
              cell,
              logicalCol,
              row,
              rowIdx,
              sectionKey,
              section,
              isHeader,
              rows,
              rowHeightPx
            );
          })}
        </tr>
      );
    });
  };

  // ─── Column widths via <colgroup> ─────────────────────────────────────
  const colWidths = useMemo(
    () => resolveTableColumnPercentages(component.columns, component.width || 180),
    [component.columns, component.width]
  );

  // Cumulative column percentages — used to position column dividers in the overlay
  const cumColWidths = useMemo(() => {
    let cum = 0;
    return colWidths.map((w) => {
      cum += w ? Number.parseFloat(w) : 0;
      return cum;
    });
  }, [colWidths]);

  return (
    <div
      ref={tableContainerRef}
      className="w-full h-full relative"
      data-table-editing={isTableEditing || undefined}
      onDoubleClick={handleTableDoubleClick}
    >
      {isTableEditing && isTableSelected && <TableToolbar component={component} />}

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
          fontFamily: cellCtx.previewFontStack,
          // Never stretch to the component frame: the generated Typst table is always
          // content-sized, so stretching made the preview taller than the PDF.
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

      {contextMenu && (
        <TableCellContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            [
              {
                key: 'merge',
                label: 'Merge cells',
                icon: Merge,
                onClick: handleMerge,
                disabled: !canMerge,
              },
              {
                key: 'split',
                label: 'Split cell',
                icon: Split,
                onClick: handleSplit,
                disabled: !canSplit,
              },
              {
                key: 'insert-row',
                label: 'Insert row below',
                icon: Rows3,
                onClick: handleInsertRow,
                separatorBefore: true,
              },
              {
                key: 'insert-col',
                label: 'Insert column right',
                icon: Columns2,
                onClick: handleInsertCol,
              },
              {
                key: 'align-left',
                label: 'Align left',
                icon: AlignLeft,
                onClick: () => handleAlign('left'),
                disabled: !canClear,
                separatorBefore: true,
              },
              {
                key: 'align-center',
                label: 'Align center',
                icon: AlignCenter,
                onClick: () => handleAlign('center'),
                disabled: !canClear,
              },
              {
                key: 'align-right',
                label: 'Align right',
                icon: AlignRight,
                onClick: () => handleAlign('right'),
                disabled: !canClear,
              },
              {
                key: 'delete-row',
                label: 'Delete row',
                icon: Trash2,
                onClick: handleDeleteRows,
                disabled: !canDeleteRow,
                danger: true,
                separatorBefore: true,
              },
              {
                key: 'delete-col',
                label: 'Delete column',
                icon: Trash2,
                onClick: handleDeleteColumns,
                disabled: !canDeleteColumn,
                danger: true,
              },
              {
                key: 'clear',
                label: 'Clear contents',
                icon: Eraser,
                onClick: handleClearContents,
                disabled: !canClear,
                separatorBefore: true,
              },
            ] satisfies ContextMenuItem[]
          }
        />
      )}
    </div>
  );
});

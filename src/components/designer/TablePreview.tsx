'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { buildLogicalGrid, physToLogical } from '@/lib/utils/table-grid';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import type { TableCell as TCell, TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { CellEditor } from './table/CellEditor';
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
  const isTableSelected = useDesignerStore((s) => s.selectedComponentIds.includes(component.id));
  const zoom = useDesignerStore((s) => s.zoom);

  const tableRef = useRef<HTMLTableElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const colGhostRef = useRef<HTMLDivElement>(null);
  const rowGhostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

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
    const fontWeight =
      cellStyle?.fontWeight ||
      (isHeader
        ? headerFontWeight
        : isGroupHeader
          ? ghStyle?.fontWeight
          : isGroupFooter
            ? gfStyle?.fontWeight
            : undefined) ||
      'normal';
    const isItalic =
      cellStyle?.italic ??
      (isGroupFooter ? !!gfStyle?.italic : isGroupHeader ? !!ghStyle?.italic : false);
    const isUnderline = cellStyle?.underline ?? (isGroupFooter ? !!gfStyle?.underline : false);
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
        className={clsx('relative group/cell cursor-cell', isSelected && 'z-10')}
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
        {/* Selection overlay — keeps original background, adds accent ring on top */}
        {isSelected && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none z-[5] bg-[var(--accent)]/[0.10]"
            style={{ boxShadow: 'inset 0 0 0 2px var(--accent)' }}
          />
        )}
        <CellEditor
          className="w-full bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300/60"
          style={{
            textAlign: resolvedAlign as any,
            fontFamily: cellFontFamily || 'inherit',
            color: textColor,
            fontSize: `${fontSize}pt`,
            fontWeight,
            fontStyle: isItalic ? 'italic' : 'normal',
            textDecoration: isUnderline ? 'underline' : 'none',
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

        {/* Column resize handle — at the right edge of this cell's last spanned column */}
        {isTableSelected && logicalCol + (cell.colspan || 1) - 1 < component.columns.length - 1 && (
          <div
            onMouseDown={(e) => handleColResizeStart(e, logicalCol + (cell.colspan || 1) - 1)}
            className="absolute top-0 -right-[3px] w-1.5 h-full cursor-col-resize z-[25] group/colresizer"
          >
            <div
              data-col-divider={logicalCol + (cell.colspan || 1) - 1}
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] h-full bg-transparent group-hover/colresizer:bg-[var(--accent)] transition-colors"
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-[1.5px] border-[var(--accent)] bg-white shadow-sm opacity-0 group-hover/colresizer:opacity-100 transition-opacity pointer-events-none z-30" />
          </div>
        )}

        {/* Row height resize handle */}
        {isTableSelected && !isGroupHeader && !isGroupFooter && (
          <div
            onMouseDown={(e) => handleRowResizeStart(e, sectionKey, rowIdx)}
            className="absolute -bottom-[3px] left-0 right-0 h-1.5 cursor-row-resize z-[25] group/rowresizer"
          >
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-transparent group-hover/rowresizer:bg-[var(--accent)] transition-colors" />
            {logicalCol === Math.floor(component.columns.length / 2) && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-[1.5px] border-[var(--accent)] w-5 h-1.5 rounded-full shadow-sm opacity-0 group-hover/rowresizer:opacity-100 transition-opacity pointer-events-none z-30 flex items-center justify-center">
                <div className="w-2 h-[1px] bg-[var(--accent)]" />
              </div>
            )}
          </div>
        )}
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
  const colWidths = (() => {
    const totalMm = component.width || 180;
    type Parsed = { type: 'fixed'; mm: number } | { type: 'fractional'; value: number };
    const parsed = component.columns.map((col): Parsed => {
      const w = col.width.trim();
      if (w.endsWith('mm')) return { type: 'fixed', mm: Number.parseFloat(w) };
      if (w.endsWith('pt')) return { type: 'fixed', mm: parseTypstUnit(w) };
      if (w === '*') return { type: 'fractional', value: 1 };
      if (w.endsWith('fr')) return { type: 'fractional', value: Number.parseFloat(w) || 1 };
      const num = Number.parseFloat(w);
      return Number.isNaN(num)
        ? { type: 'fractional', value: 1 }
        : { type: 'fractional', value: num };
    });
    let fixedSum = 0;
    let fracSum = 0;
    for (const p of parsed) {
      if (p.type === 'fixed') fixedSum += p.mm;
      else fracSum += p.value;
    }
    const remaining = Math.max(totalMm - fixedSum, 0);
    return parsed.map((p) => {
      if (p.type === 'fixed') return `${(p.mm / totalMm) * 100}%`;
      if (fracSum > 0) return `${(((p.value / fracSum) * remaining) / totalMm) * 100}%`;
      return undefined;
    });
  })();

  return (
    <div ref={tableContainerRef} className="w-full h-full relative">
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

      {/* Ghost guide lines — always mounted, shown/hidden via direct DOM */}
      <div
        ref={colGhostRef}
        className="hidden absolute top-0 bottom-0 w-px bg-[var(--accent)] z-[60] pointer-events-none"
      />
      <div
        ref={rowGhostRef}
        className="hidden absolute left-0 right-0 h-px bg-[var(--accent)] z-[60] pointer-events-none"
      />
      <div
        ref={tooltipRef}
        className="hidden absolute z-[70] bg-[var(--accent)] text-white text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded shadow-lg pointer-events-none whitespace-nowrap -translate-x-1/2 border border-white/20"
      />
    </div>
  );
}

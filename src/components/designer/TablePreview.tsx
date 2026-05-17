'use client';

import { LayoutEngine } from '@/lib/engine/layout-engine';
import { insertColumn, insertStructuredRow, mergeStructuredCells } from '@/lib/utils/table-utils';
import { parseTypstUnit } from '@/lib/utils/units';
import { useDesignerStore } from '@/store/designer-store';
import type { TableCell as TCell, TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { TableActionToolbar } from './TableActionToolbar';

// ─── Inline Cell Editor ─────────────────────────────────────────────────────
function InlineCellInput({
  initialValue,
  onSave,
  className,
  style,
  placeholder,
  title,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  title?: string;
}) {
  const [val, setVal] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [val]);

  return (
    <textarea
      ref={textareaRef}
      className={clsx(className, 'resize-none overflow-hidden min-h-[1.4em] p-0 block bg-transparent w-full')}
      style={{
        ...style,
        height: 'auto',
      }}
      rows={1}
      value={val}
      placeholder={placeholder}
      title={title}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

interface Props {
  component: TableComponent;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function TablePreview({ component }: Props) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const selectedCell = useDesignerStore((s) => s.selectedCell);
  const selectedCells = useDesignerStore((s) => s.selectedCells);
  const setSelectedCell = useDesignerStore((s) => s.setSelectedCell);
  const setSelectedCells = useDesignerStore((s) => s.setSelectedCells);

  const [resizingColIndex, setResizingColIndex] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  type SectionType = 'header' | 'data' | 'footer';
  const [selectionStart, setSelectionStart] = useState<{
    rowId: string;
    cellIdx: number;
    section: SectionType;
  } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  // ─── Auto-fit component height to actual table height ──────────────────
  useEffect(() => {
    if (!tableRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const tablePx = entry.contentRect.height;
        const tableMm = LayoutEngine.pxToMm(tablePx);
        const currentHeight = component.height || 60;
        if (Math.abs(tableMm - currentHeight) > 2) {
          updateComponent(component.id, { height: Math.ceil(tableMm) } as any);
        }
      }
    });
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [component.id, component.height, updateComponent]);

  // ─── Build rows from schema ────────────────────────────────────────────
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

  // Build preview body: group header → detail rows → subtotal → summary footer
  const buildPreviewRows = (): {
    rows: TableRow[];
    sectionKey: string;
    section: SectionType;
    isHeader: boolean;
  }[] => {
    const sections: {
      rows: TableRow[];
      sectionKey: string;
      section: SectionType;
      isHeader: boolean;
    }[] = [];

    const hasGroupBy = !!component.groupBy;

    // 1. Group Header row (preview placeholder)
    if (hasGroupBy) {
      const groupHeaderRow: TableRow = {
        id: 'preview-group-header',
        type: 'group-header',
        cells: [
          {
            id: 'gh-cell-0',
            content: component.groupHeaderFormat || `Group: {{${component.groupBy}}}`,
            colspan: component.columns.length,
            align: 'left',
            // No fill/style here — renderCell reads from component.groupHeaderStyle directly
          },
        ],
      };
      sections.push({
        rows: [groupHeaderRow],
        sectionKey: 'detailRows',
        section: 'data',
        isHeader: false,
      });
    }

    // 2. Detail rows (from schema or synthetic)
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

    // 3. Auto Group Footer / Subtotal row
    if (component.autoGroupFooter) {
      const subtotalRow: TableRow = {
        id: 'preview-group-footer',
        type: 'group-footer',
        cells: component.columns.map((col, idx) => ({
          id: `gf-cell-${idx}`,
          content: idx === 0 ? component.autoGroupFooterLabel || 'Subtotal' : col.footerExpr || '',
          align: col.align || 'left',
          // No fill/style here — renderCell reads from component.groupFooterStyle directly
        })),
      };
      sections.push({
        rows: [subtotalRow],
        sectionKey: 'detailRows',
        section: 'data',
        isHeader: false,
      });
    }

    // 4. Summary footer rows (footerRows)
    const footerRows: TableRow[] = component.footerRows || [];
    if (footerRows.length > 0) {
      sections.push({
        rows: footerRows,
        sectionKey: 'footerRows',
        section: 'footer',
        isHeader: false,
      });
    }

    return sections;
  };

  const previewSections = buildPreviewRows();

  // ─── Column resize ────────────────────────────────────────────────────
  const handleColResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColIndex(index);
    const startX = e.clientX;
    const columns = [...component.columns];
    const initialWidths = columns.map((col) => {
      if (col.width.endsWith('mm')) return Number.parseFloat(col.width);
      return LayoutEngine.pxToMm(40);
    });
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const zoom = Number.parseFloat(
        document.querySelector('[data-paper-container]')?.getAttribute('data-zoom') || '1'
      );
      const deltaMm = LayoutEngine.pxToMm(deltaX / zoom);
      const newWidths = [...initialWidths];
      newWidths[index] = Math.max(5, initialWidths[index] + deltaMm);
      const updatedCols = columns.map((col, i) => ({ ...col, width: `${newWidths[i]}mm` }));
      updateComponent(component.id, { columns: updatedCols } as any);
    };
    const onMouseUp = () => {
      setResizingColIndex(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ─── Cell selection ───────────────────────────────────────────────────
  const isCellSelected = (section: SectionType, rowId: string, cellIdx: number) => {
    if (
      !selectedCells ||
      selectedCells.tableId !== component.id ||
      selectedCells.section !== section
    )
      return false;
    return selectedCells.rowIds.includes(rowId) && selectedCells.cellIndices.includes(cellIdx);
  };

  const handleCellMouseDown = (
    section: SectionType,
    rowId: string,
    cellIdx: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setIsSelecting(true);
    setSelectionStart({ rowId, cellIdx, section });
    setSelectedCell({ tableId: component.id, section, rowId, cellIdx });
  };

  const handleCellMouseEnter = (section: SectionType, rowId: string, cellIdx: number) => {
    if (!isSelecting || !selectionStart || selectionStart.section !== section) return;
    const sectionKey =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = component[sectionKey] || [];
    const startRowIdx = rows.findIndex((r) => r.id === selectionStart.rowId);
    const endRowIdx = rows.findIndex((r) => r.id === rowId);
    if (startRowIdx === -1 || endRowIdx === -1) return;
    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(selectionStart.cellIdx, cellIdx);
    const maxCol = Math.max(selectionStart.cellIdx, cellIdx);
    const rowIds: string[] = [];
    for (let i = minRow; i <= maxRow; i++) rowIds.push(rows[i].id);
    const cellIndices: number[] = [];
    for (let i = minCol; i <= maxCol; i++) cellIndices.push(i);
    setSelectedCells({ tableId: component.id, section, rowIds, cellIndices });
  };

  const handleMouseUp = useCallback(() => setIsSelecting(false), []);
  useEffect(() => {
    if (isSelecting) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelecting, handleMouseUp]);

  // ─── Merge / Split / Delete / Insert ──────────────────────────────────
  const handleMerge = () => {
    if (!selectedCells) return;
    const sectionKey =
      selectedCells.section === 'header'
        ? 'headerRows'
        : selectedCells.section === 'footer'
          ? 'footerRows'
          : 'detailRows';
    const rows = component[sectionKey] || [];
    const rowIndices = selectedCells.rowIds
      .map((id) => rows.findIndex((r) => r.id === id))
      .sort((a, b) => a - b);
    const colIndices = [...selectedCells.cellIndices].sort((a, b) => a - b);
    const newRows = mergeStructuredCells(
      rows,
      rowIndices[0],
      rowIndices[rowIndices.length - 1],
      colIndices[0],
      colIndices[colIndices.length - 1]
    );
    updateComponent(component.id, { [sectionKey]: newRows } as any);
    setSelectedCell(null);
  };

  const handleSplit = () => {
    if (!selectedCell) return;
    const { section, rowId, cellIdx } = selectedCell;
    const sectionKey =
      section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
    const rows = [...(component[sectionKey] || [])];
    const rowIdx = rows.findIndex((r) => r.id === rowId);
    if (rowIdx === -1) return;
    const cell = rows[rowIdx].cells[cellIdx];
    if (!cell || (!cell.colspan && !cell.rowspan)) return;
    const newCells = [...rows[rowIdx].cells];
    const currentColspan = cell.colspan || 1;
    newCells[cellIdx] = { ...cell, colspan: 1, rowspan: 1 };
    for (let i = 1; i < currentColspan; i++) {
      newCells.splice(cellIdx + i, 0, { id: `restore-${Math.random()}`, content: '' });
    }
    rows[rowIdx] = { ...rows[rowIdx], cells: newCells };
    updateComponent(component.id, { [sectionKey]: rows } as any);
  };

  const handleDelete = () => {
    if (!selectedCells) return;
    const { section, rowIds, cellIndices } = selectedCells;
    if (section === 'data' && !component.detailRows) {
      const newCols = component.columns.filter((_, idx) => !cellIndices.includes(idx));
      updateComponent(component.id, { columns: newCols } as any);
    } else {
      const sectionKey =
        section === 'header' ? 'headerRows' : section === 'footer' ? 'footerRows' : 'detailRows';
      const rows = component[sectionKey] || [];
      const newRows = rows.filter((r) => !rowIds.includes(r.id));
      updateComponent(component.id, { [sectionKey]: newRows } as any);
    }
    setSelectedCell(null);
  };

  const handleInsertRow = () => {
    if (!selectedCells) return;
    const sectionKey =
      selectedCells.section === 'header'
        ? 'headerRows'
        : selectedCells.section === 'footer'
          ? 'footerRows'
          : 'detailRows';
    const rows = component[sectionKey] || [];
    const lastRowId = selectedCells.rowIds[selectedCells.rowIds.length - 1];
    const index = rows.findIndex((r) => r.id === lastRowId);
    const newRows = insertStructuredRow(
      rows,
      index,
      component.columns.length,
      selectedCells.section as any
    );
    updateComponent(component.id, { [sectionKey]: newRows } as any);
  };

  const handleInsertCol = () => {
    if (!selectedCells) return;
    const lastColIdx = selectedCells.cellIndices[selectedCells.cellIndices.length - 1];
    const updates = insertColumn(component, lastColIdx);
    updateComponent(component.id, updates as any);
  };

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

  // ─── Border style variables ───────────────────────────────────────────
  // Outer border
  const obWidth = LayoutEngine.mmToPx(parseTypstUnit(style.borderWidth || '0.5pt'));
  const obColor = style.borderColor || '#cbd5e1';
  // Inner horizontal (between rows)
  const ihWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.innerHBorderWidth || style.borderWidth || '0.5pt')
  );
  const ihColor = style.innerHBorderColor || style.borderColor || '#cbd5e1';
  const ihDash = style.horizontalDash || 'solid';
  // Inner vertical (between cols)
  const ivWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.innerVBorderWidth || style.borderWidth || '0.5pt')
  );
  const ivColor = style.innerVBorderColor || style.borderColor || '#cbd5e1';
  const ivDash = style.verticalDash || 'solid';
  // Header separator (bottom of last header row)
  const hsBorderWidth = LayoutEngine.mmToPx(
    parseTypstUnit(style.headerBorderWidth || style.borderWidth || '0.5pt')
  );
  const hsBorderColor = style.headerBorderColor || style.borderColor || '#cbd5e1';

  const toCssDash = (d: string) =>
    d === 'dashed' ? 'dashed' : d === 'dotted' ? 'dotted' : 'solid';

  // ─── Save cell content ────────────────────────────────────────────────
  const handleCellSave = (
    sectionKey: string,
    rows: TableRow[],
    rowIdx: number,
    cellId: string,
    newVal: string
  ) => {
    const newRows = [...rows];
    const newCells = [...newRows[rowIdx].cells];
    const idx = newCells.findIndex((c) => c.id === cellId);
    if (idx === -1) return;
    newCells[idx] = { ...newCells[idx], content: newVal };
    newRows[rowIdx] = { ...newRows[rowIdx], cells: newCells };
    updateComponent(component.id, { [sectionKey]: newRows } as any);
  };

  // ─── Render a single cell <td> ────────────────────────────────────────
  const renderCell = (
    cell: TCell,
    cellIdx: number,
    row: TableRow,
    rowIdx: number,
    sectionKey: string,
    section: SectionType,
    isHeader: boolean,
    _totalDataRows: number
  ) => {
    const isGroupHeader = row.type === 'group-header';
    const isGroupFooter = row.type === 'group-footer' || (row.type === 'footer' && !isHeader);
    const isSelected = isCellSelected(section, row.id, cellIdx);
    const cellStyle = cell.style;

    // Background
    let cellFill = cell.fill || '';
    if (!cellFill) {
      if (isHeader) {
        cellFill = headerBg;
      } else if (isGroupHeader) {
        cellFill = (component.groupHeaderStyle as any)?.background || 'transparent';
      } else if (isGroupFooter) {
        cellFill = (component.groupFooterStyle as any)?.background || 'transparent';
      } else {
        if (pattern === 'striped-rows') cellFill = rowIdx % 2 === 0 ? c1 : c2;
        else if (pattern === 'striped-cols') cellFill = cellIdx % 2 === 0 ? c1 : c2;
        else if (pattern === 'checkerboard') cellFill = (rowIdx + cellIdx) % 2 === 0 ? c1 : c2;
        else cellFill = 'transparent';
      }
    }

    // Text styling — reads from user-configured styles only
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
    const textDirection = cell.textDirection || 'horizontal';
    const isVertical = textDirection === 'vertical';
    // Group header/footer rows have actual content — don't show binding placeholder
    const placeholder =
      isHeader || isGroupHeader || isGroupFooter ? '' : isStaticTable ? '' : '{{binding}}';

    // ─── Structural border calculation ────────────────────────────────
    // Determine position in the rendered section
    const allSectionRows = (() => {
      if (isHeader) return headerRows;
      // For body, find which section this row belongs to
      for (const sec of previewSections) {
        if (sec.rows.some((r) => r.id === row.id)) return sec.rows;
      }
      return [];
    })();
    const isFirstRow = allSectionRows.indexOf(row) === 0;
    const isLastRow = allSectionRows.indexOf(row) === allSectionRows.length - 1;
    const isFirstCol = cellIdx === 0;
    const isLastCol = cellIdx + (cell.colspan || 1) === component.columns.length;
    const isLastHeaderRow = isHeader && isFirstRow; // single header section — treat as last
    const _isHeaderBoundary = isLastHeaderRow && !isHeader; // not used here but guard

    const makeBorder = (show: boolean, w: number, c: string, dash = 'solid') =>
      show ? `${w}px ${toCssDash(dash)} ${c}` : 'none';

    const borderStyle: React.CSSProperties = {
      // Top edge: outer top for first rows, inner-H for others
      borderTop: isFirstRow
        ? makeBorder(sides.top, obWidth, obColor)
        : makeBorder(sides.innerH, ihWidth, ihColor, ihDash),
      // Bottom edge: outer bottom for last rows + header separator
      borderBottom: isLastHeaderRow
        ? makeBorder(true, hsBorderWidth, hsBorderColor) // header separator always shown
        : isLastRow
          ? makeBorder(sides.bottom, obWidth, obColor)
          : makeBorder(sides.innerH, ihWidth, ihColor, ihDash),
      // Left edge: outer left for first col, inner-V for others
      borderLeft: isFirstCol
        ? makeBorder(sides.left, obWidth, obColor)
        : makeBorder(sides.innerV, ivWidth, ivColor, ivDash),
      // Right edge: outer right for last col, inner-V for others
      borderRight: isLastCol
        ? makeBorder(sides.right, obWidth, obColor)
        : makeBorder(sides.innerV, ivWidth, ivColor, ivDash),
    };

    const Tag = isHeader ? 'th' : 'td';

    return (
      <Tag
        key={`${section}-${row.id}-${cellIdx}`}
        colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
        rowSpan={cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined}
        onMouseDown={(e) => handleCellMouseDown(section, row.id, cellIdx, e)}
        onMouseEnter={() => handleCellMouseEnter(section, row.id, cellIdx)}
        className={clsx(
          'relative group/cell cursor-cell',
          isSelected && 'ring-2 ring-[var(--accent)] ring-inset z-10'
        )}
        style={{
          ...borderStyle,
          backgroundColor: isSelected ? 'rgba(59,130,246,0.06)' : cellFill,
          padding: `${cellPaddingPx}px`,
          textAlign: resolvedAlign as any,
          verticalAlign: cell.verticalAlign || 'middle',
          ...(isVertical
            ? { writingMode: 'vertical-rl' as any, textOrientation: 'mixed' as any }
            : {}),
        }}
      >
        <InlineCellInput
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
            // Legacy column-based tables
            if (
              !component[sectionKey as keyof TableComponent] ||
              (component[sectionKey as keyof TableComponent] as any)?.length === 0
            ) {
              if (isHeader) {
                const newCols = [...component.columns];
                if (newCols[cellIdx]) newCols[cellIdx].header = newVal;
                updateComponent(component.id, { columns: newCols } as any);
              } else {
                const newCols = [...component.columns];
                const fieldVal = newVal.replace(/[{}]/g, '');
                if (newCols[cellIdx]) newCols[cellIdx].field = fieldVal;
                updateComponent(component.id, { columns: newCols } as any);
              }
              return;
            }
            handleCellSave(
              sectionKey,
              component[sectionKey as keyof TableComponent] as TableRow[],
              rowIdx,
              cell.id,
              newVal
            );
          }}
        />

        {/* Column resize handle */}
        <div
          onMouseDown={(e) => handleColResizeStart(e, cellIdx + (cell.colspan || 1) - 1)}
          className={clsx(
            'absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 transition-colors',
            resizingColIndex === cellIdx
              ? 'bg-[var(--accent)]'
              : 'hover:bg-[var(--accent)] opacity-0 hover:opacity-100'
          )}
        />
      </Tag>
    );
  };

  // ─── Render row helper ────────────────────────────────────────────────
  const renderRows = (
    rows: TableRow[],
    sectionKey: string,
    section: SectionType,
    isHeader: boolean
  ) => {
    return rows.map((row, rowIdx) => {
      const rowHeight = row.height
        ? `${LayoutEngine.mmToPx(parseTypstUnit(row.height))}px`
        : undefined;
      return (
        <tr key={row.id} style={{ height: rowHeight }}>
          {row.cells.map((cell, cellIdx) =>
            renderCell(cell, cellIdx, row, rowIdx, sectionKey, section, isHeader, rows.length)
          )}
        </tr>
      );
    });
  };

  // ─── Column widths via <colgroup> ─────────────────────────────────────
  const colWidths = (() => {
    const totalTableWidthMm = component.width || 180;

    type ParsedCol =
      | { type: 'fixed'; mm: number }
      | { type: 'fractional'; value: number };

    // 1. Parse all widths to millimeters or fractional values
    const parsedColumns = component.columns.map((col): ParsedCol => {
      const w = col.width.trim();
      if (w.endsWith('mm')) {
        return { type: 'fixed', mm: Number.parseFloat(w) };
      }
      if (w.endsWith('pt')) {
        // convert pt to mm (1pt ≈ 0.352778mm)
        return { type: 'fixed', mm: parseTypstUnit(w) };
      }
      if (w === '*') {
        return { type: 'fractional', value: 1 };
      }
      if (w.endsWith('fr')) {
        return { type: 'fractional', value: Number.parseFloat(w) || 1 };
      }
      // fallback for raw numbers or anything else (treat as fractional like Typst does)
      const num = Number.parseFloat(w);
      if (!Number.isNaN(num)) {
        return { type: 'fractional', value: num };
      }
      // default/fallback
      return { type: 'fractional', value: 1 };
    });

    // 2. Sum up fixed widths and fractions
    let fixedSumMm = 0;
    let fractionSum = 0;
    for (const p of parsedColumns) {
      if (p.type === 'fixed') {
        fixedSumMm += p.mm;
      } else {
        fractionSum += p.value;
      }
    }

    // 3. Calculate remaining width
    const remainingMm = Math.max(totalTableWidthMm - fixedSumMm, 0);

    // 4. Convert all to percentage of the table width
    return parsedColumns.map((p) => {
      if (p.type === 'fixed') {
        return `${(p.mm / totalTableWidthMm) * 100}%`;
      }
      if (fractionSum > 0) {
        const shareMm = (p.value / fractionSum) * remainingMm;
        return `${(shareMm / totalTableWidthMm) * 100}%`;
      }
      return undefined; // fallback
    });
  })();

  return (
    <div className="w-full h-full relative">
      {selectedCells?.tableId === component.id && (
        <TableActionToolbar
          component={component}
          selectedCells={selectedCells}
          onMerge={handleMerge}
          onSplit={handleSplit}
          onDelete={handleDelete}
          onInsertRow={handleInsertRow}
          onInsertCol={handleInsertCol}
        />
      )}

      <table
        ref={tableRef}
        className="w-full"
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: style.fontFamily || 'inherit',
          height: '100%',
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
          {previewSections.map((sec, _i) =>
            renderRows(sec.rows, sec.sectionKey, sec.section, sec.isHeader)
          )}
        </tbody>
      </table>
    </div>
  );
}

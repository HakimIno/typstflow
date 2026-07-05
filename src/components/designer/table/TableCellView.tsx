'use client';

import { buildPreviewFontStack } from '@/lib/utils/preview-fonts';
import type { StrokeConfig, TableCell as TCell, TableRow, TableStyle } from '@/types/schema';
import { clsx } from 'clsx';
import type React from 'react';
import { memo } from 'react';
import { CellEditor } from './CellEditor';
import type { SectionType } from './useCellSelection';

type BorderSides = {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  innerH: boolean;
  innerV: boolean;
};

/**
 * Table-level style bundle shared by every cell. Built once per TablePreview render
 * with useMemo so its identity is stable across selection changes — that stability
 * is what lets the memoized cell skip re-rendering when only the selection moved.
 */
export interface CellStyleCtx {
  style: TableStyle;
  isStaticTable: boolean;
  sides: BorderSides;
  cellPaddingPx: number;
  headerBg: string;
  headerColor: string;
  bodyColor: string;
  headerFontSize: number;
  bodyFontSize: number;
  headerFontWeight: string | number;
  pattern: string;
  c1: string;
  c2: string;
  obWidth: number;
  obColor: string;
  ihWidth: number;
  ihColor: string;
  ihDash: string;
  ivWidth: number;
  ivColor: string;
  ivDash: string;
  hsBorderWidth: number;
  hsBorderColor: string;
  makeBorder: (show: boolean, w: number, c: string, dash?: string) => string;
  groupHeaderStyle: any;
  groupFooterStyle: any;
  columnsLength: number;
  previewFontStack: string;
}

export interface SelectionEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

interface TableCellViewProps {
  cell: TCell;
  logicalCol: number;
  rowId: string;
  rowIdx: number;
  rowType: TableRow['type'];
  section: SectionType;
  sectionKey: string;
  isHeader: boolean;
  isFirstRow: boolean;
  isLastRow: boolean;
  isTableEditing: boolean;
  isSelected: boolean;
  isActiveCell: boolean;
  /** Non-null only for selected cells (so unselected cells keep a stable `null` prop). */
  selectionEdges: SelectionEdges | null;
  /**
   * Exact content-box height when the row has an explicit height. Typst fixed rows
   * never grow, but HTML `<tr height>` is only a minimum — clamping the content box
   * keeps the preview row geometry identical to the generated PDF.
   */
  fixedContentHeightPx?: number;
  ctx: CellStyleCtx;
  onCellMouseDown: (
    section: SectionType,
    rowId: string,
    logicalCol: number,
    e: React.MouseEvent
  ) => void;
  onCellMouseEnter: (rowId: string, logicalCol: number) => void;
  onCellContextMenu: (
    section: SectionType,
    rowId: string,
    logicalCol: number,
    e: React.MouseEvent
  ) => void;
  onEnterEdit: () => void;
  onCellSave: (
    sectionKey: string,
    rowIdx: number,
    cell: TCell,
    logicalCol: number,
    isHeader: boolean,
    newVal: string
  ) => void;
}

/**
 * A single table cell. Extracted from TablePreview and memoized so that a selection
 * change only re-renders the cells whose selection/active state actually changed —
 * not every cell in the table.
 */
export const TableCellView = memo(function TableCellView({
  cell,
  logicalCol,
  rowId,
  rowIdx,
  rowType,
  section,
  sectionKey,
  isHeader,
  isFirstRow,
  isLastRow,
  isTableEditing,
  isSelected,
  isActiveCell,
  selectionEdges,
  fixedContentHeightPx,
  ctx,
  onCellMouseDown,
  onCellMouseEnter,
  onCellContextMenu,
  onEnterEdit,
  onCellSave,
}: TableCellViewProps) {
  const isGroupHeader = rowType === 'group-header';
  const isGroupFooter = rowType === 'group-footer' || (rowType === 'footer' && !isHeader);
  const cellStyle = cell.style;

  // Background
  let cellFill = cell.fill || '';
  if (!cellFill) {
    if (isHeader) cellFill = ctx.headerBg;
    else if (isGroupHeader) cellFill = ctx.groupHeaderStyle?.background || 'transparent';
    else if (isGroupFooter) cellFill = ctx.groupFooterStyle?.background || 'transparent';
    else if (ctx.pattern === 'striped-rows') cellFill = rowIdx % 2 === 0 ? ctx.c1 : ctx.c2;
    else if (ctx.pattern === 'striped-cols') cellFill = logicalCol % 2 === 0 ? ctx.c1 : ctx.c2;
    else if (ctx.pattern === 'checkerboard')
      cellFill = (rowIdx + logicalCol) % 2 === 0 ? ctx.c1 : ctx.c2;
    else cellFill = 'transparent';
  }

  // Text styling
  const ghStyle = ctx.groupHeaderStyle;
  const gfStyle = ctx.groupFooterStyle;
  const textColor =
    cellStyle?.color ||
    (isHeader
      ? ctx.headerColor
      : isGroupHeader
        ? ghStyle?.color
        : isGroupFooter
          ? gfStyle?.color
          : undefined) ||
    ctx.bodyColor;
  const fontSize =
    cellStyle?.fontSize ||
    (isHeader
      ? ctx.headerFontSize
      : isGroupHeader
        ? ghStyle?.fontSize
        : isGroupFooter
          ? gfStyle?.fontSize
          : undefined) ||
    ctx.bodyFontSize;
  const fontWeightRaw =
    cellStyle?.fontWeight ||
    (isHeader
      ? ctx.headerFontWeight
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

  const cellFontFamily = cellStyle?.fontFamily || ctx.style.fontFamily;
  const cellFontStack = cellFontFamily
    ? buildPreviewFontStack(cellFontFamily)
    : ctx.previewFontStack;
  const resolvedAlign = cell.align || 'left';
  const isVertical = (cell.textDirection || 'horizontal') === 'vertical';
  const placeholder =
    isHeader || isGroupHeader || isGroupFooter ? '' : ctx.isStaticTable ? '' : '{{binding}}';

  // Border calculation
  const { sides, makeBorder } = ctx;
  const isFirstCol = logicalCol === 0;
  const isLastCol = logicalCol + (cell.colspan || 1) === ctx.columnsLength;
  const isLastHeaderRow = isHeader && isLastRow;

  const borderStyle: React.CSSProperties = {
    borderTop: isFirstRow
      ? makeBorder(sides.top, ctx.obWidth, ctx.obColor)
      : makeBorder(sides.innerH, ctx.ihWidth, ctx.ihColor, ctx.ihDash),
    borderBottom: isLastHeaderRow
      ? makeBorder(true, ctx.hsBorderWidth, ctx.hsBorderColor)
      : isLastRow
        ? makeBorder(sides.bottom, ctx.obWidth, ctx.obColor)
        : makeBorder(sides.innerH, ctx.ihWidth, ctx.ihColor, ctx.ihDash),
    borderLeft: isFirstCol
      ? makeBorder(sides.left, ctx.obWidth, ctx.obColor)
      : makeBorder(sides.innerV, ctx.ivWidth, ctx.ivColor, ctx.ivDash),
    borderRight: isLastCol
      ? makeBorder(sides.right, ctx.obWidth, ctx.obColor)
      : makeBorder(sides.innerV, ctx.ivWidth, ctx.ivColor, ctx.ivDash),
  };
  applyCellStroke(borderStyle, cell.stroke, ctx);

  const Tag = isHeader ? 'th' : 'td';

  return (
    <Tag
      colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
      rowSpan={cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined}
      data-cell-row={rowId}
      data-cell-col={logicalCol}
      onMouseDown={(e) => onCellMouseDown(section, rowId, logicalCol, e)}
      onMouseEnter={() => onCellMouseEnter(rowId, logicalCol)}
      onContextMenu={(e) => onCellContextMenu(section, rowId, logicalCol, e)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEnterEdit();
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
        padding: `${ctx.cellPaddingPx}px`,
        textAlign: resolvedAlign as any,
        verticalAlign: cell.verticalAlign || 'middle',
        ...(isVertical
          ? { writingMode: 'vertical-rl' as any, textOrientation: 'mixed' as any }
          : {}),
      }}
    >
      {/* Figma-style cell selection — 1px outline; active cell uses inset shadow only */}
      {isSelected && isTableEditing && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-[5] bg-[var(--accent)]/[0.03]"
          style={
            isActiveCell
              ? { boxShadow: 'inset 0 0 0 1px var(--accent)' }
              : {
                  borderTop: selectionEdges?.top ? '1px solid var(--accent)' : undefined,
                  borderBottom: selectionEdges?.bottom ? '1px solid var(--accent)' : undefined,
                  borderLeft: selectionEdges?.left ? '1px solid var(--accent)' : undefined,
                  borderRight: selectionEdges?.right ? '1px solid var(--accent)' : undefined,
                }
          }
        />
      )}
      {isSelected && !isTableEditing && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-[5] bg-[var(--accent)]/[0.04]"
        />
      )}
      {(() => {
        const editor = (
          <CellEditor
            readOnly={!isTableEditing}
            className="w-full bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-300/60"
            style={{
              textAlign: resolvedAlign as any,
              fontFamily: cellFontStack,
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
            onSave={(newVal) => onCellSave(sectionKey, rowIdx, cell, logicalCol, isHeader, newVal)}
          />
        );
        // Fixed-height rows: clamp + clip the content box so the row renders at the
        // exact height Typst will output (HTML rows otherwise grow to fit content).
        if (fixedContentHeightPx === undefined || isVertical) return editor;
        const justify =
          cell.verticalAlign === 'top'
            ? 'flex-start'
            : cell.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'center';
        return (
          <div
            style={{
              height: `${fixedContentHeightPx}px`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: justify,
            }}
          >
            {editor}
          </div>
        );
      })()}
    </Tag>
  );
});

function applyCellStroke(
  style: React.CSSProperties,
  stroke: StrokeConfig | undefined,
  ctx: CellStyleCtx
) {
  if (!stroke) return;
  if (stroke.top !== undefined) style.borderTop = strokeToCssBorder(stroke.top, ctx);
  if (stroke.bottom !== undefined) style.borderBottom = strokeToCssBorder(stroke.bottom, ctx);
  if (stroke.left !== undefined) style.borderLeft = strokeToCssBorder(stroke.left, ctx);
  if (stroke.right !== undefined) style.borderRight = strokeToCssBorder(stroke.right, ctx);
}

function strokeToCssBorder(value: string, ctx: CellStyleCtx): string {
  const trimmed = value.trim();
  if (trimmed === 'none') return 'none';

  const width = trimmed.match(/\d*\.?\d+(?:pt|px|mm|cm)?/)?.[0] ?? ctx.style.borderWidth ?? '0.5pt';
  const color =
    trimmed.match(/#[0-9a-fA-F]{3,8}/)?.[0] ??
    trimmed.match(/\b(?:black|white|red|blue|green|gray|grey)\b/)?.[0] ??
    ctx.obColor;

  return `${width} solid ${color}`;
}

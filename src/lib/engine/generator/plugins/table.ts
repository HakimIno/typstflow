import { resolveTableColumnWidths } from '@/lib/utils/table-widths';
import { escapeTypst } from '@/lib/utils/typst-utils';
import type { FormatType, StrokeConfig, TableComponent, TableRow } from '@/types/schema';
import { isVisible, resolveBinding, resolvePath } from '../binding';
import {
  escapeStringLiteral,
  formatColor,
  formatFontFamily,
  formatTypstFontStack,
  formatWeight,
  wrapPlacement,
} from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export interface TableRenderOptions {
  minRows?: number;
  trailingRows?: TableRow[];
}

export function renderTableComponent(
  comp: TableComponent,
  ctx: RenderContext,
  options: TableRenderOptions = {}
): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const cols = comp.columns;
    const style = comp.style;
    const parts: string[] = [];
    const headerRowCount = comp.headerRows?.length ?? (comp.showHeader !== false ? 1 : 0);

    // ── Column widths ─────────────────────────────────────────────────────────
    const colWidths = resolveTableColumnWidths(cols, comp.width ?? 180)
      .map((width) => `${formatMm(width)}mm`)
      .join(', ');

    // ── Stroke ────────────────────────────────────────────────────────────────
    const borderWidth = normalizeLength(style?.borderWidth ?? '0.5pt');
    const borderColor = formatColor(style?.borderColor ?? '#cbd5e1');

    // Header specific
    const hBorderWidth = normalizeLength(style?.headerBorderWidth ?? borderWidth);
    const hBorderColor = formatColor(style?.headerBorderColor ?? borderColor);

    // Inner Body specific
    const innerHWidth = normalizeLength(style?.innerHBorderWidth ?? borderWidth);
    const innerHColor = formatColor(style?.innerHBorderColor ?? borderColor);
    const innerVWidth = normalizeLength(style?.innerVBorderWidth ?? borderWidth);
    const innerVColor = formatColor(style?.innerVBorderColor ?? borderColor);

    const hDash =
      style?.horizontalDash && style.horizontalDash !== 'solid'
        ? `, dash: "${style.horizontalDash}"`
        : '';
    const vDash =
      style?.verticalDash && style.verticalDash !== 'solid'
        ? `, dash: "${style.verticalDash}"`
        : '';

    const hHeaderDash =
      style?.headerHorizontalDash && style.headerHorizontalDash !== 'solid'
        ? `, dash: "${style.headerHorizontalDash}"`
        : '';
    const vHeaderDash =
      style?.headerVerticalDash && style.headerVerticalDash !== 'solid'
        ? `, dash: "${style.headerVerticalDash}"`
        : '';

    const sides = style?.borderSides ?? {
      top: true,
      bottom: true,
      left: true,
      right: true,
      innerH: true,
      innerV: true,
    };

    // We'll use a stroke function to handle granular control
    const strokeStr = `(x, y) => (
    top: if y == 0 { if ${sides.top} { (paint: ${borderColor}, thickness: ${borderWidth}) } else { none } } 
         else if y == ${headerRowCount} { (paint: ${hBorderColor}, thickness: ${hBorderWidth}) }
         else if y < ${headerRowCount} { (paint: ${borderColor}, thickness: ${borderWidth}${hHeaderDash}) }
         else { if ${sides.innerH} { (paint: ${innerHColor}, thickness: ${innerHWidth}${hDash}) } else { none } },
    left: if x == 0 { if ${sides.left} { (paint: ${borderColor}, thickness: ${borderWidth}) } else { none } } 
          else if y < ${headerRowCount} { (paint: ${innerVColor}, thickness: ${innerVWidth}${vHeaderDash}) }
          else { if ${sides.innerV} { (paint: ${innerVColor}, thickness: ${innerVWidth}${vDash}) } else { none } },
    bottom: none, // handled by hline for better reliability
    right: none,  // handled by vline for better reliability
  )`;

    // ── Fill pattern ─────────────────────────────────────────────────────────
    const fillPattern = style?.fillPattern ?? 'header-only';
    const headerBg = formatColor(style?.headerBackground ?? '#f1f5f9');
    const color1 = formatColor(style?.stripedColor1 ?? style?.alternateRowBackground ?? '#ffffff');
    const color2 = formatColor(style?.stripedColor2 ?? '#f8fafc');

    const fillFn = buildFillFn(fillPattern, headerRowCount, headerBg, color1, color2);

    // ── Text Defaults ──────────────────────────────────────────────────────────
    const headerFontSize = style?.headerFontSize ?? 10;
    const headerColor = formatColor(style?.headerColor ?? '#000000');
    const headerWeight = style?.headerFontWeight ?? 'bold';
    const bodyFontSize = style?.bodyFontSize ?? 10;
    const bodyColor = formatColor(style?.bodyColor ?? '#334155');
    const tableFontFamily = style?.fontFamily ?? 'Sarabun';
    const headerTextStyle = {
      size: headerFontSize,
      color: headerColor,
      weight: headerWeight,
      fontFamily: tableFontFamily,
    };
    const bodyTextStyle = {
      size: bodyFontSize,
      color: bodyColor,
      weight: 'regular' as const,
      fontFamily: tableFontFamily,
    };

    // ── Global Table Font Setups ──────────────────────────────────────────────
    if (style?.fontFamily || style?.fontSize || style?.fontWeight || style?.lineHeight) {
      const textArgs: string[] = [];
      if (style.fontSize) textArgs.push(`size: ${style.fontSize}pt`);
      if (style.fontWeight) textArgs.push(`weight: ${formatWeight(style.fontWeight)}`);
      textArgs.push(`font: ${formatTypstFontStack(style?.fontFamily)}`);
      if (textArgs.length > 0) {
        parts.push(`#set text(${textArgs.join(', ')})\n`);
      }
      if (style.lineHeight) {
        parts.push(`#set par(leading: ${style.lineHeight - 1}em)\n`);
      }
    }

    // ── Resolve data items early (needed for rows: parameter) ────────────────
    const isStatic = comp.isStatic ?? false;
    const dataItems = isStatic
      ? [ctx.local]
      : (() => {
          const path = comp.dataSource.replace(/\{\{|\}\}/g, '').trim();
          const raw = resolvePath(path, ctx.local) ?? resolvePath(path, ctx.global);
          return Array.isArray(raw) ? raw : [];
        })();
    const detailRowCount =
      comp.detailRows && comp.detailRows.length > 0 ? comp.detailRows.length : 1;
    const padCount =
      !comp.groupBy && !isStatic && options.minRows
        ? Math.max(0, options.minRows - dataItems.length)
        : 0;

    // ── Compute rows: parameter (maps each physical row to its height) ────────
    // Without this, Typst ignores row.height set in the designer entirely.
    const rowsArr: string[] = [];
    let hasCustomRowHeight = false;

    const pushRowHeight = (h: string | undefined) => {
      if (h) {
        rowsArr.push(h); // e.g. "12.5mm" — Typst understands directly
        hasCustomRowHeight = true;
      } else {
        rowsArr.push('auto');
      }
    };

    // 1. Header rows
    if (comp.headerRows?.length) {
      for (const row of comp.headerRows) pushRowHeight(row.height);
    } else if (comp.showHeader !== false) {
      pushRowHeight(undefined); // synthetic header: auto
    }

    // 2. Data rows — enumerate using resolved dataItems so we know the exact count
    if (comp.groupBy && !isStatic) {
      const groups = new Map<string, any[]>();
      for (const item of dataItems) {
        const key = String(resolvePath(comp.groupBy, item) ?? 'Other');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(item);
      }
      for (const items of groups.values()) {
        rowsArr.push('auto'); // group-header row
        for (let i = 0; i < items.length; i++) {
          if (comp.detailRows?.length) {
            for (const dr of comp.detailRows) pushRowHeight(dr.height);
          } else {
            pushRowHeight(undefined);
          }
        }
        if (comp.autoGroupFooter) rowsArr.push('auto');
        if (comp.repeatSummaryOnGroup && comp.summaryRows?.length) {
          for (const _sr of comp.summaryRows) rowsArr.push('auto');
        }
      }
    } else {
      for (let i = 0; i < dataItems.length; i++) {
        if (comp.detailRows?.length) {
          for (const dr of comp.detailRows) pushRowHeight(dr.height);
        } else {
          pushRowHeight(undefined);
        }
      }
      for (let i = 0; i < padCount; i++) {
        if (comp.detailRows?.length) {
          for (const dr of comp.detailRows) pushRowHeight(dr.height);
        } else {
          pushRowHeight(undefined);
        }
      }
      for (const row of options.trailingRows ?? []) pushRowHeight(row.height);
      if (comp.summaryRows?.length && !comp.repeatSummaryOnGroup) {
        for (const _sr of comp.summaryRows) rowsArr.push('auto');
      }
    }

    // 3. Footer rows
    for (const row of comp.footerRows ?? []) pushRowHeight(row.height);

    // ── Table args ────────────────────────────────────────────────────────────
    const inset = style?.inset ?? style?.cellPadding ?? '7pt';
    const tableArgs = [`columns: (${colWidths})`, `inset: ${inset}`, `stroke: ${strokeStr}`];
    if (fillFn) tableArgs.push(`fill: ${fillFn}`);
    if (hasCustomRowHeight && rowsArr.length > 0) {
      tableArgs.push(`rows: (${rowsArr.join(', ')})`);
    }

    parts.push(`#table(\n  ${tableArgs.join(',\n  ')},\n`);

    // ── Header ────────────────────────────────────────────────────────────────
    const repeat = comp.repeatHeaderOnPage !== false;
    if (comp.headerRows && comp.headerRows.length > 0) {
      parts.push(`  table.header(repeat: ${repeat},\n`);
      for (let y = 0; y < comp.headerRows.length; y++) {
        const row = comp.headerRows[y];
        for (let x = 0; x < row.cells.length; x++) {
          const cell = row.cells[x];
          const val = resolveBinding(cell.content, ctx.local, ctx.global);
          const fmt = cell.format ?? 'text';
          const formattedVal = formatCellValue(val, fmt);
          const cellKey = `header:${x}`;
          const specificKey = `header:${y}:${x}`;
          parts.push(
            renderStructuredCell(
              cell,
              headerTextStyle,
              formattedVal,
              cellKey,
              specificKey,
              style?.cellStyles
            )
          );
        }
      }
      parts.push('  ),\n');
    } else if (comp.showHeader !== false) {
      parts.push(`  table.header(repeat: ${repeat},\n`);
      const covered = new Set<number>();
      for (let x = 0; x < cols.length; x++) {
        if (covered.has(x)) continue;
        const col = cols[x];
        const cs = col.colspan ?? 1;
        const rs = col.rowspan ?? 1;
        const headerText = escapeTypst(col.header);

        // Build a virtual cell object from TableColumn to pass to renderStructuredCell
        const virtualCell = {
          colspan: cs,
          rowspan: rs,
          fill: col.background || style?.headerBackground || '#f1f5f9',
          align: col.align || 'center',
          style: col.style,
        };

        const cellKey = `header:${x}`;
        parts.push(
          renderStructuredCell(
            virtualCell,
            headerTextStyle,
            headerText,
            cellKey,
            undefined,
            style?.cellStyles
          )
        );
        for (let i = 1; i < cs; i++) covered.add(x + i);
      }
      parts.push('  ),\n');
    }

    // ── Data rows ─────────────────────────────────────────────────────────────
    // Calculate total rows for stroke function and hlines
    let totalRows = headerRowCount + (comp.footerRows?.length ?? 0);
    if (comp.groupBy && !isStatic) {
      const groups: Record<string, any[]> = {};
      for (const item of dataItems) {
        const key = String(resolvePath(comp.groupBy, item) || 'Other');
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
      totalRows += dataItems.length * detailRowCount + Object.keys(groups).length; // (items * detailRowCount) + group headers
      if (comp.autoGroupFooter) totalRows += Object.keys(groups).length; // + group footers
      if (comp.repeatSummaryOnGroup && comp.summaryRows && comp.summaryRows.length > 0) {
        totalRows += Object.keys(groups).length * comp.summaryRows.length; // + repeated group summaries
      }
    } else {
      totalRows += dataItems.length * detailRowCount;
      totalRows += padCount * detailRowCount;
      totalRows += options.trailingRows?.length ?? 0;
      if (comp.summaryRows && comp.summaryRows.length > 0 && !comp.repeatSummaryOnGroup) {
        totalRows += comp.summaryRows.length; // + table end summaries
      }
    }

    const renderRow = (item: any) => {
      if (comp.detailRows && comp.detailRows.length > 0) {
        for (let y = 0; y < comp.detailRows.length; y++) {
          const row = comp.detailRows[y];
          for (let x = 0; x < row.cells.length; x++) {
            const cell = row.cells[x];
            const val = resolveBinding(cell.content, item as Record<string, unknown>, ctx.global);
            const fmt = cell.format ?? 'text';
            const formattedVal = formatCellValue(val, fmt);
            const cellKey = `data:${x}`;
            const specificKey = `data:${y}:${x}`;
            parts.push(
              renderStructuredCell(
                cell,
                bodyTextStyle,
                formattedVal,
                cellKey,
                specificKey,
                style?.cellStyles
              )
            );
          }
        }
      } else {
        const covered = new Set<number>();
        for (let x = 0; x < cols.length; x++) {
          if (covered.has(x)) continue;
          const col = cols[x];
          const cs = col.colspan ?? 1;
          const rs = col.rowspan ?? 1;
          const rawVal = resolvePath(col.field, item);
          const valStr = rawVal != null ? String(rawVal) : '';
          const fmt = col.format ?? 'text';
          const content = formatCellValue(valStr, fmt);

          // Build a virtual cell from TableColumn
          const virtualCell = {
            colspan: cs,
            rowspan: rs,
            fill: col.background,
            align: col.align,
            style: col.style,
          };

          const cellKey = `data:${x}`;
          parts.push(
            renderStructuredCell(
              virtualCell,
              bodyTextStyle,
              content,
              cellKey,
              undefined,
              style?.cellStyles
            )
          );
          for (let i = 1; i < cs; i++) covered.add(x + i);
        }
      }
    };

    const renderStandaloneRow = (row: TableRow) => {
      for (let x = 0; x < row.cells.length; x++) {
        const cell = row.cells[x];
        const val = resolveBinding(cell.content, ctx.local, ctx.global, dataItems);
        const fmt = cell.format ?? 'text';
        const formattedVal = formatCellValue(val, fmt);
        parts.push(
          renderStructuredCell(
            cell,
            bodyTextStyle,
            formattedVal,
            `data:${x}`,
            undefined,
            style?.cellStyles
          )
        );
      }
    };

    if (comp.groupBy && !isStatic) {
      const groups: Record<string, any[]> = {};
      for (const item of dataItems) {
        const key = String(resolvePath(comp.groupBy, item) || 'Other');
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }

      for (const [groupKey, items] of Object.entries(groups)) {
        const gh = comp.groupHeaderStyle;
        const ghBg = formatColor(gh?.background || '#f1f5f9');
        const ghColor = formatColor(gh?.color || '#000000');
        const ghSize = gh?.fontSize || 10;
        const ghText = resolveBinding(
          comp.groupHeaderFormat || '{{group}}',
          { group: groupKey, ...items[0] },
          ctx.global,
          items // Pass the group items for aggregates like {{SUM(...)}}
        );

        const ghAlign = gh?.align || 'left';
        parts.push(
          `  table.cell(colspan: ${cols.length}, fill: ${ghBg})` +
            `[\n    #set text(size: ${ghSize}pt, fill: ${ghColor}, weight: "bold")\n    #set align(${ghAlign})\n    ${escapeTypst(ghText)}\n  ],\n`
        );

        for (const item of items) renderRow(item);

        // --- Auto Group Footer (Structured Subtotal Row) ---
        if (comp.autoGroupFooter) {
          for (let x = 0; x < cols.length; x++) {
            const col = cols[x];
            let cellContent = '';

            if (col.footerExpr) {
              cellContent = col.footerExpr;
            } else if (x === 0) {
              cellContent = comp.autoGroupFooterLabel || 'Subtotal';
            } else if (col.field) {
              cellContent = `{{SUM(${col.field})}}`;
            }

            if (!cellContent) {
              const gfBg = formatColor(comp.groupFooterStyle?.background || 'white.darken(3%)');
              parts.push(`  table.cell(fill: ${gfBg})[],\n`);
              continue;
            }

            const val = resolveBinding(cellContent, items[0], ctx.global, items);
            const align = col.align || 'left';
            const fmt = col.format || 'text';
            const isSum = cellContent.includes('SUM');
            const displayVal =
              fmt !== 'text' && isSum ? formatCellValue(val, fmt) : escapeTypst(val);

            // Styling overrides for footer
            const gf = comp.groupFooterStyle;
            const cellFill = gf?.background || 'white.darken(3%)';
            const textStyle = {
              size: gf?.fontSize || bodyFontSize,
              color: gf?.color || '#000000',
              weight: gf?.fontWeight || 'bold',
              fontFamily: tableFontFamily,
            };

            const virtualCell = {
              fill: cellFill,
              align: align,
              style: gf,
            };

            const cellKey = `footer:${x}`;
            parts.push(
              renderStructuredCell(
                virtualCell,
                textStyle,
                displayVal,
                cellKey,
                undefined,
                style?.cellStyles
              )
            );
          }
        }

        // --- Group Summary Notes (Legacy) ---
        if (comp.repeatSummaryOnGroup && comp.summaryRows && comp.summaryRows.length > 0) {
          renderSummaryRows(comp.summaryRows, items);
        }
      }
    } else {
      for (const item of dataItems) renderRow(item);
      for (let i = 0; i < padCount; i++) renderRow({});
      for (const row of options.trailingRows ?? []) renderStandaloneRow(row);
    }

    // ── Summary rows (Legacy / Table End) ────
    function renderSummaryRows(rows: any[], groupItems?: any[]) {
      const span = cols.length > 1 ? cols.length - 1 : 1;
      for (const row of rows) {
        if (row.separator) parts.push('  table.hline(stroke: 1pt + black),\n');
        // If we have groupItems, use them for aggregates, otherwise use global context
        const val = resolveBinding(
          row.value,
          ctx.local,
          ctx.global,
          groupItems || dataItems // Use group specific items if available
        );
        const weight = row.style?.fontWeight === 'bold' ? 'bold' : 'regular';
        parts.push(
          `  table.cell(colspan: ${span}, align: right)[*${escapeTypst(row.label)}*],\n` +
            `  [\n    #set text(weight: "${weight}")\n    ${escapeTypst(val)}\n  ],\n`
        );
      }
    }

    if (comp.summaryRows && comp.summaryRows.length > 0 && !comp.repeatSummaryOnGroup) {
      renderSummaryRows(comp.summaryRows);
    }

    // ── Footer rows ───────────────────────────────────────────────────────────
    if (comp.footerRows && comp.footerRows.length > 0) {
      const repeatFooter = comp.footerRows[0].repeat !== false;
      parts.push(`  table.footer(repeat: ${repeatFooter},\n`);
      for (let y = 0; y < comp.footerRows.length; y++) {
        const row = comp.footerRows[y];
        for (let x = 0; x < row.cells.length; x++) {
          const cell = row.cells[x];
          const val = resolveBinding(cell.content, ctx.local, ctx.global, dataItems);
          const fmt = cell.format ?? 'text';
          const formattedVal = formatCellValue(val, fmt);
          const cellKey = `footer:${x}`;
          const specificKey = `footer:${y}:${x}`;
          parts.push(
            renderStructuredCell(
              cell,
              { ...bodyTextStyle, weight: 'bold' },
              formattedVal,
              cellKey,
              specificKey,
              style?.cellStyles
            )
          );
        }
      }
      parts.push('  ),\n');
    }

    // ── Outermost Bottom/Right Borders ────────────────────────────────────────
    if (style?.borderSides?.bottom !== false) {
      parts.push(
        `  table.hline(y: ${totalRows}, stroke: (paint: ${borderColor}, thickness: ${borderWidth})),\n`
      );
    }
    if (style?.borderSides?.right !== false) {
      parts.push(
        `  table.vline(x: ${cols.length}, stroke: (paint: ${borderColor}, thickness: ${borderWidth})),\n`
      );
    }

    // ── hlines / vlines (Manual overrides) ────────────────────────────────────
    if (comp.hlines) {
      for (const hl of comp.hlines) {
        const args = [`y: ${hl.y}`];
        if (hl.start && hl.start > 0) args.push(`start: ${hl.start}`);
        if (hl.end) args.push(`end: ${hl.end}`);

        let s = hl.stroke ? formatColor(hl.stroke) : `${borderWidth} + ${borderColor}`;
        if (hl.dash && hl.dash !== 'solid') {
          s = `(paint: ${hl.stroke ? formatColor(hl.stroke) : borderColor}, thickness: ${borderWidth}, dash: "${hl.dash}")`;
        }
        args.push(`stroke: ${s}`);
        if (hl.position) args.push(`position: ${hl.position}`);
        parts.push(`  table.hline(${args.join(', ')}),\n`);
      }
    }
    if (comp.vlines) {
      for (const vl of comp.vlines) {
        const args = [`x: ${vl.x}`];
        if (vl.start && vl.start > 0) args.push(`start: ${vl.start}`);
        if (vl.end) args.push(`end: ${vl.end}`);
        let s = vl.stroke ? formatColor(vl.stroke) : `${borderWidth} + ${borderColor}`;
        if (vl.dash && vl.dash !== 'solid') {
          s = `(paint: ${vl.stroke ? formatColor(vl.stroke) : borderColor}, thickness: ${borderWidth}, dash: "${vl.dash}")`;
        }
        args.push(`stroke: ${s}`);
        if (vl.position) args.push(`position: ${vl.position}`);
        parts.push(`  table.vline(${args.join(', ')}),\n`);
      }
    }

    parts.push(')\n');
    return wrapPlacement(
      comp,
      parts.join(''),
      ctx.offsetX,
      ctx.offsetY,
      ctx.flowMode,
      ctx.fillWidth,
      ctx.pretty
    );
}

export const tablePlugin: ComponentPlugin<TableComponent> = {
  type: 'table',
  render(comp, ctx) {
    return renderTableComponent(comp, ctx);
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function formatCellValue(value: string, format: FormatType): string {
  if (format === 'text' || /\{\{.+?\}\}/.test(value)) return escapeTypst(value);
  return `#fmt_${format.replace(/-/g, '_')}("${escapeStringLiteral(value)}")`;
}

/** Typst requires lengths to include a unit — bare "0" or "1" is invalid. */
function normalizeLength(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '0') return '0pt';
  if (/^\d+$/.test(trimmed)) return `${trimmed}pt`;
  return trimmed;
}

function buildFillFn(
  pattern: string,
  headerRows: number,
  headerBg: string,
  color1: string,
  color2: string
): string | null {
  if (pattern === 'none') return null;
  const h = headerRows;
  switch (pattern) {
    case 'striped-rows':
      return `(x, y) => if y < ${h} { ${headerBg} } else if calc.even(y) { ${color1} } else { ${color2} }`;
    case 'striped-cols':
      return `(x, y) => if y < ${h} { ${headerBg} } else if calc.even(x) { ${color1} } else { ${color2} }`;
    case 'checkerboard':
      return `(x, y) => if y < ${h} { ${headerBg} } else if calc.even(x + y) { ${color1} } else { ${color2} }`;
    default: // 'header-only'
      return `(x, y) => if y < ${h} { ${headerBg} } else { none }`;
  }
}

function renderStructuredCell(
  cell: any,
  textStyle: {
    size: number;
    color: string;
    weight: string | number;
    fontFamily?: string;
    align?: 'left' | 'center' | 'right' | 'justify';
  },
  contentOverride?: string,
  cellKey?: string,
  specificKey?: string,
  cellStyles?: Record<string, any>
): string {
  const cs = cell.colspan ?? 1;
  const rs = cell.rowspan ?? 1;

  let cellStyle = cell.style;
  let cellFill = cell.fill;
  let cellAlign = cell.align;
  const cellVAlign = cell.verticalAlign;
  const cellDir = cell.textDirection;
  const cellInset = cell.inset;

  // Apply cellStyles overrides if available
  if (cellStyles) {
    const override = (specificKey && cellStyles[specificKey]) || (cellKey && cellStyles[cellKey]);
    if (override) {
      if (override.size !== undefined) {
        cellStyle = { ...cellStyle, fontSize: override.size };
      }
      if (override.weight !== undefined) {
        cellStyle = { ...cellStyle, fontWeight: override.weight };
      }
      if (override.color !== undefined) {
        cellStyle = { ...cellStyle, color: override.color };
      }
      if (override.fill !== undefined) {
        cellFill = override.fill;
      }
      if (override.align !== undefined) {
        cellAlign = override.align;
      }
    }
  }

  const args: string[] = [];
  if (cs > 1) args.push(`colspan: ${cs}`);
  if (rs > 1) args.push(`rowspan: ${rs}`);
  if (cellFill) args.push(`fill: ${formatColor(cellFill)}`);
  const stroke = formatCellStroke(cell.stroke);
  if (stroke) args.push(`stroke: ${stroke}`);

  // Combine horizontal and vertical alignment
  const rawHAlign = cellAlign || textStyle.align || 'left';
  const isJustify = rawHAlign === 'justify';
  const hAlign = isJustify ? 'left' : rawHAlign;
  const vAlign = cellVAlign || 'horizon';
  const vAlignTypst = vAlign === 'top' ? 'top' : vAlign === 'bottom' ? 'bottom' : 'horizon';
  args.push(`align: ${hAlign} + ${vAlignTypst}`);

  if (cellInset) args.push(`inset: ${cellInset}`);

  const color = formatColor(cellStyle?.color || textStyle.color);
  const size = cellStyle?.fontSize || textStyle.size;
  const weight = formatWeight(cellStyle?.fontWeight ?? textStyle.weight);
  const fontFamily = cellStyle?.fontFamily ?? textStyle.fontFamily ?? 'Sarabun';
  const leading = cellStyle?.lineHeight ? cellStyle.lineHeight - 0.65 : 0.75;

  let inner = contentOverride !== undefined ? contentOverride : escapeTypst(cell.content);
  if (inner.startsWith('[') && inner.endsWith(']')) {
    inner = inner.slice(1, -1);
  }

  const underline = cellStyle?.underline ?? false;
  const strikethrough = cellStyle?.strikethrough ?? false;
  const smallcaps = cellStyle?.smallcaps ?? false;
  const italic = cellStyle?.italic ?? false;

  if (underline) {
    inner = `#underline[${inner}]`;
  }
  if (strikethrough) {
    inner = `#strike[${inner}]`;
  }
  if (smallcaps) {
    inner = `#smallcaps[${inner}]`;
  }
  if (italic) {
    inner = `#skew(ax: -12deg)[${inner}]`;
  }

  // Handle vertical text direction
  if (cellDir === 'vertical') {
    inner = `#rotate(-90deg, reflow: true)[${inner}]`;
  }

  const justify = isJustify || (cellStyle?.justify ?? false);
  const wrapped = `[\n    #set par(leading: ${leading}em, justify: ${justify})\n    #set text(size: ${size}pt, fill: ${color}, weight: ${weight}, font: ${formatTypstFontStack(fontFamily)})\n    ${inner}\n  ]`;

  if (args.length === 0) return `    ${wrapped},\n`;
  return `    table.cell(${args.join(', ')})${wrapped},\n`;
}

function formatCellStroke(stroke?: StrokeConfig): string | null {
  if (!stroke) return null;
  const entries: string[] = [];
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const value = stroke[side];
    if (value !== undefined) entries.push(`${side}: ${formatStrokeSide(value)}`);
  }
  if (entries.length === 0) return null;
  return `(${entries.join(', ')})`;
}

function formatStrokeSide(value: string): string {
  const trimmed = value.trim();
  return trimmed === 'none' ? 'none' : trimmed;
}

import { escapeTypst } from '@/lib/utils/typst-utils';
import type { TableComponent } from '@/types/schema';
import { isVisible, resolveBinding, resolvePath } from '../binding';
import { escapeStringLiteral, formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const tablePlugin: ComponentPlugin<TableComponent> = {
  type: 'table',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const cols = comp.columns;
    const style = comp.style;
    const parts: string[] = [];

    // ── Column widths ─────────────────────────────────────────────────────────
    const colWidths = cols.map((c) => c.width.replace('*', 'fr')).join(', ');

    // ── Stroke ────────────────────────────────────────────────────────────────
    const borderWidth = style?.borderWidth ?? '0.5pt';
    const borderColor = formatColor(style?.borderColor ?? '#cbd5e1');
    let strokeStr = `${borderWidth} + ${borderColor}`;
    if (style?.stroke) {
      const sv = style.stroke as Record<string, string>;
      const sides = (['top', 'bottom', 'left', 'right'] as const)
        .filter((k) => sv[k])
        .map((k) => `${k}: ${formatColor(sv[k])}`)
        .join(', ');
      if (sides) strokeStr = `(${sides})`;
    }

    // ── Fill pattern ─────────────────────────────────────────────────────────
    const fillPattern = style?.fillPattern ?? 'header-only';
    const headerBg = formatColor(style?.headerBackground ?? '#f1f5f9');
    const color1 = formatColor(style?.stripedColor1 ?? style?.alternateRowBackground ?? '#ffffff');
    const color2 = formatColor(style?.stripedColor2 ?? '#f8fafc');
    const headerRowCount = comp.headerRows?.length ?? (comp.showHeader !== false ? 1 : 0);

    const fillFn = buildFillFn(fillPattern, headerRowCount, headerBg, color1, color2);

    // ── Text Defaults ──────────────────────────────────────────────────────────
    const headerFontSize = style?.headerFontSize ?? 10;
    const headerColor = formatColor(style?.headerColor ?? '#000000');
    const headerWeight = style?.headerFontWeight ?? 'bold';
    const bodyFontSize = style?.bodyFontSize ?? 10;
    const bodyColor = formatColor(style?.bodyColor ?? '#334155');

    // ── Table args ────────────────────────────────────────────────────────────
    const inset = style?.inset ?? style?.cellPadding ?? '7pt';
    const tableArgs = [`columns: (${colWidths})`, `inset: ${inset}`, `stroke: ${strokeStr}`];
    if (fillFn) tableArgs.push(`fill: ${fillFn}`);

    parts.push(`#table(\n  ${tableArgs.join(',\n  ')},\n`);

    // ── Header ────────────────────────────────────────────────────────────────
    const repeat = comp.repeatHeaderOnPage !== false;
    if (comp.headerRows && comp.headerRows.length > 0) {
      parts.push(`  table.header(repeat: ${repeat},\n`);
      for (const row of comp.headerRows) {
        for (const cell of row.cells) {
          parts.push(
            renderStructuredCell(cell, {
              size: headerFontSize,
              color: headerColor,
              weight: headerWeight,
            })
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
        const align = col.align ?? 'center';
        const header = escapeTypst(col.header);

        const content = `[\n      #set text(size: ${headerFontSize}pt, fill: ${headerColor}, weight: "${headerWeight}")\n      #set align(${align})\n      ${header}\n    ]`;

        if (cs === 1 && rs === 1) {
          parts.push(`    ${content},\n`);
        } else {
          parts.push(
            `    table.cell(x: ${x}, y: 0, colspan: ${cs}, rowspan: ${rs})${content},\n`
          );
        }
        for (let i = 1; i < cs; i++) covered.add(x + i);
      }
      parts.push('  ),\n');
    }

    // ── Data rows ─────────────────────────────────────────────────────────────
    const isStatic = comp.isStatic ?? false;
    const dataItems = isStatic
      ? [ctx.local]
      : (() => {
          const path = comp.dataSource.replace(/\{\{|\}\}/g, '').trim();
          const raw = resolvePath(path, ctx.local) ?? resolvePath(path, ctx.global);
          return Array.isArray(raw) ? raw : [];
        })();

    const renderRow = (item: any) => {
      if (comp.detailRows && comp.detailRows.length > 0) {
        for (const row of comp.detailRows) {
          for (const cell of row.cells) {
            const val = resolveBinding(cell.content, item as Record<string, unknown>, ctx.global);
            const content = `[${escapeTypst(val)}]`;
            parts.push(
              renderStructuredCell(cell, { size: bodyFontSize, color: bodyColor, weight: 'regular' }, content)
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
          const content =
            fmt !== 'text'
              ? `[#fmt_${fmt.replace(/-/g, '_')}("${escapeStringLiteral(valStr)}")]`
              : `[${escapeTypst(valStr)}]`;
          const align = col.align ?? 'left';
          const bg = col.background ? formatColor(col.background) : null;

          const cellText = `[\n    #set text(size: ${bodyFontSize}pt, fill: ${bodyColor})\n    #set align(${align})\n    ${content.slice(1, -1)}\n  ]`;

          if (cs === 1 && rs === 1 && !bg) {
            parts.push(`  ${cellText},\n`);
          } else {
            const args: string[] = [`x: ${x}`];
            if (cs > 1) args.push(`colspan: ${cs}`);
            if (rs > 1) args.push(`rowspan: ${rs}`);
            if (bg) args.push(`fill: ${bg}`);
            parts.push(`  table.cell(${args.join(', ')})${cellText},\n`);
          }
          for (let i = 1; i < cs; i++) covered.add(x + i);
        }
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

        // --- Auto Group Footer (New: Auto-aligned subtotal row) ---
        if (comp.autoGroupFooter) {
          for (let x = 0; x < cols.length; x++) {
            const col = cols[x];
            let cellContent = '';
            
            if (x === 0) {
              cellContent = 'Subtotal';
            } else if (col.field) {
              cellContent = `{{SUM(${col.field})}}`;
            }

            const val = resolveBinding(cellContent, items[0], ctx.global, items);
            const align = col.align || 'left';
            const fmt = col.format || 'text';
            const isSum = cellContent.includes('SUM');
            const displayVal = (fmt !== 'text' && isSum) 
              ? `#fmt_${fmt.replace(/-/g, '_')}("${val}")`
              : escapeTypst(val);

            // Render subtotal cell with a distinct style (bold and subtle fill)
            parts.push(
              `  table.cell(fill: white.darken(3%))[\n    #set text(size: ${bodyFontSize}pt, weight: "bold")\n    #set align(${align})\n    ${displayVal}\n  ],\n`
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
      for (const row of comp.footerRows) {
        for (const cell of row.cells) {
          const val = resolveBinding(cell.content, ctx.local, ctx.global);
          const content = escapeTypst(val);
          parts.push(renderStructuredCell(cell, { size: bodyFontSize, color: bodyColor, weight: 'bold' }, `[*${content}*]`));
        }
      }
      parts.push('  ),\n');
    }

    // ── hlines / vlines ───────────────────────────────────────────────────────
    if (comp.hlines) {
      for (const hl of comp.hlines) {
        const args = [`y: ${hl.y}`];
        if (hl.start && hl.start > 0) args.push(`start: ${hl.start}`);
        if (hl.end) args.push(`end: ${hl.end}`);
        if (hl.stroke) args.push(`stroke: ${formatColor(hl.stroke)}`);
        if (hl.position) args.push(`position: ${hl.position}`);
        parts.push(`  table.hline(${args.join(', ')}),\n`);
      }
    }
    if (comp.vlines) {
      for (const vl of comp.vlines) {
        const args = [`x: ${vl.x}`];
        if (vl.start && vl.start > 0) args.push(`start: ${vl.start}`);
        if (vl.end) args.push(`end: ${vl.end}`);
        if (vl.stroke) args.push(`stroke: ${formatColor(vl.stroke)}`);
        if (vl.position) args.push(`position: ${vl.position}`);
        parts.push(`  table.vline(${args.join(', ')}),\n`);
      }
    }

    parts.push(')\n');
    return wrapPlacement(comp, parts.join(''), ctx.offsetX, ctx.offsetY, ctx.flowMode);
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  textStyle: { size: number; color: string; weight: string },
  contentOverride?: string
): string {
  const cs = cell.colspan ?? 1;
  const rs = cell.rowspan ?? 1;
  const args: string[] = [];
  if (cs > 1) args.push(`colspan: ${cs}`);
  if (rs > 1) args.push(`rowspan: ${rs}`);
  if (cell.fill) args.push(`fill: ${formatColor(cell.fill)}`);
  if (cell.align) args.push(`align: ${cell.align}`);
  if (cell.inset) args.push(`inset: ${cell.inset}`);

  const color = formatColor(cell.style?.color || textStyle.color);
  const size = cell.style?.fontSize || textStyle.size;
  const weight = cell.style?.fontWeight || textStyle.weight;
  const leading = cell.style?.lineHeight ? cell.style.lineHeight - 1 : 0.2;

  const inner = contentOverride ? contentOverride.slice(1, -1) : escapeTypst(cell.content);
  const wrapped = `[\n    #set par(leading: ${leading}em)\n    #set text(size: ${size}pt, fill: ${color}, weight: "${weight}")\n    ${inner}\n  ]`;

  if (args.length === 0) return `    ${wrapped},\n`;
  return `    table.cell(${args.join(', ')})${wrapped},\n`;
}

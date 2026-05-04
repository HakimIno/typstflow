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
    const headerBg = formatColor(style?.headerBackground ?? '#e2e8f0');
    const color1 = formatColor(style?.stripedColor1 ?? style?.alternateRowBackground ?? '#f8fafc');
    const color2 = formatColor(style?.stripedColor2 ?? '#ffffff');
    const headerRowCount = comp.headerRows?.length ?? (comp.showHeader !== false ? 1 : 0);

    const fillFn = buildFillFn(fillPattern, headerRowCount, headerBg, color1, color2);

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
          parts.push(renderStructuredCell(cell, true));
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
        if (cs === 1 && rs === 1) {
          parts.push(`    [#set align(${align}); *${header}*],\n`);
        } else {
          parts.push(
            `    table.cell(x: ${x}, y: 0, colspan: ${cs}, rowspan: ${rs})` +
              `[#set align(${align}); *${header}*],\n`
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

    for (const item of dataItems) {
      if (comp.detailRows && comp.detailRows.length > 0) {
        for (const row of comp.detailRows) {
          for (const cell of row.cells) {
            const val = resolveBinding(cell.content, item as Record<string, unknown>, ctx.global);
            const content = `[${escapeTypst(val)}]`;
            parts.push(renderStructuredCell(cell, false, content));
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

          if (cs === 1 && rs === 1 && !bg) {
            parts.push(`  [#set align(${align}); ${content.slice(1, -1)}],\n`);
          } else {
            const args: string[] = [`x: ${x}`];
            if (cs > 1) args.push(`colspan: ${cs}`);
            if (rs > 1) args.push(`rowspan: ${rs}`);
            if (bg) args.push(`fill: ${bg}`);
            parts.push(
              `  table.cell(${args.join(', ')})[#set align(${align}); ${content.slice(1, -1)}],\n`
            );
          }
          for (let i = 1; i < cs; i++) covered.add(x + i);
        }
      }
    }

    // ── Footer rows ───────────────────────────────────────────────────────────
    if (comp.footerRows && comp.footerRows.length > 0) {
      const repeatFooter = comp.footerRows[0].repeat !== false;
      parts.push(`  table.footer(repeat: ${repeatFooter},\n`);
      for (const row of comp.footerRows) {
        for (const cell of row.cells) {
          const val = resolveBinding(cell.content, ctx.local, ctx.global);
          const content = escapeTypst(val);
          parts.push(renderStructuredCell(cell, true, `[${content}]`));
        }
      }
      parts.push('  ),\n');
    }

    // ── Summary rows (legacy) ─────────────────────────────────────────────────
    if (comp.summaryRows && comp.summaryRows.length > 0) {
      const span = cols.length > 1 ? cols.length - 1 : 1;
      for (const row of comp.summaryRows) {
        if (row.separator) parts.push('  table.hline(stroke: 1pt + black),\n');
        const val = resolveBinding(row.value, ctx.local, ctx.global);
        const weight = row.style?.fontWeight === 'bold' ? 'bold' : 'regular';
        parts.push(
          `  table.cell(colspan: ${span}, align: right)[*${escapeTypst(row.label)}*],\n` +
            `  [#text(weight: "${weight}")[${escapeTypst(val)}]],\n`
        );
      }
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
    return wrapPlacement(comp, parts.join(''), ctx.offsetX, ctx.offsetY);
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
  cell: { colspan?: number; rowspan?: number; fill?: string; align?: string; inset?: string },
  bold: boolean,
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

  const content = contentOverride ?? '[(cell)]';
  const wrapped = bold ? content.replace(/^\[/, '[*').replace(/\]$/, '*]') : content;

  if (args.length === 0) return `    ${wrapped},\n`;
  return `    table.cell(${args.join(', ')})${wrapped},\n`;
}

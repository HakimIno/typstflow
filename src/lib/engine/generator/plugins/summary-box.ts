import { escapeTypst } from '@/lib/utils/typst-utils';
import type { SummaryBoxComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const summaryBoxPlugin: ComponentPlugin<SummaryBoxComponent> = {
  type: 'summary-box',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const rowsParts: string[] = [];
    for (const row of comp.rows) {
      if (row.separator) {
        rowsParts.push('    table.hline(stroke: 0.5pt + gray.lighten(50%)),');
      }
      const val = resolveBinding(row.value, ctx.local, ctx.global, ctx.groupItems);
      const isTotal = row.style === 'total';
      const isHighlight = row.style === 'highlight';
      const fill = isHighlight ? ' fill: yellow.lighten(80%),' : '';
      const label = isTotal ? `*${escapeTypst(row.label)}*` : escapeTypst(row.label);
      const value = isTotal ? `*${escapeTypst(val)}*` : escapeTypst(val);
      rowsParts.push(
        `    grid.cell(${fill})[${label}], grid.cell(${fill} align: right)[${value}],`
      );
    }

    const body = `#rect(width: 100%, inset: 10pt, fill: white, stroke: 0.5pt + gray.lighten(50%))[\n  #grid(columns: (1fr, 1fr), gutter: 8pt,\n${rowsParts.join('\n')}\n  )\n]`;

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth, ctx.pretty);
  },
};

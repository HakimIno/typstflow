import { escapeTypst } from '@/lib/utils/typst-utils';
import type { FillInComponent, FillInSegment } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { formatColor, formatFontFamily, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

function blankLine(comp: FillInComponent, lineColor: string): string {
  const style = comp.lineStyle ?? 'dotted';
  if (style === 'dotted') {
    // repeat[.] fills the box width with dots — matches hand-drawn Thai form blanks.
    return `#box(width: 100%, baseline: 0pt)[#repeat[.]]`;
  }
  const dash = style === 'dashed' ? ', dash: "dashed"' : '';
  const thickness = comp.lineWidth ?? '0.5pt';
  return `#box(width: 100%, baseline: 0pt)[#line(length: 100%, stroke: (paint: ${lineColor}, thickness: ${thickness}${dash}))]`;
}

function markerBox(comp: FillInComponent): string {
  const marker = comp.marker ?? 'none';
  if (marker === 'none') return '';
  const size = comp.markerSize ?? 8;
  const mark = comp.checked
    ? `[#align(center + horizon)[#text(size: ${Math.max(4, size - 2)}pt)[✓]]]`
    : '[]';
  if (marker === 'circle') {
    return `#box(baseline: 15%)[#circle(radius: ${size / 2}pt, stroke: 0.6pt + black)${mark}]`;
  }
  return `#box(baseline: 15%, width: ${size}pt, height: ${size}pt, stroke: 0.6pt + black, radius: 1pt)${mark}`;
}

export const fillInPlugin: ComponentPlugin<FillInComponent> = {
  type: 'fill-in',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const segments = comp.segments ?? [];
    if (segments.length === 0) return '';

    const lineColor = formatColor(comp.lineColor ?? '#111111');
    const size = comp.style?.fontSize ?? 9;
    const weight = formatWeight(comp.style?.fontWeight, 'regular');
    const color = formatColor(comp.style?.color ?? '#111111');
    const font = formatFontFamily(comp.style?.fontFamily ?? 'Sarabun');
    const gap = comp.gap ?? '1mm';

    const textOf = (seg: FillInSegment) =>
      escapeTypst(resolveBinding(seg.text ?? '', ctx.local, ctx.global, ctx.groupItems));

    const columns: string[] = [];
    const cells: string[] = [];

    const marker = markerBox(comp);
    if (marker) {
      columns.push('auto');
      cells.push(`[${marker}]`);
    }

    for (const seg of segments) {
      if (seg.kind === 'blank') {
        columns.push(seg.width ?? '1fr');
        const value = textOf(seg);
        if (value) {
          // Filled value sits on top of the blank line, like a completed form.
          cells.push(
            `[#stack(dir: ttb, spacing: 1pt, align(${seg.align ?? 'center'})[${value}], ${blankLine(comp, lineColor)})]`
          );
        } else {
          cells.push(`[${blankLine(comp, lineColor)}]`);
        }
      } else {
        columns.push('auto');
        cells.push(`[${textOf(seg)}]`);
      }
    }

    const body =
      `#text(size: ${size}pt, weight: ${weight}, fill: ${color}, font: ("${font}", "Sarabun", "sans-serif"))[` +
      `#grid(columns: (${columns.join(', ')}), column-gutter: ${gap}, align: bottom, ${cells.join(', ')})` +
      `]`;

    return wrapPlacement(
      comp,
      body,
      ctx.offsetX,
      ctx.offsetY,
      ctx.flowMode,
      ctx.fillWidth,
      ctx.pretty
    );
  },
};

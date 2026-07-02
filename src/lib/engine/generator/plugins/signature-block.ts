import { escapeTypst } from '@/lib/utils/typst-utils';
import type { SignatureBlockComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { formatColor, formatFontFamily, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

function lineStroke(
  lineStyle: 'solid' | 'dotted' | 'dashed' | undefined,
  lineColor: string,
  lineWidth?: string
): string {
  const widthPart = lineWidth ? `, thickness: ${lineWidth}` : '';
  const dashPart =
    lineStyle === 'dashed' ? ', dash: "dashed"' : lineStyle === 'dotted' ? ', dash: "dotted"' : '';
  return `(paint: ${lineColor}${widthPart}${dashPart})`;
}

export const signatureBlockPlugin: ComponentPlugin<SignatureBlockComponent> = {
  type: 'signature-block',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const slots = comp.slots ?? [];
    if (slots.length === 0) return '';

    const variant = comp.variant ?? 'thai-form';
    const lineColor = formatColor(comp.lineColor ?? '#334155');
    const labelSize = comp.labelStyle?.fontSize ?? 8;
    const labelWeight = formatWeight(comp.labelStyle?.fontWeight, 'regular');
    const labelColor = formatColor(comp.labelStyle?.color ?? '#334155');
    const labelFont = formatFontFamily(comp.labelStyle?.fontFamily ?? 'Sarabun');
    const showDate = comp.showDate !== false;
    const datePosition = comp.datePosition ?? 'above';

    const slotBlocks = slots.map((slot) => {
      const role = escapeTypst(
        resolveBinding(slot.role, ctx.local, ctx.global, ctx.groupItems)
      );
      const name = slot.name
        ? escapeTypst(resolveBinding(slot.name, ctx.local, ctx.global, ctx.groupItems))
        : '(......................)';
      const dateText = slot.date
        ? escapeTypst(resolveBinding(slot.date, ctx.local, ctx.global, ctx.groupItems))
        : 'วันที่ ___/___/______';

      const stroke = lineStroke(slot.lineStyle ?? 'dotted', lineColor, comp.lineWidth);
      const lines: string[] = [];

      if (showDate && datePosition === 'above') {
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${dateText}]`
        );
        lines.push('#v(2mm)');
      }

      if (variant === 'thai-form') {
        lines.push(`#line(length: 100%, stroke: ${stroke})`);
        lines.push('#v(1mm)');
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${name}]`
        );
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${role}]`
        );
      } else {
        lines.push(`#line(length: 100%, stroke: ${stroke})`);
        lines.push('#v(1mm)');
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${role}]`
        );
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${name}]`
        );
      }

      if (showDate && datePosition === 'right') {
        lines.unshift(
          `#grid(columns: (1fr, auto), gutter: 2mm, [], [#text(size: ${labelSize - 1}pt, fill: ${labelColor})[${dateText}]])`
        );
      }

      return `[${lines.join('\n')}]`;
    });

    const cols = slots.map(() => '1fr').join(', ');
    const gutter = comp.slotSpacing ?? '5mm';
    const body = `#grid(columns: (${cols}), gutter: ${gutter}, ${slotBlocks.join(', ')})`;

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

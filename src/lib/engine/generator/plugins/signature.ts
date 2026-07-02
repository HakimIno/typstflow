import type { SignatureComponent } from '@/types/schema';
import { escapeTypst } from '@/lib/utils/typst-utils';
import { isVisible, resolveBinding } from '../binding';
import { formatColor, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const signaturePlugin: ComponentPlugin<SignatureComponent> = {
  type: 'signature',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const slots = comp.slots ?? [];
    if (slots.length === 0) return '';

    const lineColor = formatColor(comp.lineColor ?? '#000000');
    const lineWidthPart = comp.lineWidth ? `, thickness: ${comp.lineWidth}` : '';
    const dashPart =
      comp.lineStyle === 'dashed'
        ? ', dash: "dashed"'
        : comp.lineStyle === 'dotted'
          ? ', dash: "dotted"'
          : '';
    const lineStroke =
      lineWidthPart || dashPart ? `(paint: ${lineColor}${lineWidthPart}${dashPart})` : lineColor;

    const labelSize = comp.labelStyle?.fontSize ?? 8;
    const labelWeight = formatWeight(comp.labelStyle?.fontWeight, 'regular');
    const labelColor = formatColor(comp.labelStyle?.color ?? '#000000');
    const labelFont = comp.labelStyle?.fontFamily ? `font: "${comp.labelStyle.fontFamily}", ` : '';

    const slotBlocks = slots.map((slot) => {
      const showName = slot.showNameLine ?? comp.showNameLine ?? true;
      const showDate = slot.showDateLine ?? comp.showDateLine ?? true;

      const roleLabel = escapeTypst(
        resolveBinding(slot.label, ctx.local, ctx.global, ctx.groupItems)
      );
      const nameLabel = escapeTypst(
        resolveBinding(slot.nameLabel ?? '', ctx.local, ctx.global, ctx.groupItems)
      );
      const dateLabel = escapeTypst(
        resolveBinding(slot.dateLabel ?? 'วันที่', ctx.local, ctx.global, ctx.groupItems)
      );

      const lines: string[] = [];
      if (showDate) {
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${dateLabel}]`
        );
        lines.push(`#v(8mm)`);
      } else {
        lines.push(`#v(4mm)`);
      }
      lines.push(`#line(length: 100%, stroke: ${lineStroke})`);
      lines.push(`#v(1mm)`);
      lines.push(
        `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${roleLabel}]`
      );
      if (showName && nameLabel) {
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${nameLabel}]`
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

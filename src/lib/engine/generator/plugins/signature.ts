import type { SignatureComponent } from '@/types/schema';
import { isVisible } from '../binding';
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
      lineWidthPart || dashPart
        ? `(paint: ${lineColor}${lineWidthPart}${dashPart})`
        : lineColor;

    const labelSize = comp.labelStyle?.fontSize ?? 8;
    const labelWeight = formatWeight(comp.labelStyle?.fontWeight, 'regular');
    const labelColor = formatColor(comp.labelStyle?.color ?? '#000000');
    const labelFont = comp.labelStyle?.fontFamily
      ? `font: "${comp.labelStyle.fontFamily}", `
      : '';

    const slotBlocks = slots.map((slot) => {
      // Per-slot visibility falls back to component-level defaults
      const showName = slot.showNameLine ?? comp.showNameLine ?? true;
      const showDate = slot.showDateLine ?? comp.showDateLine ?? true;

      const lines: string[] = [];
      lines.push(`#v(12mm)`);
      lines.push(`#line(length: 100%, stroke: ${lineStroke})`);
      lines.push(`#v(1mm)`);
      lines.push(
        `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${slot.label}]`
      );
      if (showName) {
        const nameLbl = slot.nameLabel ?? '(......................)';
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${nameLbl}]`
        );
      }
      if (showDate) {
        const dateLbl = slot.dateLabel ?? 'Date: ___/___/______';
        lines.push(`#v(1mm)`);
        lines.push(
          `#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, ${labelFont})[${dateLbl}]`
        );
      }
      return `[${lines.join('\n')}]`;
    });

    const cols = slots.map(() => '1fr').join(', ');
    const gutter = comp.slotSpacing ?? '5mm';
    const body = `#grid(columns: (${cols}), gutter: ${gutter}, ${slotBlocks.join(', ')})`;
    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth, ctx.pretty);
  },
};

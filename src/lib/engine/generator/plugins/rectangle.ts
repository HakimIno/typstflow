import type { RectangleComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const rectanglePlugin: ComponentPlugin<RectangleComponent> = {
  type: 'rectangle',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const fill = comp.fill ? formatColor(comp.fill) : 'none';

    // Radius — per-corner overrides uniform
    const hasPerCorner =
      comp.radiusTopLeft || comp.radiusTopRight || comp.radiusBottomLeft || comp.radiusBottomRight;
    let radiusPart = '';
    if (hasPerCorner) {
      const fallback = comp.radius ?? '0pt';
      radiusPart = `, radius: (top-left: ${comp.radiusTopLeft ?? fallback}, top-right: ${comp.radiusTopRight ?? fallback}, bottom-left: ${comp.radiusBottomLeft ?? fallback}, bottom-right: ${comp.radiusBottomRight ?? fallback})`;
    } else if (comp.radius) {
      radiusPart = `, radius: ${comp.radius}`;
    }

    // Stroke
    let stroke = 'none';
    if (comp.strokeColor || comp.strokeWidth) {
      const color = formatColor(comp.strokeColor ?? '#000000');
      const thickness = comp.strokeWidth ?? '1pt';
      const style = comp.strokeStyle ?? 'solid';
      const dashPart =
        style === 'dashed' ? ', dash: "dashed"' : style === 'dotted' ? ', dash: "dotted"' : '';
      const capPart =
        comp.strokeCap && comp.strokeCap !== 'butt' ? `, cap: "${comp.strokeCap}"` : '';
      const joinPart =
        comp.strokeJoin && comp.strokeJoin !== 'miter' ? `, join: "${comp.strokeJoin}"` : '';
      const strokeDef = `(paint: ${color}, thickness: ${thickness}${dashPart}${capPart}${joinPart})`;

      if (comp.strokeSides) {
        const { top, right, bottom, left } = comp.strokeSides;
        stroke = `(top: ${top ? strokeDef : 'none'}, right: ${right ? strokeDef : 'none'}, bottom: ${bottom ? strokeDef : 'none'}, left: ${left ? strokeDef : 'none'})`;
      } else {
        stroke = strokeDef;
      }
    }

    const insetPart = comp.inset ? `, inset: ${comp.inset}` : '';
    const outsetPart = comp.outset ? `, outset: ${comp.outset}` : '';

    const body = `#rect(width: 100%, height: 100%, fill: ${fill}, stroke: ${stroke}${radiusPart}${insetPart}${outsetPart})`;
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

import type { RectangleComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const rectanglePlugin: ComponentPlugin<RectangleComponent> = {
  type: 'rectangle',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const fill = comp.fill ? formatColor(comp.fill) : 'none';
    const radiusPart = comp.radius ? `, radius: ${comp.radius}` : '';

    let stroke = 'none';
    if (comp.strokeColor || comp.strokeWidth) {
      const color = formatColor(comp.strokeColor ?? '#000000');
      const thickness = comp.strokeWidth ?? '1pt';
      const style = comp.strokeStyle ?? 'solid';
      const dashPart =
        style === 'dashed' ? ', dash: "dashed"' : style === 'dotted' ? ', dash: "dotted"' : '';
      stroke = `(paint: ${color}, thickness: ${thickness}${dashPart})`;
    }

    const body = `#rect(width: 100%, height: 100%, fill: ${fill}, stroke: ${stroke}${radiusPart})`;
    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

import type { LineComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const linePlugin: ComponentPlugin<LineComponent> = {
  type: 'line',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const thickness = comp.thickness ?? '1pt';
    const color = formatColor(comp.color ?? '#000000');
    const style = comp.style ?? 'solid';

    const stroke =
      style === 'dotted'
        ? `(paint: ${color}, thickness: ${thickness}, dash: "dotted")`
        : style === 'dashed'
          ? `(paint: ${color}, thickness: ${thickness}, dash: "dashed")`
          : `${thickness} + ${color}`;

    return wrapPlacement(comp, `#line(length: 100%, stroke: ${stroke})`, ctx.offsetX, ctx.offsetY);
  },
};

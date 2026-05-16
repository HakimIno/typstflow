import type { LineComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const linePlugin: ComponentPlugin<LineComponent> = {
  type: 'line',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const orientation = comp.orientation ?? 'horizontal';
    const [start, end] = orientation === 'vertical' 
      ? ['(50%, 0%)', '(50%, 100%)']
      : ['(0%, 50%)', '(100%, 50%)'];

    // Advanced manual override
    if (comp.stroke) {
      return wrapPlacement(comp, `#line(start: ${start}, end: ${end}, stroke: ${comp.stroke})`, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
    }

    const thickness = comp.thickness ?? '1pt';
    const color = formatColor(comp.color ?? '#000000');
    const style = comp.style ?? 'solid';
    const cap = comp.cap ?? 'butt';

    let dash: string | undefined;
    if (comp.dashArray && comp.dashArray.trim()) {
      dash = `(${comp.dashArray.trim().replace(/\s+/g, ', ')})`;
    } else if (style === 'dotted') {
      dash = '"dotted"';
    } else if (style === 'dashed') {
      dash = '"dashed"';
    }

    const strokeParts = [
      `paint: ${color}`,
      `thickness: ${thickness}`,
      `cap: "${cap}"`,
    ];

    if (dash) {
      strokeParts.push(`dash: ${dash}`);
    }

    const stroke = `(${strokeParts.join(', ')})`;

    return wrapPlacement(comp, `#line(start: ${start}, end: ${end}, stroke: ${stroke})`, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },


};

import type { PageNumberComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const pageNumberPlugin: ComponentPlugin<PageNumberComponent> = {
  type: 'page-number',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const display = (comp.format ?? 'Page {{page}}')
      .replace(/\{\{page\}\}/g, '#counter(page).display()')
      .replace(/\{\{pageTotal\}\}/g, '#context { counter(page).final().at(0) }');

    const s = comp.style;
    const align = comp.align ?? 'left';
    const size = s?.fontSize ?? 10;
    const weight = formatWeight(s?.fontWeight);
    const font = s?.fontFamily ?? 'Sarabun';
    const color = formatColor(s?.color ?? '#000000');

    const body =
      `#set align(${align})\n` +
      `#set text(font: "${font}", size: ${size}pt, weight: ${weight}, fill: ${color})\n` +
      `#context [${display}]`;

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

import { escapeTypst } from '@/lib/utils/typst-utils';
import type { PageBreakIndicatorComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const pageBreakIndicatorPlugin: ComponentPlugin<PageBreakIndicatorComponent> = {
  type: 'page-break-indicator',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const label = escapeTypst(comp.label ?? 'Continued on next page...');
    const body = `#align(center)[#line(length: 40%, stroke: gray + 0.5pt)\n#text(size: 8pt, fill: gray)[${label}]\n#line(length: 40%, stroke: gray + 0.5pt)]`;

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth, ctx.pretty);
  },
};

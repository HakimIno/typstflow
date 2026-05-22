import type { SpacerComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const spacerPlugin: ComponentPlugin<SpacerComponent> = {
  type: 'spacer',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';
    if (ctx.flowMode) return `#v(${comp.height}mm)\n`;
    return wrapPlacement(comp, '', ctx.offsetX, ctx.offsetY, ctx.flowMode, undefined, ctx.pretty);
  },
};

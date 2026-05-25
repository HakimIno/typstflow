import type { RepeaterComponent } from '@/types/schema';
import { isVisible, resolvePath } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const repeaterPlugin: ComponentPlugin<RepeaterComponent> = {
  type: 'repeater',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const path = comp.dataSource.replace(/\{\{|\}\}/g, '').trim();
    const raw = resolvePath(path, ctx.local) ?? resolvePath(path, ctx.global);
    const items = Array.isArray(raw) ? raw : [];

    const parts: string[] = [];
    for (const item of items) {
      for (const child of comp.children) {
        parts.push(
          ctx.render(child, {
            local: item as Record<string, unknown>,
            groupItems: items,
            // Children use absolute positioning within the repeater block
            offsetX: 0,
            offsetY: 0,
            flowMode: false,
          })
        );
      }
    }

    const body = parts.join('');
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

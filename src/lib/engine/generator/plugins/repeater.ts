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
          })
        );
      }
    }

    // Repeater itself is just a transparent container — no #place wrapper needed;
    // children are rendered with their own placement, offset by the repeater's position.
    const body = parts.join('');
    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.layoutType);
  },
};

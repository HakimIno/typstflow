import type { ColumnLayoutComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const columnsPlugin: ComponentPlugin<ColumnLayoutComponent> = {
  type: 'columns',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const gap = comp.gap ?? '10pt';
    const widths = comp.columns.map((c) => c.width.replace('*', 'fr')).join(', ');

    const colContents = comp.columns
      .map((col) => {
        const children = col.components
          // Children in a column are positioned relative to 0,0; don't inherit flow mode
          .map((child) => ctx.render(child, { offsetX: 0, offsetY: 0, flowMode: false }))
          .join('');
        return `[${children}]`;
      })
      .join(', ');

    const body = `#grid(columns: (${widths}), gutter: ${gap}, ${colContents})`;
    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode);
  },
};

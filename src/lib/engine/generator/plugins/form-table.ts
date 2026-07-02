import { asRenderableFormTable, buildFormTableFillerRows } from '@/lib/utils/form-table';
import type { FormTableComponent } from '@/types/schema';
import { isVisible } from '../binding';
import type { ComponentPlugin, RenderContext } from '../types';
import { renderTableComponent } from './table';

export const formTablePlugin: ComponentPlugin<FormTableComponent> = {
  type: 'form-table',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const asTable = asRenderableFormTable(comp);

    return renderTableComponent(asTable, ctx, {
      minRows: comp.minRows,
      trailingRows: buildFormTableFillerRows(comp),
    });
  },
};

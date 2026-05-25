import type { QRComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { escapeStringLiteral, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const qrPlugin: ComponentPlugin<QRComponent> = {
  type: 'qr',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const val = resolveBinding(comp.value, ctx.local, ctx.global, ctx.groupItems);
    const w = comp.width ?? 20;
    const body = `#qrcode("${escapeStringLiteral(val)}", width: ${w}mm)`;

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

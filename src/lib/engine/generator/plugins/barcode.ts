import type { BarcodeComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { escapeStringLiteral, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const barcodePlugin: ComponentPlugin<BarcodeComponent> = {
  type: 'barcode',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const val = resolveBinding(comp.value, ctx.local, ctx.global, ctx.groupItems);
    const fmt = comp.format?.toLowerCase() ?? '';
    const w = comp.width ?? 40;

    let body: string;
    if (fmt === 'ean13') {
      body = `#ean13("${escapeStringLiteral(val)}")`;
    } else if (fmt === 'ean8') {
      body = `#ean8("${escapeStringLiteral(val)}")`;
    } else if (fmt === 'qrcode' || fmt === 'qr') {
      body = `#qrcode("${escapeStringLiteral(val)}", width: ${w}mm)`;
    } else {
      body = `#rect(width: 100%, height: 100%, fill: red.lighten(90%), stroke: 0.5pt + red)[#set align(center + horizon); #text(size: 7pt, fill: red.darken(30%), weight: "bold")[Unsupported: ${fmt}]]`;
    }

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth, ctx.pretty);
  },
};

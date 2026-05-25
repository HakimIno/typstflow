import type { ImageComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const imagePlugin: ComponentPlugin<ImageComponent> = {
  type: 'image',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const src = (comp.src ?? '').trim();
    const isVirtual = src.startsWith('asset-');
    const isDataUrl = src.startsWith('data:');

    const hStr = comp.height !== undefined ? `${comp.height}mm` : 'auto';

    let body: string;
    if (!src) {
      body = `#rect(width: 100%, height: ${hStr}, fill: gray.lighten(80%))[#set align(center + horizon); No Image]`;
    } else if (!isVirtual && !isDataUrl) {
      body = `#rect(width: 100%, height: ${hStr}, fill: gray.lighten(95%), stroke: 0.5pt + gray)[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]]`;
    } else {
      body = `#image("${src}", width: 100%, height: ${hStr}, fit: "${comp.fit ?? 'contain'}")`;
    }

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

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

    let body: string;
    if (!src) {
      body =
        '#rect(width: 100%, height: 100%, fill: gray.lighten(80%))[#set align(center + horizon); No Image]';
    } else if (!isVirtual && !isDataUrl) {
      body =
        '#rect(width: 100%, height: 100%, fill: gray.lighten(95%), stroke: 0.5pt + gray)' +
        '[#set align(center + horizon); #text(size: 6pt, fill: gray.darken(30%))[FILE NOT FOUND]]';
    } else {
      body = `#image("${src}", width: 100%, height: 100%, fit: "${comp.fit ?? 'contain'}")`;
    }

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

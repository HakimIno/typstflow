import type { FormBoxComponent } from '@/types/schema';
import { isVisible } from '../binding';
import { formatColor, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const formBoxPlugin: ComponentPlugin<FormBoxComponent> = {
  type: 'form-box',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const fill = comp.fill ? formatColor(comp.fill) : 'white';
    const strokeColor = formatColor(comp.strokeColor ?? '#64748b');
    const strokeWidth = comp.strokeWidth ?? '0.1mm';
    const inset = comp.inset ?? '2mm';
    const radiusPart = comp.radius ? `, radius: ${comp.radius}` : '';
    const innerGap = comp.innerGap ?? '2mm';

    const children = (comp.components ?? [])
      .map((child, index) => {
        const rendered = ctx.render(child, {
          offsetX: 0,
          offsetY: 0,
          flowMode: true,
          fillWidth: true,
        });
        if (index === 0) return rendered;
        return `#block(below: ${innerGap})[${rendered}]`;
      })
      .join('\n');

    const inner = children.length > 0 ? children : '#v(1mm)';
    const body =
      `#block(width: 100%, clip: false)[\n` +
      `  #rect(width: 100%, inset: ${inset}, fill: ${fill}, stroke: ${strokeWidth} + ${strokeColor}${radiusPart})[\n` +
      `    #block(width: 100%)[\n${inner}\n    ]\n` +
      `  ]\n` +
      `]`;

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

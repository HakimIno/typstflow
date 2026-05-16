import { escapeTypst } from '@/lib/utils/typst-utils';
import type { TextComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import { escapeStringLiteral, formatColor, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

function applyTextTransform(s: string, transform: string | undefined): string {
  switch (transform) {
    case 'upper':
    case 'uppercase':
      return s.toUpperCase();
    case 'lower':
    case 'lowercase':
      return s.toLowerCase();
    case 'title':
    case 'capitalize':
      return s.charAt(0).toUpperCase() + s.slice(1);
    default:
      return s;
  }
}

export const textPlugin: ComponentPlugin<TextComponent> = {
  type: 'text',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const raw = resolveBinding(comp.content, ctx.local, ctx.global, ctx.groupItems);
    const content = applyTextTransform(raw, comp.style?.textTransform);
    const s = comp.style;

    const size = s?.fontSize ?? 10;
    const weight = formatWeight(s?.fontWeight);
    const align = comp.align ?? 'left';
    const leading = s?.lineHeight ? s.lineHeight - 1 : 0.2;
    const tracking = s?.letterSpacing || '0pt';
    const justify = s?.justify ?? false;
    const color = formatColor(s?.color ?? '#000000');
    const font = s?.fontFamily ?? 'Sarabun';
    const fontStyle = s?.italic ? 'italic' : 'normal';
    const underline = s?.underline ?? false;
    const format = comp.format ?? 'text';

    const contentBlock =
      format !== 'text'
        ? `[#fmt_${format.replace(/-/g, '_')}("${escapeStringLiteral(content)}")]`
        : `[${escapeTypst(content)}]`;

    let body =
      `#set align(${align})\n` +
      `#set par(leading: ${leading}em, justify: ${justify})\n` +
      `#text(size: ${size}pt, font: ("${font}", "Sarabun", "sans-serif"), ` +
      `weight: ${weight}, style: "${fontStyle}", fill: ${color}, tracking: ${tracking})`;
    body += underline ? `[#underline${contentBlock}]` : contentBlock;

    if (s?.background) {
      const bgColor = formatColor(s.background);
      body = `#block(fill: ${bgColor}, width: 100%, height: 100%, inset: 5pt)[${body}]`;
    }

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

import { escapeTypst } from '@/lib/utils/typst-utils';
import type { TextComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import {
  escapeStringLiteral,
  formatColor,
  formatFontFamily,
  formatWeight,
  wrapPlacement,
} from '../placement';
import { formatSetCall } from '../pretty';
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
    const rawAlign = s?.align ?? comp.align ?? 'left';
    // Typst uses set par(justify: true) for justified text, not set align(justify)
    const isJustify = rawAlign === 'justify';
    const align = isJustify ? 'left' : rawAlign;

    // Combine with vertical alignment if specified
    const vAlignMap = {
      top: 'top',
      middle: 'horizon',
      bottom: 'bottom',
    };
    const vAlign = s?.verticalAlign ? vAlignMap[s.verticalAlign] : undefined;
    const alignExpr = vAlign ? `${vAlign} + ${align}` : align;

    const leading = s?.lineHeight ? s.lineHeight - 0.65 : 0.75;
    const tracking = s?.letterSpacing || '0pt';
    const justify = isJustify || (s?.justify ?? false);
    const color = formatColor(s?.color ?? '#000000');
    const font = formatFontFamily(s?.fontFamily ?? 'Sarabun');
    const fontStyle = 'normal'; // Use skew for reliable faux italics across all custom fonts
    const underline = s?.underline ?? false;
    const strikethrough = s?.strikethrough ?? false;
    const smallcaps = s?.smallcaps ?? false;
    const highlight = s?.highlight ? formatColor(s.highlight) : undefined;
    const format = comp.format ?? 'text';

    const innerContent =
      format !== 'text'
        ? `#fmt_${format.replace(/-/g, '_')}("${escapeStringLiteral(content)}")`
        : content
            .split('\n')
            .map((line) => escapeTypst(line))
            .join(' #linebreak() ');

    let mainContent = innerContent;
    if (underline) {
      mainContent = `#underline[${mainContent}]`;
    }
    if (strikethrough) {
      mainContent = `#strike[${mainContent}]`;
    }
    if (smallcaps) {
      mainContent = `#smallcaps[${mainContent}]`;
    }
    if (highlight) {
      mainContent = `#highlight(fill: ${highlight})[${mainContent}]`;
    }
    if (s?.italic) {
      mainContent = `#skew(ax: -12deg)[${mainContent}]`;
    }

    const textArgs: string[] = [
      `size: ${size}pt`,
      `font: ("${font}", "Sarabun", "sans-serif")`,
      `weight: ${weight}`,
      `style: "${fontStyle}"`,
      `fill: ${color}`,
      `tracking: ${tracking}`,
    ];

    if (s?.strokeColor) {
      const strokeW = s.strokeWidth || '0.5pt';
      textArgs.push(`stroke: ${strokeW} + ${formatColor(s.strokeColor)}`);
    }

    if (s?.hyphenate !== undefined) {
      textArgs.push(`hyphenate: ${s.hyphenate}`);
    }

    if (s?.numberWidth) {
      textArgs.push(`number-width: "${s.numberWidth}"`);
    }

    let body = `${
      formatSetCall('align', [`${alignExpr}`], !!ctx.pretty) +
      formatSetCall('par', [`leading: ${leading}em`, `justify: ${justify}`], !!ctx.pretty) +
      formatSetCall('text', textArgs, !!ctx.pretty)
    }${mainContent}`;

    if (s?.background) {
      const bgColor = formatColor(s.background);
      const insetVal = s.backgroundPadding || '5pt';
      const radiusVal = s.backgroundRadius ? `, radius: ${s.backgroundRadius}` : '';
      const heightExpr = ctx.flowMode ? '' : ', height: 100%';
      body = `#block(fill: ${bgColor}, width: 100%${heightExpr}, inset: ${insetVal}${radiusVal})[${body}]`;
    }

    let finalBody = body;
    if (ctx.flowMode) {
      const halfLeadingPt = Math.max((leading / 2) * size, 0);
      if (halfLeadingPt > 0.01) {
        finalBody = `#block(width: 100%, inset: (top: ${halfLeadingPt.toFixed(3)}pt, bottom: ${halfLeadingPt.toFixed(3)}pt))[${body}]`;
      }
    }

    return wrapPlacement(
      comp,
      finalBody,
      ctx.offsetX,
      ctx.offsetY,
      ctx.flowMode,
      ctx.fillWidth,
      ctx.pretty
    );
  },
};

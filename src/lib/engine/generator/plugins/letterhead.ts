import { escapeTypst } from '@/lib/utils/typst-utils';
import type { LetterheadComponent } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import {
  formatColor,
  formatFontFamily,
  formatWeight,
  wrapPlacement,
} from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

export const letterheadPlugin: ComponentPlugin<LetterheadComponent> = {
  type: 'letterhead',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const companyName = escapeTypst(
      resolveBinding(comp.companyName, ctx.local, ctx.global, ctx.groupItems)
    );
    const address = comp.companyAddress
      ? escapeTypst(resolveBinding(comp.companyAddress, ctx.local, ctx.global, ctx.groupItems))
      : '';
    const taxRaw = comp.taxId
      ? resolveBinding(comp.taxId, ctx.local, ctx.global, ctx.groupItems)
      : '';
    const taxLabel = comp.taxIdLabel ?? 'เลขประจำตัวผู้เสียภาษี';
    const taxLine =
      taxRaw && comp.showTaxIdLabel !== false
        ? escapeTypst(`${taxLabel} ${taxRaw}`)
        : taxRaw
          ? escapeTypst(taxRaw)
          : '';

    const title = escapeTypst(resolveBinding(comp.title, ctx.local, ctx.global, ctx.groupItems));
    const subtitle = comp.subtitle
      ? escapeTypst(resolveBinding(comp.subtitle, ctx.local, ctx.global, ctx.groupItems))
      : '';

    const companySize = comp.companyStyle?.fontSize ?? 13;
    const companyWeight = formatWeight(comp.companyStyle?.fontWeight, 'bold');
    const companyColor = formatColor(comp.companyStyle?.color ?? '#111827');
    const companyFont = formatFontFamily(comp.companyStyle?.fontFamily ?? 'Sarabun');

    const titleSize = comp.titleStyle?.fontSize ?? 15;
    const titleWeight = formatWeight(comp.titleStyle?.fontWeight, 'bold');
    const titleColor = formatColor(comp.titleStyle?.color ?? '#111827');
    const titleFont = formatFontFamily(comp.titleStyle?.fontFamily ?? 'Sarabun');

    const addressSize = comp.addressStyle?.fontSize ?? 9;
    const addressColor = formatColor(comp.addressStyle?.color ?? '#475569');
    const addressFont = formatFontFamily(comp.addressStyle?.fontFamily ?? 'Sarabun');

    const subtitleSize = comp.subtitleStyle?.fontSize ?? 10;
    const subtitleColor = formatColor(comp.subtitleStyle?.color ?? '#334155');

    const titleBlock = comp.underlineTitle
      ? `#block(width: 100%)[#align(center)[#text(size: ${titleSize}pt, weight: ${titleWeight}, fill: ${titleColor}, font: ("${titleFont}", "Sarabun", "sans-serif"))[${title}]]#v(1mm)#line(length: 100%, stroke: 0.5pt + ${titleColor})]`
      : `#align(center)[#text(size: ${titleSize}pt, weight: ${titleWeight}, fill: ${titleColor}, font: ("${titleFont}", "Sarabun", "sans-serif"))[${title}]]`;

    const pageNumBlock =
      comp.showPageNumber !== false
        ? (() => {
            const fmt = (comp.pageNumberFormat ?? 'หน้า {{page}} / {{pageTotal}}')
              .replace(/\{\{page\}\}/g, '#counter(page).display()')
              .replace(/\{\{pageTotal\}\}/g, '#context { counter(page).final().at(0) }');
            const pageColor = formatColor('#334155');
            return `#align(right)[#set text(size: 8pt, fill: ${pageColor})\n#context [${fmt}]]`;
          })()
        : '';

    const lines: string[] = [
      `#block(width: 100%)[`,
      pageNumBlock ? `  ${pageNumBlock}` : '',
      `  #align(center)[#text(size: ${companySize}pt, weight: ${companyWeight}, fill: ${companyColor}, font: ("${companyFont}", "Sarabun", "sans-serif"))[${companyName}]]`,
      address ? `  #v(1mm)\n  #align(center)[#text(size: ${addressSize}pt, fill: ${addressColor}, font: ("${addressFont}", "Sarabun", "sans-serif"))[${address}]]` : '',
      taxLine ? `  #v(0.5mm)\n  #align(center)[#text(size: ${addressSize}pt, fill: ${addressColor}, font: ("${addressFont}", "Sarabun", "sans-serif"))[${taxLine}]]` : '',
      `  #v(2mm)`,
      `  ${titleBlock}`,
      subtitle
        ? `  #v(1mm)\n  #align(center)[#text(size: ${subtitleSize}pt, fill: ${subtitleColor}, font: ("${titleFont}", "Sarabun", "sans-serif"))[${subtitle}]]`
        : '',
      `]`,
    ].filter(Boolean);

    return wrapPlacement(
      comp,
      lines.join('\n'),
      ctx.offsetX,
      ctx.offsetY,
      ctx.flowMode,
      ctx.fillWidth,
      ctx.pretty
    );
  },
};

import { escapeTypst } from '@/lib/utils/typst-utils';
import type { FieldGridComponent, FormFieldDefinition } from '@/types/schema';
import { isVisible, resolveBinding } from '../binding';
import {
  escapeStringLiteral,
  formatColor,
  formatFontFamily,
  formatWeight,
  wrapPlacement,
} from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

function renderFieldPair(
  field: FormFieldDefinition,
  comp: FieldGridComponent,
  ctx: RenderContext,
  labelWidth: string
): string[] {
  const showColon = comp.showColon !== false;
  const labelSuffix = showColon ? ' :' : '';
  const labelText = escapeTypst(
    resolveBinding(field.label, ctx.local, ctx.global, ctx.groupItems) + labelSuffix
  );

  const rawValue = resolveBinding(field.value, ctx.local, ctx.global, ctx.groupItems);
  const fmt = field.format ?? 'text';
  const valueText =
    fmt !== 'text'
      ? `#fmt_${fmt.replace(/-/g, '_')}("${escapeStringLiteral(rawValue)}")`
      : escapeTypst(rawValue);

  const labelSize = field.labelStyle?.fontSize ?? comp.labelStyle?.fontSize ?? 9;
  const labelWeight = formatWeight(field.labelStyle?.fontWeight ?? comp.labelStyle?.fontWeight);
  const labelColor = formatColor(field.labelStyle?.color ?? comp.labelStyle?.color ?? '#334155');
  const labelFont = formatFontFamily(field.labelStyle?.fontFamily ?? comp.labelStyle?.fontFamily ?? 'Sarabun');

  const valueSize = field.style?.fontSize ?? comp.valueStyle?.fontSize ?? 9;
  const valueWeight = formatWeight(field.style?.fontWeight ?? comp.valueStyle?.fontWeight, 'regular');
  const valueColor = formatColor(field.style?.color ?? comp.valueStyle?.color ?? '#111827');
  const valueFont = formatFontFamily(field.style?.fontFamily ?? comp.valueStyle?.fontFamily ?? 'Sarabun');
  const align = field.align ?? 'left';

  const lw = field.labelWidth ?? labelWidth;
  return [
    `[#text(size: ${labelSize}pt, weight: ${labelWeight}, fill: ${labelColor}, font: ("${labelFont}", "Sarabun", "sans-serif"))[${labelText}]],`,
    `[#align(${align})[#text(size: ${valueSize}pt, weight: ${valueWeight}, fill: ${valueColor}, font: ("${valueFont}", "Sarabun", "sans-serif"))[${valueText}]]],`,
  ];
}

function renderFieldStack(
  fields: FormFieldDefinition[],
  comp: FieldGridComponent,
  ctx: RenderContext,
  labelWidth: string
): string {
  const rowGap = comp.rowGap ?? '1.5mm';
  const cells: string[] = [];
  for (const field of fields) {
    cells.push(...renderFieldPair(field, comp, ctx, labelWidth));
  }
  return `#grid(columns: (${labelWidth}, 1fr), row-gutter: ${rowGap}, ${cells.join('\n')})`;
}

export const fieldGridPlugin: ComponentPlugin<FieldGridComponent> = {
  type: 'field-grid',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const labelWidth = comp.labelWidth ?? '28mm';
    const fields = comp.fields ?? [];

    let gridBody = '';
    if (comp.columns === 2) {
      const left: FormFieldDefinition[] = [];
      const right: FormFieldDefinition[] = [];
      fields.forEach((field, index) => {
        const col = field.column ?? index % 2;
        if (col === 1) right.push(field);
        else left.push(field);
      });
      const columnGap = comp.columnGap ?? '4mm';
      gridBody = `#grid(columns: (1fr, 1fr), gutter: ${columnGap}, [${renderFieldStack(left, comp, ctx, labelWidth)}], [${renderFieldStack(right, comp, ctx, labelWidth)}])`;
    } else {
      gridBody = renderFieldStack(fields, comp, ctx, labelWidth);
    }

    const hasBorder = comp.strokeWidth && comp.strokeWidth !== '0' && comp.strokeWidth !== '0pt';
    let body = gridBody;
    if (hasBorder) {
      const fill = comp.fill ? formatColor(comp.fill) : 'white';
      const strokeColor = formatColor(comp.strokeColor ?? '#64748b');
      const strokeWidth = comp.strokeWidth ?? '0.1mm';
      const inset = comp.inset ?? '2mm';
      body =
        `#block(width: 100%)[\n` +
        `  #rect(width: 100%, inset: ${inset}, fill: ${fill}, stroke: ${strokeWidth} + ${strokeColor})[\n` +
        `    ${gridBody}\n` +
        `  ]\n` +
        `]`;
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

import { escapeTypst } from '@/lib/utils/typst-utils';
import type { ChecklistComponent } from '@/types/schema';
import { isVisible, resolveBinding, resolvePath } from '../binding';
import { formatColor, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

/** Returns the cheq function name for a given checkMark character. */
function cheqSymFn(mark: string): string {
  if (mark === '/') return 'incomplete-sym';
  if (mark === '-') return 'canceled-sym';
  return 'checked-sym';
}

/** Maps shape preset → Typst radius string */
function shapeToTypstRadius(shape: string): string {
  if (shape === 'square') return '0em';
  if (shape === 'circle') return '0.5em';
  return '0.15em'; // rounded
}

/**
 * Builds a cheq symbol call for CODE context (dict value, #grid arg — no leading #).
 * fill is the box background for unchecked/incomplete, or checkmark color for checked/canceled.
 */
function cheqSymCode(
  fn: string,
  stroke: string,
  fill: string,
  radius: string,
  size?: number
): string {
  const call = `${fn}(stroke: rgb("${stroke}"), fill: rgb("${fill}"), radius: ${radius})`;
  return size !== undefined ? `text(size: ${size}pt)[#${call}]` : call;
}

/** For a given sym function, returns the correct `fill` value.
 *  unchecked-sym + incomplete-sym → box background (checkboxFill)
 *  checked-sym + canceled-sym    → mark/bar color (white)
 */
function fillForSym(fn: string, checkboxFill: string): string {
  return fn === 'unchecked-sym' || fn === 'incomplete-sym' ? checkboxFill : '#ffffff';
}

export const checklistPlugin: ComponentPlugin<ChecklistComponent> = {
  type: 'checklist',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const spacing = comp.spacing ?? 4;
    const indent = comp.indent ?? 5;
    const s = comp.style;
    const size = s?.fontSize ?? 10;
    const weight = formatWeight(s?.fontWeight);
    const color = formatColor(s?.color ?? '#000000');
    const font = s?.fontFamily ?? 'Sarabun';
    const listStyle = comp.listStyle ?? 'bullet';
    const checkboxColor = comp.checkboxColor ?? '#616161';
    const checkboxFill = comp.checkboxFill ?? '#ffffff';
    const checkMark = comp.checkMark ?? 'x';
    const checkboxSize = comp.checkboxSize;
    const checkboxShape = comp.checkboxShape ?? 'rounded';
    const direction = comp.direction ?? 'vertical';
    const columns = Math.max(1, comp.columns ?? 2);

    const radiusTypst = shapeToTypstRadius(checkboxShape);

    const textSet =
      `#set text(size: ${size}pt, font: ("${font}", "Sarabun", "sans-serif"), ` +
      `weight: ${weight}, fill: ${color})\n`;

    // Resolve items
    let resolvedItems: Array<{ label: string; checked: boolean }>;
    if (comp.dataSource) {
      const path = comp.dataSource.replace(/\{\{|\}\}/g, '').trim();
      const raw = resolvePath(path, ctx.local) ?? resolvePath(path, ctx.global);
      const arr = Array.isArray(raw) ? raw : [];
      const labelField = comp.labelField ?? 'label';
      const checkedField = comp.checkedField ?? 'checked';
      resolvedItems = (arr as Record<string, unknown>[]).map((item) => ({
        label: item?.[labelField] != null ? String(item[labelField]) : '',
        checked: Boolean(item?.[checkedField]),
      }));
    } else {
      resolvedItems = comp.items.map((item) => ({
        label: resolveBinding(item.label, ctx.local, ctx.global, ctx.groupItems),
        checked: item.checked ?? false,
      }));
    }

    if (resolvedItems.length === 0) {
      return wrapPlacement(
        comp,
        `${textSet}#list()`,
        ctx.offsetX,
        ctx.offsetY,
        ctx.flowMode,
        ctx.fillWidth
      );
    }

    const gridCols = direction === 'horizontal' ? resolvedItems.length : columns;

    // All cheq imports needed
    const allImports = 'checked-sym, unchecked-sym, incomplete-sym, canceled-sym';

    let body: string;

    if (listStyle === 'checkbox') {
      const checkedFn = cheqSymFn(checkMark);

      if (direction === 'vertical') {
        const lines = resolvedItems
          .map((it) => `- [${it.checked ? checkMark : ' '}] ${escapeTypst(it.label)}`)
          .join('\n');

        // Always use marker-map so we can control fill + radius + optional size
        const checkedSym = cheqSymCode(
          checkedFn,
          checkboxColor,
          fillForSym(checkedFn, checkboxFill),
          radiusTypst,
          checkboxSize
        );
        const uncheckedSym = cheqSymCode(
          'unchecked-sym',
          checkboxColor,
          checkboxFill,
          radiusTypst,
          checkboxSize
        );
        body =
          `#import "@preview/cheq:0.2.2": checklist, ${allImports}\n${textSet}` +
          `#set list(indent: ${indent}mm, spacing: ${spacing}pt)\n` +
          `#show: checklist.with(fill: rgb("${checkboxFill}"), stroke: rgb("${checkboxColor}"), radius: ${radiusTypst}, marker-map: (\n` +
          `  "${checkMark}": ${checkedSym},\n` +
          `  " ": ${uncheckedSym},\n` +
          `))\n${lines}`;
      } else {
        // Grid/horizontal: each cell = inner 2-col grid(sym, label) for proper row alignment
        const cellLines = resolvedItems
          .map((it) => {
            const fn = it.checked ? checkedFn : 'unchecked-sym';
            const symFill = fillForSym(fn, checkboxFill);
            const symArg = cheqSymCode(fn, checkboxColor, symFill, radiusTypst, checkboxSize);
            return `  [#grid(columns: (auto, 1fr), column-gutter: 0.35em, align: horizon + left, ${symArg}, [${escapeTypst(it.label)}])],`;
          })
          .join('\n');
        body =
          `#import "@preview/cheq:0.2.2": ${allImports}\n${textSet}` +
          `#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)`;
      }
    } else if (listStyle === 'numbered' || listStyle === 'alpha' || listStyle === 'roman') {
      const numbering = listStyle === 'alpha' ? '"a."' : listStyle === 'roman' ? '"i."' : '"1."';
      if (direction === 'vertical') {
        const itemLines = resolvedItems.map((it) => `  [${escapeTypst(it.label)}],`).join('\n');
        body =
          `${textSet}#enum(\n  numbering: ${numbering},\n  spacing: ${spacing}pt,\n` +
          `  indent: ${indent}mm,\n${itemLines}\n)`;
      } else {
        const cellLines = resolvedItems
          .map((it, i) => {
            const num =
              listStyle === 'alpha'
                ? `${String.fromCharCode(97 + i)}.`
                : listStyle === 'roman'
                  ? `${'i'.repeat(i + 1)}.`
                  : `${i + 1}.`;
            return `  [${escapeTypst(num)} ${escapeTypst(it.label)}],`;
          })
          .join('\n');
        body = `${textSet}#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)`;
      }
    } else if (listStyle === 'dash') {
      if (direction === 'vertical') {
        const itemLines = resolvedItems.map((it) => `  [${escapeTypst(it.label)}],`).join('\n');
        body = `${textSet}#list(marker: [-],\n  spacing: ${spacing}pt,\n  indent: ${indent}mm,\n${itemLines}\n)`;
      } else {
        const cellLines = resolvedItems.map((it) => `  [– ${escapeTypst(it.label)}],`).join('\n');
        body = `${textSet}#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)`;
      }
    } else if (listStyle === 'custom') {
      const mk = escapeTypst(comp.marker ?? '→');
      if (direction === 'vertical') {
        const itemLines = resolvedItems.map((it) => `  [${escapeTypst(it.label)}],`).join('\n');
        body = `${textSet}#list(marker: [${mk}],\n  spacing: ${spacing}pt,\n  indent: ${indent}mm,\n${itemLines}\n)`;
      } else {
        const cellLines = resolvedItems
          .map((it) => `  [${mk} ${escapeTypst(it.label)}],`)
          .join('\n');
        body = `${textSet}#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)`;
      }
    } else {
      // bullet (default)
      if (direction === 'vertical') {
        const itemLines = resolvedItems.map((it) => `  [${escapeTypst(it.label)}],`).join('\n');
        body = `${textSet}#list(\n  spacing: ${spacing}pt,\n  indent: ${indent}mm,\n${itemLines}\n)`;
      } else {
        const cellLines = resolvedItems.map((it) => `  [• ${escapeTypst(it.label)}],`).join('\n');
        body = `${textSet}#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)`;
      }
    }

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

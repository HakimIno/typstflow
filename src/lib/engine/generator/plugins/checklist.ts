import { escapeTypst } from '@/lib/utils/typst-utils';
import type { ChecklistComponent } from '@/types/schema';
import { isVisible, resolveBinding, resolvePath } from '../binding';
import { formatColor, formatFontFamily, formatWeight, wrapPlacement } from '../placement';
import type { ComponentPlugin, RenderContext } from '../types';

/** Returns the custom function name for a given checkMark character. */
function cheqSymFn(mark: string): string {
  if (mark === '/') return 'my-incomplete-sym';
  if (mark === '-') return 'my-canceled-sym';
  return 'my-checked-sym';
}

/** Maps shape preset → Typst radius string */
function shapeToTypstRadius(shape: string): string {
  if (shape === 'square') return '0em';
  if (shape === 'circle') return '0.5em';
  return '0.15em'; // rounded
}

/** Helper to convert numbers to roman numerals */
function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let result = '';
  let remaining = num;
  for (const [val, sym] of map) {
    while (remaining >= val) {
      result += sym;
      remaining -= val;
    }
  }
  return result;
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
  checkboxStyle: string,
  size?: number
): string {
  const call = `${fn}(stroke: rgb("${stroke}"), fill: rgb("${fill}"), radius: ${radius}, style: "${checkboxStyle}")`;
  
  // Wrap in text block so that it scales beautifully with text size
  const sizeArg = size !== undefined ? `size: ${size}pt, ` : '';
  return `text(${sizeArg}font: "Liberation Sans")[#${call}]`;
}

function symStrokeAndFill(
  _fn: string,
  checkboxColor: string,
  checkboxFill: string
): { stroke: string; fill: string } {
  // Always return the standard mapping. 
  // For checked-sym/canceled-sym: stroke controls the solid box container, fill controls the inner checkmark/dash.
  // For unchecked-sym/incomplete-sym: stroke controls the outline, fill controls the background fill.
  return { stroke: checkboxColor, fill: checkboxFill };
}

export const checklistPlugin: ComponentPlugin<ChecklistComponent> = {
  type: 'checklist',
  render(comp, ctx: RenderContext): string {
    if (!isVisible(comp.visible, ctx.local, ctx.global)) return '';

    const spacing = comp.spacing ?? 4;
    const indent = comp.indent ?? 0;
    const s = comp.style;
    const size = s?.fontSize ?? 10;
    const weight = formatWeight(s?.fontWeight);
    const color = formatColor(s?.color ?? '#000000');
    const font = formatFontFamily(s?.fontFamily ?? 'Sarabun');
    const listStyle = comp.listStyle ?? 'bullet';
    const checkboxColor = comp.checkboxColor ?? '#616161';
    const checkboxFill = comp.checkboxFill ?? '#ffffff';
    const checkMark = comp.checkMark ?? 'x';
    const checkboxSize = comp.checkboxSize;
    const resolvedCheckboxSize = checkboxSize ?? (size * 0.85);
    const checkboxShape = comp.checkboxShape ?? 'rounded';
    const checkboxStyle = comp.checkboxStyle ?? 'solid';
    const direction = comp.direction ?? 'vertical';
    const columns = Math.max(1, comp.columns ?? 2);
    const alignItems = comp.alignItems ?? 'start';
    const checkedStrikethrough = comp.checkedStrikethrough ?? false;
    const checkedMuted = comp.checkedMuted ?? false;

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
      resolvedItems = (arr as unknown[]).map((item) => {
        if (typeof item === 'object' && item !== null) {
          const lf = comp.labelField ?? 'label';
          const cf = comp.checkedField ?? 'checked';
          const obj = item as Record<string, unknown>;
          const resolvedLabel = obj[lf] ?? obj['name'] ?? obj['title'] ?? obj['text'] ?? String(item);
          return {
            label: String(resolvedLabel),
            checked: Boolean(obj[cf] ?? obj['status'] ?? obj['done'] ?? false),
          };
        }
        return {
          label: String(item),
          checked: false,
        };
      });
    } else {
      resolvedItems = comp.items.map((item) => ({
        label: resolveBinding(item.label, ctx.local, ctx.global, ctx.groupItems),
        checked: item.checked ?? false,
      }));
    }

    const itemsWithDecorations = resolvedItems.map((it) => {
      let label = escapeTypst(it.label);
      if (s?.underline) {
        label = `#underline[${label}]`;
      }
      if (s?.strikethrough || (it.checked && checkedStrikethrough)) {
        label = `#strike[${label}]`;
      }
      if (s?.smallcaps) {
        label = `#smallcaps[${label}]`;
      }
      if (s?.italic) {
        label = `#skew(ax: -12deg)[${label}]`;
      }
      if (it.checked && checkedMuted) {
        label = `#text(fill: ${color}.mix(rgb("#ffffff")))[${label}]`;
      }
      return { ...it, label };
    });

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

    // Grid columns configuration
    const gridCols = direction === 'grid' ? columns : 1;
    const cellAlign = alignItems === 'start' ? 'top + left' : 'horizon + left';
    const isCheckboxStyle = listStyle === 'checkbox';
    const symOffset = alignItems === 'start' ? (isCheckboxStyle ? '0.18em' : '0.03em') : '0em';

    // Helper to generate a single item's markup
    const renderItemMarkup = (it: (typeof itemsWithDecorations)[0], i: number, colsDef: string) => {
      let symArg = '';
      if (listStyle === 'checkbox') {
        const checkedFn = cheqSymFn(checkMark);
        const fn = it.checked ? checkedFn : 'my-unchecked-sym';
        const colors = symStrokeAndFill(fn, checkboxColor, checkboxFill);
        symArg = cheqSymCode(fn, colors.stroke, colors.fill, radiusTypst, checkboxStyle, resolvedCheckboxSize);
      } else {
        const char =
          listStyle === 'numbered'
            ? `${i + 1}.`
            : listStyle === 'alpha'
              ? `${String.fromCharCode(97 + i)}.`
              : listStyle === 'roman'
                ? `${toRoman(i + 1)}.`
                : listStyle === 'dash'
                  ? '–'
                  : listStyle === 'custom'
                    ? (comp.marker ?? '→')
                    : '•';
        symArg = `[${escapeTypst(char)}]`;
      }

      const symArgWrapped = symOffset !== '0em' ? `box(dy: ${symOffset})[${symArg}]` : symArg;
      return `#grid(columns: ${colsDef}, column-gutter: 0.35em, align: ${cellAlign}, ${symArgWrapped}, [${it.label}])`;
    };

    // Custom pure drawing-based symbols. 
    // They align mathematically perfectly to the geometric center and are completely immune to custom font metrics distortion!
    const customSymDefs = `
#let my-unchecked-sym(fill: white, stroke: rgb("#616161"), radius: .1em, style: "solid") = {
  box(
    stroke: .05em + stroke,
    fill: fill,
    height: .8em,
    width: .8em,
    radius: radius,
  )
}

#let my-checked-sym(fill: white, stroke: rgb("#616161"), radius: .1em, style: "solid") = {
  let boxBg = if style == "outline" { fill } else { stroke }
  let markStroke = if style == "outline" { stroke } else { fill }
  box(
    stroke: .05em + stroke,
    fill: boxBg,
    height: .8em,
    width: .8em,
    radius: radius,
    place(center + horizon, dy: 0.02em)[
      #place(center + horizon, dx: -0.16em, dy: 0.08em)[#rotate(45deg)[#line(length: 0.24em, stroke: markStroke + .08em)]]
      #place(center + horizon, dx: 0.06em, dy: -0.02em)[#rotate(-45deg)[#line(length: 0.42em, stroke: markStroke + .08em)]]
    ]
  )
}

#let my-incomplete-sym(fill: white, stroke: rgb("#616161"), radius: .1em, style: "solid") = {
  box(
    stroke: .05em + stroke,
    fill: fill,
    height: .8em,
    width: .8em,
    radius: radius,
    if style == "outline" {
      place(center + horizon)[
        #line(start: (0em, -0.38em), end: (0em, 0.38em), stroke: .05em + stroke)
      ]
    } else {
      place(left + top, dx: -0.01em, dy: -0.01em)[
        #rect(fill: stroke, height: 0.82em, width: 0.41em, radius: (top-left: radius, bottom-left: radius), stroke: none)
      ]
    }
  )
}

#let my-canceled-sym(fill: white, stroke: rgb("#616161"), radius: .1em, style: "solid") = {
  let boxBg = if style == "outline" { fill } else { stroke }
  let markBg = if style == "outline" { stroke } else { fill }
  box(
    stroke: .05em + stroke,
    fill: boxBg,
    height: .8em,
    width: .8em,
    radius: radius,
    place(center + horizon)[
      #rect(height: .12em, width: 0.52em, fill: markBg, radius: 0.02em, stroke: none)
    ]
  )
}
`;

    let body = '';
    if (direction === 'horizontal') {
      const horizontalItems = itemsWithDecorations
        .map((it, i) => `#box[${renderItemMarkup(it, i, '(auto, auto)')}]`)
        .join(` #h(${spacing}pt) `);

      body = `${customSymDefs}${textSet}#pad(left: ${indent}mm)[#set par(leading: ${spacing}pt)\n${horizontalItems}]`;
    } else {
      const cellLines = itemsWithDecorations
        .map((it, i) => `  [${renderItemMarkup(it, i, '(auto, 1fr)')}],`)
        .join('\n');

      body = `${customSymDefs}${textSet}#pad(left: ${indent}mm)[#grid(\n  columns: ${gridCols},\n  gutter: ${spacing}pt,\n${cellLines}\n)]`;
    }

    return wrapPlacement(comp, body, ctx.offsetX, ctx.offsetY, ctx.flowMode, ctx.fillWidth);
  },
};

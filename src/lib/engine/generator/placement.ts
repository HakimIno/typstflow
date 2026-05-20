import type { BaseComponent } from '@/types/schema';

/**
 * Emit a placement wrapper for a component.
 *
 * Absolute mode (default): `#place(dx, dy)[#block(...)[body]]`
 * Flow mode: `#block(width: Wmm, clip: false)[body]` — no fixed position,
 * so Typst flows content naturally and expanding components push siblings down.
 */
export function wrapPlacement(
  base: BaseComponent,
  body: string,
  offsetX: number,
  offsetY: number,
  flowMode?: boolean,
  fillWidth?: boolean
): string {
  const parts: string[] = [];

  if (flowMode) {
    if (base.pageBreakBefore) parts.push('#pagebreak(weak: true)\n');

    if (base.type === 'table') {
      // --- Special Native Flow-Pagination Wrapper for Tables ---
      // - Keeps the table in document flow so rows can paginate naturally.
      // - Ignores y: flow layout order determines vertical position.
      // - No height constraint so Typst splits table rows naturally across page boundaries.
      const x = base.x ?? 0;
      const w = base.width ?? 100;
      const leftPad = fillWidth ? 0 : offsetX + x;
      const widthExpr = fillWidth ? '100%' : `${w}mm`;
      const sizedBlock = `#block(width: ${widthExpr}, clip: false)[${body}]`;
      const inner = leftPad > 0 ? `#pad(left: ${leftPad}mm)[${sizedBlock}]` : sizedBlock;
      const aboveVal = (base as any).marginTop != null ? `${(base as any).marginTop}mm` : '0pt';
      const belowVal =
        (base as any).marginBottom != null ? `${(base as any).marginBottom}mm` : '0pt';
      parts.push(`#block(above: ${aboveVal}, below: ${belowVal}, width: 100%)[${inner}]\n`);
      return parts.join('');
    }

    const x = base.x ?? 0;
    const w = base.width ?? 100;
    const h = base.height ?? 10;
    // When inside a grid cell (fillWidth=true), use 100% so the content
    // fills the cell determined by the grid column width.
    const widthExpr = fillWidth ? '100%' : `${w}mm`;
    // Text, columns, checklist, summary-box, and repeater components use auto-height in flow mode:
    // Typst determines height from content, preventing overflow/overlap.
    // Other components (image, spacer, line, etc.) still need an explicit height.
    const type = base.type as string;
    const autoHeight =
      type === 'text' ||
      type === 'table' ||
      type === 'columns' ||
      type === 'checklist' ||
      type === 'summary-box' ||
      type === 'repeater';

    const sizedBlock = autoHeight
      ? `#block(width: ${widthExpr}, clip: false)[${body}]`
      : `#block(width: ${widthExpr}, height: ${h}mm, clip: false)[${body}]`;
    // Inside a grid cell, skip left-padding (x indent) — the grid handles positioning
    const inner = !fillWidth && x > 0 ? `#pad(left: ${x}mm)[${sizedBlock}]` : sizedBlock;
    // Use component margins for spacing. Text defaults to 2pt below if no margin set,
    // preventing the "cramped" look where text blocks stack flush against each other.
    const aboveVal = (base as any).marginTop != null ? `${(base as any).marginTop}mm` : '0pt';
    const belowVal =
      (base as any).marginBottom != null
        ? `${(base as any).marginBottom}mm`
        : autoHeight
          ? '2pt'
          : '0pt';
    const outerHeight = autoHeight ? '' : `, height: ${h}mm`;
    const outerWidth = fillWidth ? '100%' : '100%';
    parts.push(
      `#block(above: ${aboveVal}, below: ${belowVal}, width: ${outerWidth}${outerHeight})[${inner}]\n`
    );
    return parts.join('');
  }

  // --- Absolute Mode ---
  if (base.pageBreakBefore) parts.push('#pagebreak(weak: true)\n#box()\n');
  const x = base.x ?? 0;
  const y = base.y ?? 0;
  const w = base.width ?? 100;
  const h = base.height ?? 20;
  const absX = offsetX + x;
  const absY = offsetY + y;

  parts.push(
    `#place(top + left, dx: ${absX}mm, dy: ${absY}mm)[#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]]\n`
  );
  return parts.join('');
}

/**
 * Format a font weight value for Typst.
 * Named strings are quoted ("bold"), numeric values are unquoted integers (700).
 * Typst rejects numeric values inside quotes ("700" is invalid; 700 is valid).
 */
export function formatWeight(weight: string | number | undefined, fallback = 'regular'): string {
  const w = weight ?? fallback;
  if (typeof w === 'number') return String(w);
  // CSS uses "normal" but Typst requires "regular"
  const normalized = w === 'normal' ? 'regular' : w;
  if (/^\d+$/.test(normalized)) {
    return normalized;
  }
  return `"${normalized}"`;
}

/** Format a hex color string for Typst (e.g. "#ff0000" → `rgb("#ff0000")`). */
export function formatColor(color: string | undefined): string {
  const c = (color ?? '').trim();
  if (!c) return 'none';
  return c.startsWith('#') ? `rgb("${c}")` : c;
}

/** Escape content for use inside Typst string literals (`"..."`). */
export function escapeStringLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Resolves or normalizes a font family name for Typst.
 * Handles legacy names or mismatches between UI and binary-parsed Typst names.
 */
export function formatFontFamily(font: string | undefined): string {
  const f = (font ?? '').trim();
  if (!f || f === 'Sarabun') return 'Sarabun';
  // Legacy map: "LINE Seed Sans TH" -> "LINE Seed Sans"
  if (f === 'LINE Seed Sans TH') return 'LINE Seed Sans';
  return f;
}

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
  flowMode?: boolean
): string {
  const parts: string[] = [];
  if (base.pageBreakBefore) parts.push('#pagebreak()\n');

  if (flowMode) {
    const x = base.x ?? 0;
    const w = base.width ?? 100;
    const h = base.height ?? 10;
    // Text components use auto-height in flow mode: Typst determines height from content,
    // avoiding the browser font-metric gap that causes extra whitespace in the preview.
    // Other components (image, table, etc.) still need an explicit height so percentage-height
    // children resolve against the correct mm value rather than the full page height.
    const isText = base.type === 'text';
    const sizedBlock = isText
      ? `#block(width: ${w}mm, clip: false)[${body}]`
      : `#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]`;
    const inner = x > 0 ? `#pad(left: ${x}mm)[${sizedBlock}]` : sizedBlock;
    // above/below: 0pt removes Typst's default inter-block spacing → rows stack flush.
    const outerHeight = isText ? '' : `, height: ${h}mm`;
    parts.push(`#block(above: 0pt, below: 0pt, width: 100%${outerHeight})[${inner}]\n`);
    return parts.join('');
  }

  const x = base.x ?? 0;
  const y = base.y ?? 0;
  const w = base.width ?? 100;
  const h = base.height ?? 20;
  const absX = offsetX + x;
  const absY = offsetY + y;

  // top + left ensures placement is always absolute from page top-left,
  // not relative to the current flow cursor (critical when body zone is in flow mode).
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

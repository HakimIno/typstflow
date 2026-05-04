import type { BaseComponent } from '@/types/schema';

/**
 * Emit a `#place(dx, dy)[#block(...)[body]]` wrapper.
 * Absolute position = zone origin (offsetX/Y) + component coords (x/y).
 * Page margin is NOT added here — margin is visual-only in the designer.
 */
export function wrapPlacement(
  base: BaseComponent,
  body: string,
  offsetX: number,
  offsetY: number
): string {
  const x = base.x ?? 0;
  const y = base.y ?? 0;
  const w = base.width ?? 100;
  const h = base.height ?? 20;
  const absX = offsetX + x;
  const absY = offsetY + y;

  const parts: string[] = [];
  if (base.pageBreakBefore) parts.push('#pagebreak()\n');
  parts.push(
    `#place(dx: ${absX}mm, dy: ${absY}mm)[#block(width: ${w}mm, height: ${h}mm, clip: false)[${body}]]\n`
  );
  return parts.join('');
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

/**
 * Page-break snippets for TypstGenerator.
 *
 * Use {@link emitFixedPageBreak} between designer-defined pages (schema.pages).
 * Those must be **strong** breaks: `#pagebreak(weak: true)` is skipped when the
 * current page is empty, which drops pages (e.g. 3000 → 2999).
 *
 * Keep `weak` only for optional component `pageBreakBefore` in flow/absolute
 * placement where a blank page should be avoided.
 */

/** Strong break — guarantees 1 schema page → 1 output page. */
export function emitFixedPageBreak(pretty = false): string {
  return pretty ? '\n#pagebreak()\n\n' : '\n#pagebreak()\n';
}

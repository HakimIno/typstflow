import { formatValue } from '@/lib/utils/formatters';
import { escapeTypst } from '@/lib/utils/typst-utils';
import type { FormatType } from '@/types/schema';
import { escapeStringLiteral } from './placement';

export function hasUnresolvedBinding(value: string): boolean {
  return value.includes('{{');
}

/**
 * Emit formatted cell/text content for Typst.
 * - Pretty export: inline formatted literals (no #fmt_* helpers).
 * - Compile path: #fmt_*() calls + preamble helpers for dynamic data.
 */
export function emitFormattedTypstContent(
  value: string,
  format: FormatType | undefined,
  pretty: boolean
): string {
  const fmt = format ?? 'text';

  if (fmt === 'text') {
    return value
      .split('\n')
      .map((line) => escapeTypst(line))
      .join(' #linebreak() ');
  }

  if (pretty) {
    if (hasUnresolvedBinding(value)) {
      return escapeTypst(value);
    }
    return escapeTypst(formatValue(value, fmt));
  }

  return `#fmt_${fmt.replace(/-/g, '_')}("${escapeStringLiteral(value)}")`;
}

import { describe, expect, it } from 'vitest';
import {
  emitFormattedTypstContent,
  hasUnresolvedBinding,
} from '@/lib/engine/generator/format-emit';

describe('format-emit', () => {
  it('detects unresolved bindings', () => {
    expect(hasUnresolvedBinding('{{invoice.total}}')).toBe(true);
    expect(hasUnresolvedBinding('1234.56')).toBe(false);
  });

  it('pretty mode inlines formatted literals', () => {
    const out = emitFormattedTypstContent('100', 'currency-thb', true);
    expect(out).not.toContain('#fmt_');
    expect(out).toMatch(/100|฿/);
  });

  it('pretty mode keeps unresolved bindings as plain text', () => {
    const out = emitFormattedTypstContent('{{invoice.total}}', 'currency-thb', true);
    expect(out).toBe('{{invoice.total}}');
    expect(out).not.toContain('#fmt_');
  });

  it('compile mode emits fmt calls', () => {
    const out = emitFormattedTypstContent('100', 'currency-thb', false);
    expect(out).toBe('#fmt_currency_thb("100")');
  });
});

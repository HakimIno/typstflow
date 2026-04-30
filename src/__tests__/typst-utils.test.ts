import { describe, it, expect } from 'vitest';
import { escapeTypst } from '../lib/utils/typst-utils';

describe('Typst Sanitization (escapeTypst)', () => {
  it('should pass through normal text without changes', () => {
    expect(escapeTypst('Hello World')).toBe('Hello World');
    expect(escapeTypst('ภาษาไทยปกติ')).toBe('ภาษาไทยปกติ');
  });

  it('should handle null or undefined gracefully', () => {
    expect(escapeTypst(null as any)).toBe('');
    expect(escapeTypst(undefined as any)).toBe('');
  });

  it('should escape command character (#)', () => {
    expect(escapeTypst('#set text')).toBe('\\#set text');
    expect(escapeTypst('Price is #50')).toBe('Price is \\#50');
  });

  it('should escape backslash (\\) correctly', () => {
    // Note: in JS string '\\' is one backslash. '\\\\' is two backslashes.
    // We want literal '\' to become literal '\\' for Typst.
    expect(escapeTypst('C:\\Path')).toBe('C:\\\\Path');
  });

  it('should escape markup characters (*, _, [, ])', () => {
    expect(escapeTypst('*bold*')).toBe('\\*bold\\*');
    expect(escapeTypst('_italic_')).toBe('\\_italic\\_');
    expect(escapeTypst('[content]')).toBe('\\[content\\]');
  });

  it('should escape other special characters (~, @, $, <, >, `)', () => {
    expect(escapeTypst('email@example.com')).toBe('email\\@example.com');
    expect(escapeTypst('Price $100')).toBe('Price \\$100');
    expect(escapeTypst('Non~breaking')).toBe('Non\\~breaking');
    expect(escapeTypst('a < b > c')).toBe('a \\< b \\> c');
    expect(escapeTypst('`code`')).toBe('\\`code\\`');
  });

  it('should handle complex mixed strings', () => {
    const input = 'Check #1: *Bold* \\ path [nested] @ref $math$';
    const expected = 'Check \\#1: \\*Bold\\* \\\\ path \\[nested\\] \\@ref \\$math\\$';
    expect(escapeTypst(input)).toBe(expected);
  });

  it('should not break Thai language characters', () => {
    expect(escapeTypst('ราคาสินค้า #100 บาท')).toBe('ราคาสินค้า \\#100 บาท');
  });
});

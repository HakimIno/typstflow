import type { LayoutSchema } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import {
  isPageEmptyForExport,
  schemaNeedsCodetasticImports,
  schemaNeedsFormatHelpers,
} from '@/lib/engine/generator/schema-analysis';

const BASE: LayoutSchema = {
  id: 'test',
  name: 'Test',
  version: '1.0.0',
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  },
  fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
  zones: {
    header: { id: 'header', components: [] },
    footer: { id: 'footer', components: [] },
  },
  pages: [
    { id: 'p1', name: 'Page 1', body: { id: 'b1', components: [] } },
    {
      id: 'p2',
      name: 'Page 2',
      body: {
        id: 'b2',
        components: [{ id: 't1', type: 'text', x: 0, y: 0, width: 50, height: 10, content: 'Hi' }],
      },
    },
  ],
  groups: [],
  variables: [],
  dataSchema: [],
  metadata: {
    title: 'Test',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    author: 'test',
  },
};

describe('schema-analysis', () => {
  it('detects empty vs non-empty pages', () => {
    expect(isPageEmptyForExport(BASE, 0)).toBe(true);
    expect(isPageEmptyForExport(BASE, 1)).toBe(false);
  });

  it('detects codetastic imports from qr/barcode components', () => {
    expect(schemaNeedsCodetasticImports(BASE)).toBe(false);
    const withQr: LayoutSchema = {
      ...BASE,
      pages: [
        {
          ...BASE.pages[0],
          body: {
            id: 'b',
            components: [{ id: 'q', type: 'qr', x: 0, y: 0, width: 10, height: 10, value: 'x' }],
          },
        },
      ],
    };
    expect(schemaNeedsCodetasticImports(withQr)).toBe(true);
  });

  it('detects format helpers from formatted text/table cells', () => {
    expect(schemaNeedsFormatHelpers(BASE)).toBe(false);
    const withFmt: LayoutSchema = {
      ...BASE,
      pages: [
        {
          ...BASE.pages[0],
          body: {
            id: 'b',
            components: [
              {
                id: 'n',
                type: 'text',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                content: '1',
                format: 'number',
              },
            ],
          },
        },
      ],
    };
    expect(schemaNeedsFormatHelpers(withFmt)).toBe(true);
  });

  it('detects format helpers from table column formats', () => {
    const withTableFmt: LayoutSchema = {
      ...BASE,
      pages: [
        {
          ...BASE.pages[0],
          body: {
            id: 'b',
            components: [
              {
                id: 'tbl',
                type: 'table',
                x: 0,
                y: 0,
                width: 180,
                height: 50,
                columns: [{ field: 'amount', header: 'Amount', format: 'currency-thb' }],
              },
            ],
          },
        },
      ],
    };
    expect(schemaNeedsFormatHelpers(withTableFmt)).toBe(true);
  });
});

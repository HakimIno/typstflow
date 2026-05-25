import type { LayoutSchema } from '@/types/schema';
import { describe, expect, it } from 'vitest';
import { SERVER_EXPORT_PAGE_THRESHOLD } from '@/lib/export/constants';
import { getExportPageCount, shouldUseServerExport } from '@/lib/export/page-count';

function makeSchema(pageCount: number, batchDataSource?: string): LayoutSchema {
  return {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    },
    fonts: [],
    zones: {
      header: { id: 'h', components: [] },
      footer: { id: 'f', components: [] },
    },
    pages: Array.from({ length: pageCount }, (_, i) => ({
      id: `p-${i}`,
      name: `Page ${i + 1}`,
      body: { id: 'body', components: [] },
    })),
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'T', createdAt: '', updatedAt: '', author: '' },
    batchDataSource,
  };
}

describe('getExportPageCount', () => {
  it('returns schema page count without batch', () => {
    expect(getExportPageCount(makeSchema(100), {})).toBe(100);
  });

  it('multiplies by batch items when batchDataSource is set', () => {
    const schema = makeSchema(10, 'items');
    const data = { items: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    expect(getExportPageCount(schema, data)).toBe(30);
  });
});

describe('shouldUseServerExport', () => {
  it('uses WASM for documents at threshold', () => {
    expect(shouldUseServerExport(makeSchema(SERVER_EXPORT_PAGE_THRESHOLD), {})).toBe(false);
  });

  it('uses server above threshold', () => {
    expect(shouldUseServerExport(makeSchema(SERVER_EXPORT_PAGE_THRESHOLD + 1), {})).toBe(true);
  });
});

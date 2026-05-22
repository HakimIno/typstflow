import { BLANK_SCHEMA } from '@/store/store-utils';
import { describe, expect, it } from 'vitest';
import {
  SchemaImportError,
  countSchemaComponents,
  normalizeImportedSchema,
  parseImportBundle,
} from '@/lib/utils/schema-import';
import fs from 'node:fs';

describe('schema-import', () => {
  it('rejects sample-data-only JSON', () => {
    expect(() => parseImportBundle(JSON.stringify({ items: [{ id: 1 }] }))).toThrow(
      SchemaImportError
    );
  });

  it('normalizes missing fonts and orientation case', () => {
    const raw = JSON.parse(
      fs.readFileSync('json/new-report-2026-05-05.json', 'utf8')
    ) as Record<string, unknown>;
    delete raw.fonts;
    raw.page = { ...(raw.page as object), orientation: 'Portrait' };

    const normalized = normalizeImportedSchema(raw);
    expect(normalized.fonts).toBeTruthy();
    expect((normalized.page as { orientation: string }).orientation).toBe('portrait');

    const { schema } = parseImportBundle(JSON.stringify(normalized));
    expect(schema.zones.header.components.length).toBeGreaterThan(0);
    expect(countSchemaComponents(schema)).toBeGreaterThan(10);
  });

  it('imports bundled export format', () => {
    const bundle = fs.readFileSync('json/new-report-bundle-2026-05-07.json', 'utf8');
    const { schema, data } = parseImportBundle(bundle);
    expect(schema.name).toBe('New Report');
    expect(schema.zones.header.components.length).toBe(6);
    expect(data).not.toBeNull();
  });

  it('migrates legacy zones.body to pages[0].body', () => {
    const legacy = {
      page: BLANK_SCHEMA.page,
      fonts: BLANK_SCHEMA.fonts,
      zones: {
        header: { id: 'header', components: [] },
        footer: { id: 'footer', components: [] },
        body: {
          id: 'body',
          components: [{ id: 't1', type: 'text', x: 0, y: 0, width: 50, height: 10, content: 'Hi' }],
        },
      },
      metadata: BLANK_SCHEMA.metadata,
    };
    const { schema } = parseImportBundle(JSON.stringify(legacy));
    expect(schema.pages[0].body.components).toHaveLength(1);
  });

  it('throws on structurally invalid schema', () => {
    expect(() =>
      parseImportBundle(
        JSON.stringify({
          page: BLANK_SCHEMA.page,
          fonts: BLANK_SCHEMA.fonts,
          zones: {
            header: { id: 'header', components: [{ id: 'x', type: 123 }] },
            footer: { id: 'footer', components: [] },
          },
          pages: [{ id: 'p1', name: 'P1', body: { id: 'body', components: [] } }],
          metadata: BLANK_SCHEMA.metadata,
        })
      )
    ).toThrow(SchemaImportError);
  });
});

import { shareSchemaStructure } from '@/lib/utils/schema-structure';
import type { LayoutSchema, TextComponent } from '@/types/schema';
import { describe, expect, it } from 'vitest';

function makeText(id: string): TextComponent {
  return { id, type: 'text', x: 0, y: 0, width: 80, height: 10, content: id, style: { fontSize: 10 } };
}

function makeMultiPageSchema(pageCount: number): LayoutSchema {
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    id: `page-${i + 1}`,
    name: `Page ${i + 1}`,
    body: { id: `body-${i + 1}`, components: [makeText(`p${i + 1}-c1`)] },
  }));
  return {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    },
    fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
    zones: { header: { id: 'header', components: [] }, footer: { id: 'footer', components: [] } },
    pages,
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'Test', createdAt: '', updatedAt: '', author: 'test' },
  };
}

describe('shareSchemaStructure', () => {
  it('reuses unchanged page objects when only metadata changes', () => {
    const prev = makeMultiPageSchema(100);
    const next = { ...prev, metadata: { ...prev.metadata, updatedAt: '2026-01-01' } };

    const shared = shareSchemaStructure(prev, next);

    expect(shared.metadata.updatedAt).toBe('2026-01-01');
    expect(shared.pages).toHaveLength(100);
    expect(shared.pages[0]).toBe(prev.pages[0]);
    expect(shared.pages[99]).toBe(prev.pages[99]);
  });

  it('reuses unchanged pages when only one page body is edited', () => {
    const prev = makeMultiPageSchema(10);
    const next = {
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === 3
          ? {
              ...p,
              body: { ...p.body, components: [{ ...p.body.components[0], x: 42 }] },
            }
          : p
      ),
    };

    const shared = shareSchemaStructure(prev, next);

    expect(shared.pages[0]).toBe(prev.pages[0]);
    expect(shared.pages[3]).not.toBe(prev.pages[3]);
    expect(shared.pages[9]).toBe(prev.pages[9]);
  });

  it('preserves layoutMode when toggling flow on an unchanged-components zone', () => {
    const prev = makeMultiPageSchema(3);
    const next = {
      ...prev,
      pages: prev.pages.map((p, i) =>
        i === 0 ? { ...p, body: { ...p.body, layoutMode: 'flow' as const } } : p
      ),
    };

    const shared = shareSchemaStructure(prev, next);

    expect(shared.pages[0].body.layoutMode).toBe('flow');
    expect(shared.pages[1]).toBe(prev.pages[1]);
  });
});

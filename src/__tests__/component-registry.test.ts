import { describe, expect, it } from 'vitest';
import type { LayoutSchema, TextComponent } from '@/types/schema';
import { BLANK_SCHEMA } from '@/store/store-utils';
import { buildComponentRegistry, patchComponentRegistry } from '@/lib/utils/component-registry';

function makeText(id: string): TextComponent {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 80,
    height: 10,
    content: id,
    style: { fontSize: 10 },
  };
}

function makeSchema(bodyComponentCount = 3): LayoutSchema {
  return {
    ...BLANK_SCHEMA,
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: {
          id: 'body-1',
          components: Array.from({ length: bodyComponentCount }, (_, i) => makeText(`c${i + 1}`)),
        },
      },
    ],
  };
}

describe('patchComponentRegistry', () => {
  it('reuses unchanged component references', () => {
    const schema = makeSchema(3);
    const registry = buildComponentRegistry(schema);

    const updated = {
      ...schema,
      pages: schema.pages.map((p) => ({
        ...p,
        body: {
          ...p.body,
          components: p.body.components.map((c) => (c.id === 'c1' ? { ...c, x: 42 } : c)),
        },
      })),
    };

    const patched = patchComponentRegistry(registry, schema, updated);
    expect(patched['c1'].x).toBe(42);
    expect(patched['c2']).toBe(registry['c2']);
    expect(patched['c3']).toBe(registry['c3']);
  });

  it('falls back to full rebuild when page count changes', () => {
    const schema = makeSchema(2);
    const registry = buildComponentRegistry(schema);
    const updated = {
      ...schema,
      pages: [
        ...schema.pages,
        {
          id: 'page-2',
          name: 'Page 2',
          body: { id: 'body-2', components: [makeText('c-new')] },
        },
      ],
    };

    const patched = patchComponentRegistry(registry, schema, updated);
    expect(Object.keys(patched)).toContain('c-new');
    expect(Object.keys(patched)).toHaveLength(3);
  });
});

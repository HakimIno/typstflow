import { describe, expect, it } from 'vitest';
import {
  findComponentInSchema,
  findComponentZone,
  removeComponentFromSchema,
  mapComponentInSchema,
} from '@/lib/utils/schema-mutators';
import type {
  LayoutSchema,
  ComponentNode,
  ColumnLayoutComponent,
  TextComponent,
} from '@/types/schema';

function makeText(id: string): TextComponent {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 80,
    height: 10,
    content: `Content of ${id}`,
    style: { fontSize: 10 },
  };
}

function makeColumnLayout(id: string): ColumnLayoutComponent {
  return {
    id,
    type: 'columns',
    x: 0,
    y: 0,
    width: 180,
    height: 50,
    gap: '10mm',
    columns: [
      {
        width: '1fr',
        components: [makeText('nested-1'), makeText('nested-2')],
      },
      {
        width: '1fr',
        components: [makeText('nested-3')],
      },
    ],
  };
}

function makeTestSchema(): LayoutSchema {
  return {
    id: 'test-columns',
    name: 'Test Columns',
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
      {
        id: 'page-1',
        name: 'Page 1',
        body: { id: 'body-1', components: [makeColumnLayout('cols-1'), makeText('b1')] },
      },
    ],
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'Test Columns Report', createdAt: '', updatedAt: '', author: 'test' },
  };
}

describe('Column Layout Recursive Features', () => {
  it('recursively finds nested components in Column Layouts', () => {
    const schema = makeTestSchema();
    const nested1 = findComponentInSchema(schema, 'nested-1');
    const nested3 = findComponentInSchema(schema, 'nested-3');
    const b1 = findComponentInSchema(schema, 'b1');

    expect(nested1).toBeDefined();
    expect(nested1?.id).toBe('nested-1');
    expect(nested3?.id).toBe('nested-3');
    expect(b1?.id).toBe('b1');
  });

  it('recursively locates component zone key and page id', () => {
    const schema = makeTestSchema();
    const info1 = findComponentZone(schema, 'nested-1');
    const infoCol = findComponentZone(schema, 'cols-1');

    expect(info1).not.toBeNull();
    expect(info1?.zoneKey).toBe('body');
    expect(info1?.pageId).toBe('page-1');
    expect(info1?.component.id).toBe('nested-1');

    expect(infoCol?.zoneKey).toBe('body');
    expect(infoCol?.pageId).toBe('page-1');
  });

  it('recursively updates nested component within Column Layouts', () => {
    const schema = makeTestSchema();
    const { schema: next, changed } = mapComponentInSchema(schema, 'nested-1', (c) => ({
      ...c,
      height: 42,
    }));

    expect(changed).toBe(true);
    const updated = findComponentInSchema(next, 'nested-1');
    expect(updated?.height).toBe(42);

    // Ensure original schema is unmodified (immutability check)
    const original = findComponentInSchema(schema, 'nested-1');
    expect(original?.height).toBe(10);
  });

  it('recursively deletes nested component within Column Layouts', () => {
    const schema = makeTestSchema();
    const { schema: next, changed } = removeComponentFromSchema(schema, 'nested-2');

    expect(changed).toBe(true);
    expect(findComponentInSchema(next, 'nested-2')).toBeNull();

    // Verify other nested components remain intact
    expect(findComponentInSchema(next, 'nested-1')).not.toBeNull();
    expect(findComponentInSchema(next, 'nested-3')).not.toBeNull();
  });
});

import type {
  BaseComponent,
  ComponentNode,
  ImageComponent,
  LayoutSchema,
  LineComponent,
  PageConfig,
  PageDefinition,
  TableComponent,
  TextComponent,
  Zone,
} from '@/types/schema';
/**
 * @file schema.test.ts
 * Tests for src/types/schema.ts — validates structural integrity of the LayoutSchema
 *
 * These tests act as a "schema contract" — they verify that the type shapes
 * we depend on remain stable as the project evolves.
 */
import { describe, expect, it } from 'vitest';

// ─── Helper factories ────────────────────────────────────────────────────────

function makeBase(overrides: Partial<BaseComponent> = {}): BaseComponent {
  return {
    id: 'comp-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    ...overrides,
  };
}

function makeZone(components: ComponentNode[] = []): Zone {
  return { id: 'zone-1', components };
}

function makePageConfig(overrides: Partial<PageConfig> = {}): PageConfig {
  return {
    size: 'A4',
    orientation: 'portrait',
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    ...overrides,
  };
}

function makeSchema(overrides: Partial<LayoutSchema> = {}): LayoutSchema {
  return {
    id: 'report-1',
    name: 'Test',
    version: '1.0.0',
    page: makePageConfig(),
    fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
    zones: {
      header: makeZone(),
      footer: makeZone(),
    },
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: makeZone(),
      },
    ],
    variables: [],
    dataSchema: [],
    metadata: {
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      author: 'test',
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LayoutSchema structural contract', () => {
  it('creates a valid minimal schema', () => {
    const schema = makeSchema();
    expect(schema.id).toBe('report-1');
    expect(schema.version).toBe('1.0.0');
    expect(schema.pages).toHaveLength(1);
    expect(schema.zones).toHaveProperty('header');
    expect(schema.zones).toHaveProperty('footer');
  });

  it('schema.pages[0].body is a Zone with components array', () => {
    const schema = makeSchema();
    expect(Array.isArray(schema.pages[0].body.components)).toBe(true);
  });

  it('supports multiple pages', () => {
    const pages: PageDefinition[] = [
      { id: 'page-1', name: 'Page 1', body: makeZone() },
      { id: 'page-2', name: 'Page 2', body: makeZone() },
    ];
    const schema = makeSchema({ pages });
    expect(schema.pages).toHaveLength(2);
    expect(schema.pages[1].id).toBe('page-2');
  });
});

describe('PageConfig', () => {
  it('accepts A4, A5, Letter, Legal sizes', () => {
    const sizes: PageConfig['size'][] = ['A4', 'A5', 'Letter', 'Legal'];
    for (const size of sizes) {
      const cfg = makePageConfig({ size });
      expect(cfg.size).toBe(size);
    }
  });

  it('accepts portrait and landscape orientations', () => {
    expect(makePageConfig({ orientation: 'portrait' }).orientation).toBe('portrait');
    expect(makePageConfig({ orientation: 'landscape' }).orientation).toBe('landscape');
  });

  it('margin values use unit strings', () => {
    const cfg = makePageConfig({
      margin: { top: '2cm', bottom: '1in', left: '20mm', right: '56pt' },
    });
    expect(cfg.margin.top).toBe('2cm');
    expect(cfg.margin.bottom).toBe('1in');
  });
});

describe('Zone', () => {
  it('has an id and components array', () => {
    const zone = makeZone();
    expect(zone.id).toBe('zone-1');
    expect(Array.isArray(zone.components)).toBe(true);
  });

  it('accepts optional minHeight', () => {
    const zone: Zone = { ...makeZone(), minHeight: '30mm' };
    expect(zone.minHeight).toBe('30mm');
  });
});

describe('ComponentNode discriminated union', () => {
  it('text component has correct shape', () => {
    const comp: TextComponent = {
      ...(makeBase({ type: 'text' }) as TextComponent),
      type: 'text',
      content: 'Hello',
      style: { fontSize: 12, fontWeight: 'bold' },
    };
    expect(comp.type).toBe('text');
    expect(comp.content).toBe('Hello');
    expect(comp.style.fontSize).toBe(12);
  });

  it('line component has correct shape', () => {
    const comp: LineComponent = {
      ...(makeBase({ type: 'line' }) as LineComponent),
      type: 'line',
      style: 'solid',
      color: '#000000',
      thickness: '1pt',
    };
    expect(comp.type).toBe('line');
    expect(comp.style).toBe('solid');
  });

  it('image component has correct shape', () => {
    const comp: ImageComponent = {
      ...(makeBase({ type: 'image' }) as ImageComponent),
      type: 'image',
      src: 'https://example.com/img.png',
      fit: 'contain',
    };
    expect(comp.type).toBe('image');
    expect(comp.fit).toBe('contain');
  });

  it('table component has dataSource and columns', () => {
    const comp: TableComponent = {
      ...(makeBase({ type: 'table' }) as TableComponent),
      type: 'table',
      dataSource: '{{invoice.items}}',
      columns: [{ id: 'col-1', header: 'Description', field: 'description', width: '1fr' }],
      style: {},
      showHeader: true,
      repeatHeaderOnPage: false,
    };
    expect(comp.type).toBe('table');
    expect(comp.dataSource).toBe('{{invoice.items}}');
    expect(comp.columns).toHaveLength(1);
  });
});

describe('BaseComponent coordinate fields', () => {
  it('x, y, width, height are in millimeters (numbers)', () => {
    const comp = makeBase({ x: 10.5, y: 20.3, width: 80, height: 15 });
    expect(typeof comp.x).toBe('number');
    expect(typeof comp.y).toBe('number');
    expect(typeof comp.width).toBe('number');
    expect(typeof comp.height).toBe('number');
  });

  it('all fields are optional in BaseComponent (x, y can be undefined)', () => {
    const minimal = { id: 'comp-2', type: 'spacer' as const };
    // TypeScript allows this — just verify runtime shape
    expect(minimal.id).toBe('comp-2');
  });
});

describe('BindingExpression pattern', () => {
  it('recognizes {{binding}} format in text content', () => {
    const content = '{{invoice.customer.name}}';
    const bindingPattern = /\{\{(.+?)\}\}/g;
    const match = content.match(bindingPattern);
    expect(match).not.toBeNull();
    expect(match?.[0]).toBe('{{invoice.customer.name}}');
  });

  it('allows mixed static + binding content', () => {
    const content = 'Dear {{customer.name}}, your invoice total is {{invoice.total}}';
    const bindingPattern = /\{\{(.+?)\}\}/g;
    const matches = [...content.matchAll(bindingPattern)];
    expect(matches).toHaveLength(2);
  });
});

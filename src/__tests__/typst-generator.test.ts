import { TypstGenerator } from '@/lib/engine/typst-generator';
import type { LayoutSchema } from '@/types/schema';
/**
 * @file typst-generator.test.ts
 * Tests for src/lib/engine/typst-generator.ts — TypstGenerator
 *
 * Focus: output structure correctness, binding resolution, escaping.
 * Does NOT test WASM rendering (integration test only).
 */
import { describe, expect, it } from 'vitest';

const MINIMAL_SCHEMA: LayoutSchema = {
  id: 'test-report',
  name: 'Test Report',
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
  pages: [{ id: 'page-1', name: 'Page 1', body: { id: 'body', components: [] } }],
  groups: [],
  variables: [],
  dataSchema: [],
  metadata: {
    title: 'Test Report',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    author: 'test',
  },
};

function makeGenerator(schema = MINIMAL_SCHEMA, data: Record<string, any> = {}) {
  return new TypstGenerator(schema, data);
}

describe('TypstGenerator — page setup', () => {
  it('generates correct #set page() for A4 portrait', () => {
    const output = makeGenerator().generate();
    expect(output).toContain('paper: "a4"');
    expect(output).toContain('flipped: false');
    expect(output).toContain('margin: (top: 15mm, bottom: 15mm, left: 15mm, right: 15mm)');
  });

  it('sets flipped: true for landscape orientation', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      page: { ...MINIMAL_SCHEMA.page, orientation: 'landscape' },
    };
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('flipped: true');
  });

  it('generates correct #set text() with font family and size', () => {
    const output = makeGenerator().generate();
    expect(output).toContain('#set text(font: "Sarabun", size: 10pt');
  });
});

describe('TypstGenerator — empty schema produces no zone blocks', () => {
  it('generates no band blocks when all zones are empty', () => {
    const output = makeGenerator().generate();
    // No #block(width: 100%...) for empty zones
    expect(output).not.toContain('#block(width: 100%');
  });
});

describe('TypstGenerator — text component', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: {
          id: 'body',
          components: [
            {
              id: 'text-1',
              type: 'text',
              x: 10,
              y: 10,
              width: 80,
              height: 10,
              content: 'Hello World',
              style: { fontSize: 12, fontWeight: 'bold' },
            },
          ],
        },
      },
    ],
  };

  it('renders text inside a #place directive', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('#place(dx: 10mm, dy: 10mm)');
    expect(output).toContain('Hello World');
  });

  it('renders bold text weight', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('weight: "bold"');
  });

  it('renders font size from style', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('size: 12pt');
  });
});

describe('TypstGenerator — data binding resolution', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: {
          id: 'body',
          components: [
            {
              id: 'text-bound',
              type: 'text',
              x: 0,
              y: 0,
              width: 100,
              height: 10,
              content: '{{customer.name}}',
              style: {},
            },
          ],
        },
      },
    ],
  };

  it('resolves binding to data value', () => {
    const data = { customer: { name: 'Alice' } };
    const output = new TypstGenerator(schema, data).generate();
    expect(output).toContain('Alice');
    expect(output).not.toContain('{{customer.name}}');
  });

  it('keeps binding placeholder when data is missing', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('{{customer.name}}');
  });
});

describe('TypstGenerator — escapeTypst', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: {
          id: 'body',
          components: [
            {
              id: 'text-special',
              type: 'text',
              x: 0,
              y: 0,
              width: 100,
              height: 10,
              content: 'Price: #100 *bold* _italic_',
              style: {},
            },
          ],
        },
      },
    ],
  };

  it('escapes Typst special characters: # * _', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('\\#100');
    expect(output).toContain('\\*bold\\*');
    expect(output).toContain('\\_italic\\_');
  });
});

describe('TypstGenerator — line component', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    zones: {
      header: {
        id: 'header',
        components: [
          {
            id: 'line-1',
            type: 'line',
            x: 0,
            y: 0,
            width: 100,
            height: 1,
            style: 'solid',
            color: 'black',
            thickness: '1pt',
          },
        ],
      },
      footer: { id: 'footer', components: [] },
    },
  };

  it('renders #line() with stroke', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('#line(length: 100%');
    expect(output).toContain('1pt + black');
  });
});

describe('TypstGenerator — multi-page output', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: {
          id: 'body',
          components: [
            {
              id: 'text-p1',
              type: 'text',
              x: 0,
              y: 0,
              width: 100,
              height: 10,
              content: 'Page 1 content',
              style: {},
            },
          ],
        },
      },
      {
        id: 'page-2',
        name: 'Page 2',
        body: {
          id: 'body',
          components: [
            {
              id: 'text-p2',
              type: 'text',
              x: 0,
              y: 0,
              width: 100,
              height: 10,
              content: 'Page 2 content',
              style: {},
            },
          ],
        },
      },
    ],
  };

  it('inserts #pagebreak() between pages', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('#pagebreak()');
  });

  it('does not add #pagebreak() after the last page', () => {
    const output = new TypstGenerator(schema, {}).generate();
    // Only 1 pagebreak for 2 pages
    const count = (output.match(/#pagebreak\(\)/g) || []).length;
    expect(count).toBe(1);
  });

  it('renders content from both pages', () => {
    const output = new TypstGenerator(schema, {}).generate();
    expect(output).toContain('Page 1 content');
    expect(output).toContain('Page 2 content');
  });
});

describe('TypstGenerator — image component (remote vs local)', () => {
  const makeImageSchema = (src: string): LayoutSchema => ({
    ...MINIMAL_SCHEMA,
    zones: {
      header: {
        id: 'header',
        components: [
          {
            id: 'img-1',
            type: 'image',
            x: 0,
            y: 0,
            width: 50,
            height: 30,
            src,
          },
        ],
      },
      footer: { id: 'footer', components: [] },
    },
  });

  it('renders #image() for remote URLs', () => {
    const output = new TypstGenerator(
      makeImageSchema('https://example.com/logo.png'),
      {}
    ).generate();
    expect(output).toContain('#image("https://example.com/logo.png"');
  });

  it('renders FILE NOT FOUND placeholder for local paths', () => {
    const output = new TypstGenerator(makeImageSchema('./local/logo.png'), {}).generate();
    expect(output).toContain('FILE NOT FOUND');
    expect(output).toContain('./local/logo.png');
  });
});

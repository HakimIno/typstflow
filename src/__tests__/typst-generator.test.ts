/**
 * @file typst-generator.test.ts
 * Tests for the plugin-based TypstGenerator (src/lib/engine/generator/).
 * Focus: output structure, binding resolution, escaping, plugin dispatch.
 * Does NOT test WASM rendering (integration test only).
 */
import { TypstGenerator } from '@/lib/engine/generator';
import type { LayoutSchema } from '@/types/schema';
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

const gen = new TypstGenerator();
const generate = (schema = MINIMAL_SCHEMA, data: Record<string, unknown> = {}) =>
  gen.generate(schema, data);

describe('TypstGenerator — page setup', () => {
  it('generates correct #set page() for A4 portrait', () => {
    const output = generate();
    expect(output).toContain('paper: "a4"');
    expect(output).toContain('flipped: false');
    // Margin is always 0mm — designer margin is visual-only
    expect(output).toContain('margin: 0mm');
  });

  it('sets flipped: true for landscape orientation', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      page: { ...MINIMAL_SCHEMA.page, orientation: 'landscape' },
    };
    const output = generate(schema);
    expect(output).toContain('flipped: true');
  });

  it('generates correct #set text() with font family and size', () => {
    const output = generate();
    expect(output).toContain('size: 10pt');
    expect(output).toContain('"Sarabun"');
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
    const output = generate(schema);
    // body offsetY = headerMinHeight = 0, so text at y=10 → dy: 10mm
    expect(output).toContain('#place(top + left, dx: 10mm, dy: 10mm)');
    expect(output).toContain('Hello World');
  });

  it('renders bold text weight', () => {
    const output = generate(schema);
    expect(output).toContain('weight: "bold"');
  });

  it('renders font size from style', () => {
    const output = generate(schema);
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
    const output = generate(schema, { customer: { name: 'Alice' } });
    expect(output).toContain('Alice');
    expect(output).not.toContain('{{customer.name}}');
  });

  it('keeps binding placeholder when data is missing', () => {
    const output = generate(schema);
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
    const output = generate(schema);
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
            color: '#000000',
            thickness: '1pt',
          },
        ],
      },
      footer: { id: 'footer', components: [] },
    },
  };

  it('renders #line() with stroke', () => {
    const output = generate(schema);
    expect(output).toContain(
      '#line(start: (0%, 50%), end: (100%, 50%), stroke: (paint: rgb("#000000"), thickness: 1pt, cap: "butt"))'
    );
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
    const output = generate(schema);
    expect(output).toContain('#pagebreak(');
  });

  it('renders content from both pages', () => {
    const output = generate(schema);
    expect(output).toContain('Page 1 content');
    expect(output).toContain('Page 2 content');
  });
});

describe('TypstGenerator — image component', () => {
  const makeImageSchema = (src: string): LayoutSchema => ({
    ...MINIMAL_SCHEMA,
    zones: {
      header: {
        id: 'header',
        components: [{ id: 'img-1', type: 'image', x: 0, y: 0, width: 50, height: 30, src }],
      },
      footer: { id: 'footer', components: [] },
    },
  });

  it('renders #image() for virtual asset paths', () => {
    const output = generate(makeImageSchema('asset-logo.png'));
    expect(output).toContain('#image("asset-logo.png"');
  });

  it('renders FILE NOT FOUND for unknown paths', () => {
    const output = generate(makeImageSchema('./local/logo.png'));
    expect(output).toContain('FILE NOT FOUND');
  });

  it('renders No Image placeholder for empty src', () => {
    const output = generate(makeImageSchema(''));
    expect(output).toContain('No Image');
  });
});

describe('TypstGenerator — plugin override', () => {
  it('allows overriding a built-in plugin', () => {
    const customGen = new TypstGenerator([
      {
        type: 'text',
        render: () => '// custom-text-render\n',
      },
    ]);
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            components: [{ id: 'txt', type: 'text', content: 'Hello', style: {} }],
          },
        },
      ],
    };
    const output = customGen.generate(schema, {});
    expect(output).toContain('// custom-text-render');
    expect(output).not.toContain('Hello');
  });
});

// ── Flow Zone Mode ─────────────────────────────────────────────────────────────────

describe('TypstGenerator — flow zone mode', () => {
  it('uses #block() without #place() in flow mode', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            layoutMode: 'flow',
            components: [
              {
                id: 'text-1',
                type: 'text',
                content: 'Hello',
                x: 10,
                y: 10,
                width: 80,
                height: 10,
                style: {},
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(schema, {});
    // x=10 → pad left; width=80 → sized inner block; outer block suppresses spacing
    expect(output).toContain('#pad(left: 10mm)');
    expect(output).toContain('#block(width: 80mm, clip: false)');
    expect(output).toContain('above: 0pt, below: 2pt');
    expect(output).not.toContain('#place(');
  });

  it('adds gap (#v) between flow components', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            layoutMode: 'flow',
            flowGap: '3mm',
            components: [
              {
                id: 'text-1',
                type: 'text',
                content: 'A',
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                style: {},
              },
              {
                id: 'text-2',
                type: 'text',
                content: 'B',
                x: 0,
                y: 20,
                width: 80,
                height: 10,
                style: {},
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(schema, {});
    expect(output).toContain('#v(3mm)');
  });

  it('uses no gap (#v) when flowGap not set (default 0mm matches designer)', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            layoutMode: 'flow',
            components: [
              {
                id: 'text-1',
                type: 'text',
                content: 'A',
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                style: {},
              },
              {
                id: 'text-2',
                type: 'text',
                content: 'B',
                x: 0,
                y: 20,
                width: 80,
                height: 10,
                style: {},
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(schema, {});
    expect(output).not.toContain('#v(2mm)');
  });

  it('injects native page margins and header/footer bands when header has height', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      zones: {
        header: { id: 'header', minHeight: '30mm', components: [], repeatOnEveryPage: true },
        footer: { id: 'footer', minHeight: '15mm', components: [], repeatOnEveryPage: true },
      },
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            layoutMode: 'flow',
            components: [
              {
                id: 'text-1',
                type: 'text',
                content: 'Hello',
                x: 0,
                y: 0,
                width: 80,
                height: 10,
                style: {},
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(schema, {});
    expect(output).toContain('margin: (top: 30mm, bottom: 15mm');
    expect(output).toContain('#set page(header:');
    expect(output).toContain('#set page(footer:');
    // Body flow must NOT have a leading #v() offset — native margin handles it
    const bodyIdx = output.indexOf('// --- PAGE 1 BODY ---');
    const bodySection = output.slice(bodyIdx);
    expect(bodySection.startsWith('// --- PAGE 1 BODY ---\n#block(')).toBe(true);
  });

  it('absolute mode (default) still uses #place()', () => {
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
                content: 'Hello',
                x: 10,
                y: 10,
                width: 80,
                height: 10,
                style: {},
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(schema, {});
    expect(output).toContain('#place(');
    expect(output).not.toContain('#block(width: 100%, clip: false)');
  });

  it('does not use component y as vertical spacing for flow tables', () => {
    const schema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            layoutMode: 'flow',
            components: [
              {
                id: 'table-1',
                type: 'table',
                x: 10,
                y: 80,
                width: 100,
                height: 30,
                dataSource: '{{items}}',
                showHeader: true,
                repeatHeaderOnPage: true,
                columns: [{ id: 'c1', header: 'Header', field: 'field', width: '1fr' }],
                style: {},
              },
            ],
          },
        },
      ],
    };

    const output = new TypstGenerator().generate(schema, { items: [{ field: 'A' }] });

    expect(output).toContain('#pad(left: 10mm)');
    expect(output).not.toContain('top: 80mm');
  });
});

describe('TypstGenerator — table component', () => {
  it('emits exact millimeter column widths resolved from the designer component width', () => {
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
                id: 'table-1',
                type: 'table',
                x: 10,
                y: 20,
                width: 100,
                height: 30,
                dataSource: '{{items}}',
                showHeader: true,
                repeatHeaderOnPage: true,
                columns: [
                  { id: 'c1', header: 'A', field: 'a', width: '30mm' },
                  { id: 'c2', header: 'B', field: 'b', width: '1fr' },
                  { id: 'c3', header: 'C', field: 'c', width: '20%' },
                ],
                style: {},
              },
            ],
          },
        },
      ],
    };

    const output = generate(schema, { items: [{ a: '1', b: '2', c: '3' }] });

    expect(output).toContain('columns: (30mm, 50mm, 20mm)');
    expect(output).not.toContain('1fr');
  });
});

describe('TypstGenerator — pretty export', () => {
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
              id: 'title-text',
              type: 'text',
              name: 'Document Title',
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

  it('includes document banner and section headers', () => {
    const output = gen.generate(schema, {}, { pretty: true });
    expect(output).toContain('Exported from TypstFlow');
    expect(output).toContain('// --- Imports ---');
    expect(output).toContain('// --- Page Setup ---');
    expect(output).toContain('// --- Document Typography ---');
    expect(output).toContain('// --- Report Content ---');
  });

  it('labels components and formats #place blocks on multiple lines', () => {
    const output = gen.generate(schema, {}, { pretty: true });
    expect(output).toContain('// ── text · Document Title · Hello World ──');
    expect(output).toContain('#place(');
    expect(output).toContain('  dx: 10mm,');
    expect(output).toContain('  dy: 10mm,');
    expect(output).toMatch(/#set text\(\n\s+size: 12pt,/);
  });

  it('compact mode stays single-line for #place', () => {
    const output = gen.generate(schema, {}, { pretty: false });
    expect(output).toContain('#place(top + left, dx: 10mm, dy: 10mm)');
    expect(output).not.toContain('Exported from TypstFlow');
  });
});

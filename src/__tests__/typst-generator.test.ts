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

  it('renders vertical alignment, tabular numbers, background padding, radius and fallback alignment', () => {
    const customSchema: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          body: {
            id: 'body',
            components: [
              {
                id: 'text-custom',
                type: 'text',
                x: 10,
                y: 10,
                width: 80,
                height: 10,
                content: 'Aligned text',
                style: {
                  fontSize: 10,
                  align: 'center',
                  verticalAlign: 'middle',
                  numberWidth: 'tabular',
                  background: '#ff0000',
                  backgroundPadding: '8pt',
                  backgroundRadius: '4pt',
                },
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(customSchema, {});
    expect(output).toContain('set align(horizon + center)');
    expect(output).toContain('number-width: "tabular"');
    expect(output).toContain(
      '#block(fill: rgb("#ff0000"), width: 100%, height: 100%, inset: 8pt, radius: 4pt)'
    );
  });

  it('omits height: 100% in flow mode background block', () => {
    const flowSchema: LayoutSchema = {
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
                id: 'text-flow-bg',
                type: 'text',
                content: 'Flow bg text',
                style: {
                  background: '#00ff00',
                },
              },
            ],
          },
        },
      ],
    };
    const output = new TypstGenerator().generate(flowSchema, {});
    expect(output).toContain('#block(fill: rgb("#00ff00"), width: 100%, inset: 5pt)');
    expect(output).not.toContain('height: 100%');
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

  it('uses strong pagebreaks between designer pages', () => {
    const emptyMultiPage: LayoutSchema = {
      ...MINIMAL_SCHEMA,
      pages: [
        { id: 'p1', name: 'Page 1', body: { id: 'body', components: [] } },
        { id: 'p2', name: 'Page 2', body: { id: 'body', components: [] } },
        { id: 'p3', name: 'Page 3', body: { id: 'body', components: [] } },
      ],
    };
    const output = generate(emptyMultiPage);
    expect(output.match(/\n#pagebreak\(\)\n/g)?.length).toBe(2);
    expect(output).not.toContain('#pagebreak(weak: true)');
    expect(output).not.toContain('#box()');
  });

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
    // Body flow must NOT have a leading #v() offset — native margin handles it.
    // Horizontal position comes solely from each component's own x (no page-margin
    // offset), so the body starts directly with the component block.
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

describe('TypstGenerator — form-box component', () => {
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
              id: 'box-1',
              type: 'form-box',
              x: 0,
              y: 0,
              width: 180,
              height: 40,
              strokeWidth: '0.1mm',
              strokeColor: '#64748b',
              inset: '2mm',
              innerGap: '2mm',
              components: [
                {
                  id: 'txt-1',
                  type: 'text',
                  x: 0,
                  y: 0,
                  width: 160,
                  height: 10,
                  content: 'Inside box',
                  style: { fontSize: 10 },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  it('renders bordered rect wrapper with nested flow content', () => {
    const output = generate(schema);
    expect(output).toContain('#rect(width: 100%');
    expect(output).toContain('stroke: 0.1mm');
    expect(output).toContain('Inside box');
  });
});

describe('TypstGenerator — field-grid component', () => {
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
              id: 'grid-1',
              type: 'field-grid',
              x: 0,
              y: 0,
              width: 180,
              height: 30,
              columns: 2,
              labelWidth: '20mm',
              fields: [
                { id: 'f1', label: 'PR.No.', value: '{{pr.number}}', column: 0 },
                { id: 'f2', label: 'Date', value: '{{pr.date}}', column: 1 },
              ],
              labelStyle: { fontSize: 9 },
              valueStyle: { fontSize: 9 },
            },
          ],
        },
      },
    ],
  };

  it('renders two-column label/value grid with bindings', () => {
    const output = generate(schema, { pr: { number: 'PR-001', date: '01/07/2026' } });
    expect(output).toContain('PR.No. :');
    expect(output).toContain('PR-001');
    expect(output).toContain('Date :');
    expect(output).toContain('01/07/2026');
    expect(output).toContain('columns: (1fr, 1fr)');
  });
});

describe('TypstGenerator — letterhead component', () => {
  const schema: LayoutSchema = {
    ...MINIMAL_SCHEMA,
    zones: {
      ...MINIMAL_SCHEMA.zones,
      header: {
        ...MINIMAL_SCHEMA.zones.header,
        components: [
          {
            id: 'lh-1',
            type: 'letterhead',
            x: 0,
            y: 0,
            width: 190,
            height: 22,
            companyName: '{{company.name}}',
            title: 'ใบสั่งซื้อ/สั่งจ้าง',
            showPageNumber: true,
            companyStyle: { fontSize: 13, fontWeight: 'bold' },
            titleStyle: { fontSize: 15, fontWeight: 'bold' },
          },
        ],
      },
    },
    pages: [{ id: 'page-1', name: 'Page 1', body: { id: 'body', components: [] } }],
  };

  it('renders company name and document title', () => {
    const output = generate(schema, { company: { name: 'สยามราชธานี' } });
    expect(output).toContain('สยามราชธานี');
    expect(output).toContain('ใบสั่งซื้อ/สั่งจ้าง');
    expect(output).toContain('counter(page)');
  });
});

describe('TypstGenerator — form-table component', () => {
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
              id: 'ft-1',
              type: 'form-table',
              x: 0,
              y: 0,
              width: 180,
              height: 50,
              minRows: 3,
              dataSource: '{{items}}',
              showHeader: true,
              repeatHeaderOnPage: true,
              columns: [
                { id: 'c1', header: 'Item', field: 'name', width: '1fr' },
                { id: 'c2', header: 'Amt', field: 'amount', width: '30mm', align: 'right' },
              ],
              footerSummary: [
                {
                  id: 'sum1',
                  label: 'Total',
                  value: '{{sum(items, "amount")}}',
                  labelColspan: 1,
                  valueColumn: 1,
                  format: 'number',
                },
              ],
              style: {},
            },
          ],
        },
      },
    ],
  };

  it('pads rows to minRows and renders footer summary', () => {
    const output = generate(schema, {
      items: [{ name: 'Pen', amount: '100.00' }],
    });
    expect(output).toContain('#table(');
    expect(output).toContain('Total');
    expect(output).toContain('table.footer');
  });

  it('renders PO-style bottom footer with a fixed blank body and column-aligned totals', () => {
    const poSchema: LayoutSchema = {
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
                id: 'po-table',
                type: 'form-table',
                x: 0,
                y: 0,
                width: 180,
                height: 130,
                bodyMinHeight: '95mm',
                footerMode: 'bottom',
                dataSource: '{{items}}',
                showHeader: true,
                repeatHeaderOnPage: true,
                columns: [
                  { id: 'c-no', header: '#', field: 'no', width: '8mm', align: 'center' },
                  { id: 'c-desc', header: 'Descriptions', field: 'description', width: '85mm' },
                  { id: 'c-dept', header: 'Dept./Site', field: 'dept', width: '18mm' },
                  { id: 'c-pr', header: 'PR No.', field: 'prNo', width: '22mm' },
                  { id: 'c-qty', header: 'QTY', field: 'qty', width: '20mm', align: 'right' },
                  { id: 'c-amount', header: 'Amount', field: 'amount', width: '27mm', align: 'right' },
                ],
                footerSummary: [
                  {
                    id: 'qty-total',
                    label: 'รวม',
                    value: '{{sum(items, "qty")}}',
                    labelColumn: 3,
                    valueColumn: 4,
                    labelColspan: 1,
                    valueColspan: 1,
                    format: 'number',
                  },
                  {
                    id: 'subtotal',
                    label: 'Total',
                    value: '{{totals.subtotal}}',
                    labelColumn: 4,
                    valueColumn: 5,
                    format: 'number',
                  },
                  {
                    id: 'vat',
                    label: 'VAT 7.00%',
                    value: '{{totals.vat}}',
                    labelColumn: 4,
                    valueColumn: 5,
                    format: 'number',
                  },
                  {
                    id: 'grand-total',
                    label: 'Grand Total',
                    value: '{{totals.grandTotal}}',
                    labelColumn: 4,
                    valueColumn: 5,
                    format: 'number',
                  },
                ],
                style: {
                  borderColor: '#333333',
                  borderWidth: '0.5pt',
                  cellPadding: '3pt',
                },
              },
            ],
          },
        },
      ],
    };

    const output = generate(poSchema, {
      items: [{ no: 1, description: 'ปากกาไฮไลน์', dept: 'IHD', prNo: 'PR69060015', qty: 10, amount: 207.8 }],
      totals: { subtotal: 207.8, vat: 14.55, grandTotal: 222.35 },
    });

    expect(output).toContain('rows: (auto, auto, 95mm');
    expect(output).toContain('table.cell(stroke: (top: none)');
    expect(output).toContain('table.footer(repeat: false');
    expect(output).toContain('table.cell(colspan: 3');
    expect(output).toContain('Total');
    expect(output).toContain('Grand Total');
  });

  it('keeps unresolved formatted footer bindings as text placeholders', () => {
    const unresolvedSchema: LayoutSchema = {
      ...schema,
      pages: [
        {
          ...schema.pages[0],
          body: {
            ...schema.pages[0].body,
            components: [
              {
                ...(schema.pages[0].body.components[0] as any),
                footerSummary: [
                  {
                    id: 'sum1',
                    label: 'Total',
                    value: '{{totals.subtotal}}',
                    labelColspan: 1,
                    valueColumn: 1,
                    format: 'number',
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const output = generate(unresolvedSchema, {
      items: [{ name: 'Pen', amount: '100.00' }],
    });

    expect(output).toContain('{{totals.subtotal}}');
    expect(output).not.toContain('#fmt_number("{{');
  });
});

describe('TypstGenerator — signature-block component', () => {
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
              id: 'sb-1',
              type: 'signature-block',
              x: 0,
              y: 0,
              width: 180,
              height: 25,
              variant: 'thai-form',
              slots: [
                {
                  id: 's1',
                  role: 'ผู้อนุมัติ',
                  name: '{{signatures.approver}}',
                  date: 'วันที่',
                  lineStyle: 'dotted',
                },
              ],
              labelStyle: { fontSize: 8 },
            },
          ],
        },
      },
    ],
  };

  it('renders thai-form dotted line and role', () => {
    const output = generate(schema, { signatures: { approver: 'นาย A' } });
    expect(output).toContain('dash: "dotted"');
    expect(output).toContain('ผู้อนุมัติ');
    expect(output).toContain('นาย A');
  });
});

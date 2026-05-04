import type { ComponentNode, LayoutSchema } from '@/types/schema';
import type { NextRequest } from 'next/server';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_text',
      description:
        'Add a text element to a layout zone. Use {{field.path}} for dynamic data bindings.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'], description: 'Target zone' },
          x: { type: 'number', description: 'X position in mm from left edge of zone' },
          y: { type: 'number', description: 'Y position in mm from top of zone' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          content: {
            type: 'string',
            description: 'Text content or binding like {{customer.name}}',
          },
          fontSize: { type: 'number', description: 'Font size in pt (default: 11)' },
          bold: { type: 'boolean', description: 'Bold text' },
          align: {
            type: 'string',
            enum: ['left', 'center', 'right', 'justify'],
            description: 'Text alignment',
          },
          color: { type: 'string', description: 'Text color as hex e.g. #000000' },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_table',
      description: 'Add a data table bound to an array field in the data schema.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number', description: 'X position in mm' },
          y: { type: 'number', description: 'Y position in mm' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          dataSource: { type: 'string', description: 'Data binding to array, e.g. {{items}}' },
          showHeader: { type: 'boolean', description: 'Show column headers row (default: true)' },
          columns: {
            type: 'array',
            description: 'Column definitions',
            items: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  description: 'Field path relative to dataSource, e.g. "description"',
                },
                label: { type: 'string', description: 'Column header label' },
                width: {
                  type: 'string',
                  description: 'Column width: "auto", "1fr", "30mm", "20%"',
                },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
              },
              required: ['key', 'label'],
            },
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'dataSource', 'columns'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_image',
      description: 'Add an image or logo to a zone.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          src: { type: 'string', description: 'Image URL or binding expression' },
          fit: {
            type: 'string',
            enum: ['contain', 'cover', 'stretch'],
            description: 'Image fit mode (default: contain)',
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_line',
      description: 'Add a horizontal separator line to a zone.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number', description: 'Line width in mm' },
          color: { type: 'string', description: 'Line color as hex (default: #cccccc)' },
          thickness: { type: 'number', description: 'Thickness in mm (default: 0.25)' },
          style: {
            type: 'string',
            enum: ['solid', 'dashed', 'dotted'],
            description: 'Line style (default: solid)',
          },
        },
        required: ['zone', 'x', 'y', 'width'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_spacer',
      description: 'Add vertical whitespace between elements.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number', description: 'Spacer height in mm' },
        },
        required: ['zone', 'x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_component',
      description: 'Update properties of an existing component. Use IDs from the current layout.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Component ID from the current layout' },
          updates: {
            type: 'object',
            description: 'Partial component properties to merge in',
          },
        },
        required: ['id', 'updates'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_component',
      description: 'Remove a component by its ID.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Component ID to remove' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'load_template',
      description: 'Load a predefined report template. This replaces the current layout.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['blank', 'invoice', 'complex', 'invoice-with-breaks', 'tax-invoice'],
            description: 'Template to load',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_layout',
      description:
        'Read current canvas state. Call this to verify placements before continuing a multi-step layout.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_sample_data',
      description:
        'Inject realistic mock data so the layout renders with actual values instead of empty bindings. Always call this after building a layout.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description:
              'JSON object matching the layout bindings. Use realistic Thai business values.',
          },
        },
        required: ['data'],
      },
    },
  },
] as const;

function summarizeComponent(c: ComponentNode): string {
  const pos = `${(c.x ?? 0).toFixed(0)},${(c.y ?? 0).toFixed(0)}`;
  const size = `${(c.width ?? 0).toFixed(0)}×${(c.height ?? 0).toFixed(0)}mm`;
  if (c.type === 'text') return `text(id:${c.id} pos:${pos} ${size} "${c.content.slice(0, 35)}")`;
  if (c.type === 'table')
    return `table(id:${c.id} pos:${pos} ${size} ds:${c.dataSource} cols:${c.columns.length})`;
  return `${c.type}(id:${c.id} pos:${pos} ${size})`;
}

function buildSystemPrompt(schema: LayoutSchema): string {
  const { page, zones, pages, dataSchema } = schema;
  const headerSummary = zones.header.components.map(summarizeComponent).join(' | ') || 'empty';
  const footerSummary = zones.footer.components.map(summarizeComponent).join(' | ') || 'empty';
  const bodyLines = pages.map(
    (p, i) =>
      `  Page ${i + 1} (id:${p.id}): ${p.body.components.map(summarizeComponent).join(' | ') || 'empty'}`
  );
  const dataFields =
    dataSchema.length > 0
      ? dataSchema.map((f) => `${f.path}:${f.type}`).join(', ')
      : 'none defined';

  return `You are an expert PDF report designer and AI layout assistant for TypstFlow.
Build beautiful, production-ready layouts. You will receive tool results — use them to verify and continue building.

## Canvas
- Positions in mm. x=0,y=0 = top-left of each zone.
- ${page.size} ${page.orientation} | body width ~190mm
- header: page top | body: main content | footer: page bottom
- Bindings: {{path.to.field}} | array loops: {{items}}
- Batch 5-8 tool calls per round. Use get_layout to verify between rounds.

## Design Standards (ALWAYS follow these)
TYPOGRAPHY HIERARCHY:
- Main title: fontSize 18-22, bold, color #1a1a2e or brand color
- Section heading: fontSize 12-13, bold, color #1a1a2e
- Label/caption: fontSize 8-9, color #666666
- Body text: fontSize 10-11, color #333333
- Numbers/amounts: fontSize 10-11, bold, align right, color #1a1a2e
- Accent/total: fontSize 13-16, bold, color brand or #e63946

COLOR PALETTE (pick one per layout, stay consistent):
- Professional navy: primary=#1a1a2e, accent=#4361ee, subtle=#f0f2ff, border=#d0d5e8
- Corporate teal: primary=#0d3b38, accent=#0a9396, subtle=#f0f7f6, border=#cce3e2
- Modern slate: primary=#1e293b, accent=#6366f1, subtle=#f1f5f9, border=#e2e8f0
- Bold red: primary=#1a1a2e, accent=#e63946, subtle=#fff5f5, border=#fecdd3

TABLE DESIGN:
- headerBackground: brand subtle color (e.g. #f0f2ff)
- borderColor: brand border color
- borderWidth: "0.5pt"
- cellPadding: "5pt"
- Alternating rows: use stripedColor1 in style

SPACING RULES:
- Between header sections: 3-5mm gap
- Between body sections: 5-8mm gap
- Separator lines: thickness 0.3-0.5mm, color border color
- Summary boxes: right-aligned, x starts at 105-120mm

LAYOUT BEST PRACTICES:
- Always add a thick accent line (1-2mm) under the main header title
- Use image placeholder for logo (top-left header, 35×18mm)
- Company name + address in header (bold name, muted address)
- Document title + number/date right-aligned in header
- Footer: left=contact/note, right=page number
- Add spacers between logical sections (3-5mm)

## Mandatory Final Step
After completing the layout, ALWAYS call set_sample_data with realistic Thai business mock data that matches every {{binding}} used. Use real-looking company names, addresses, numbers, and items in Thai language.

DATA FIELDS: ${dataFields}

CURRENT LAYOUT:
Header: ${headerSummary}
${bodyLines.join('\n')}
Footer: ${footerSummary}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 });
  }

  const model = process.env.OPENROUTER_MODEL_NAME ?? 'anthropic/claude-3.5-sonnet';
  const body = (await req.json()) as {
    messages: Array<{
      role: string;
      content: unknown;
      tool_calls?: unknown;
      tool_call_id?: string;
    }>;
    schema: LayoutSchema;
  };

  const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': req.headers.get('origin') ?? 'https://typstflow.app',
      'X-Title': 'TypstFlow',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: buildSystemPrompt(body.schema) }, ...body.messages],
      tools: TOOLS,
      tool_choice: 'auto',
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return Response.json({ error: err }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'application/json' },
  });
}

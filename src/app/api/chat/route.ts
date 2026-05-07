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
  if (c.type === 'text') {
    const styleStr = [
      `fs:${c.style?.fontSize ?? 11}`,
      c.style?.fontWeight === 'bold' ? 'bold' : '',
      c.style?.color ? `fg:${c.style.color}` : '',
      c.align ? `align:${c.align}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return `text(id:${c.id} @${pos} ${size} ${styleStr} "${c.content.slice(0, 30)}")`;
  }
  if (c.type === 'table') {
    const hbg = c.style?.headerBackground ? ` hbg:${c.style.headerBackground}` : '';
    return `table(id:${c.id} @${pos} ${size} ds:${c.dataSource} cols:${c.columns.length}${hbg})`;
  }
  if (c.type === 'line') {
    return `line(id:${c.id} @${pos} ${size} color:${c.color ?? '#ccc'} ${c.style ?? 'solid'})`;
  }
  if (c.type === 'image') {
    return `image(id:${c.id} @${pos} ${size} src:${c.src ? 'set' : 'empty'})`;
  }
  return `${c.type}(id:${c.id} @${pos} ${size})`;
}

function parseMarginMm(value: string): number {
  const v = value.trim();
  if (v.endsWith('mm')) return Number.parseFloat(v);
  if (v.endsWith('cm')) return Number.parseFloat(v) * 10;
  if (v.endsWith('in')) return Number.parseFloat(v) * 25.4;
  if (v.endsWith('pt')) return Number.parseFloat(v) * (25.4 / 72);
  if (v.endsWith('px')) return Number.parseFloat(v) * (25.4 / 96);
  return Number.parseFloat(v);
}

const PAPER_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

// ─── Chat prompt (lightweight, no tools) ─────────────────────────────────────

function buildChatPrompt(schema: LayoutSchema, sessionIntent?: string): string {
  const { page, zones, pages, dataSchema } = schema;
  const base = PAPER_DIMS[page.size] ?? PAPER_DIMS.A4;
  const [pageW, pageH] = page.orientation === 'landscape' ? [base.h, base.w] : [base.w, base.h];
  const ml = parseMarginMm(page.margin.left);
  const mr = parseMarginMm(page.margin.right);
  const usableW = Math.round(pageW - ml - mr);

  const totalComponents = [
    ...zones.header.components,
    ...zones.footer.components,
    ...pages.flatMap((p) => p.body.components),
  ].length;
  const dataFields = dataSchema.map((f) => f.path).join(', ') || 'none';
  const intentBlock = sessionIntent ? `\nContext from previous turns:\n${sessionIntent}\n` : '';

  return `You are a helpful assistant for TypstFlow, a PDF report designer.
Answer questions conversationally. Do NOT use any tools — just reply in plain text.
${intentBlock}
Current document: ${page.size} ${page.orientation} (${pageW}×${pageH}mm, usable width ${usableW}mm)
Components on canvas: ${totalComponents} total (header: ${zones.header.components.length}, body: ${pages.reduce((n, p) => n + p.body.components.length, 0)}, footer: ${zones.footer.components.length})
Data fields: ${dataFields}`;
}

// ─── Design prompt (full agent) ───────────────────────────────────────────────
function buildSystemPrompt(schema: LayoutSchema, sessionIntent?: string, aiMode?: 'plan' | 'act'): string {
  const { page, zones, pages, dataSchema } = schema;

  const base = PAPER_DIMS[page.size] ?? PAPER_DIMS.A4;
  const [pageW, pageH] = page.orientation === 'landscape' ? [base.h, base.w] : [base.w, base.h];
  const ml = parseMarginMm(page.margin.left);
  const mr = parseMarginMm(page.margin.right);
  const mt = parseMarginMm(page.margin.top);
  const mb = parseMarginMm(page.margin.bottom);
  const usableW = Math.round(pageW - ml - mr);
  const usableH = Math.round(pageH - mt - mb);

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

  const intentBlock = sessionIntent
    ? `\n## SESSION MEMORY (maintain consistency — do NOT override these choices)\n${sessionIntent}\n`
    : '';

  const modeBlock = aiMode === 'plan' 
    ? '\n## MODE: PLAN\nYou are in planning mode. Describe your layout strategy in detail before calling any tools. Explain why you chose certain positions and styles.' 
    : '\n## MODE: ACT\nYou are in action mode. Build the layout directly and efficiently.';

  return `You are an expert PDF report designer AI for TypstFlow. Build beautiful production-ready layouts using the tools provided.
${intentBlock}${modeBlock}
## Canvas
Page: ${page.size} ${page.orientation} ${pageW}×${pageH}mm | margins t=${mt} r=${mr} b=${mb} l=${ml}mm | USABLE: ${usableW}×${usableH}mm
Zones: header=top, body=main, footer=bottom | x=0,y=0 is top-left of each zone | bindings: {{field.path}}, arrays: {{items}}
WORKFLOW: 1) call get_layout first 2) plan mm positions (no overlaps) 3) add_* in batches of 4-6 4) set_sample_data last

## Style (pick one color theme, stay consistent)
TYPOGRAPHY: title=18-22pt bold | heading=12-13pt bold | body=10-11pt #333 | label=8-9pt #666 | amount=10-11pt bold right
THEMES: navy=#1a1a2e/#4361ee/#f0f2ff | teal=#0d3b38/#0a9396/#f0f7f6 | slate=#1e293b/#6366f1/#f1f5f9 | red=#1a1a2e/#e63946/#fff5f5
TABLE: headerBackground=theme-subtle, borderColor=theme-border, borderWidth=0.5pt, cellPadding=5pt
LAYOUT: logo 35×18mm top-left | accent line 1-2mm under title | company+address header | title+date right-aligned | footer: contact left / page# right | section gaps 5-8mm | summary box x≥${Math.round(usableW * 0.55)}mm

## Mandatory: end every response with ONE line:
<intent>{"docType":"...","colorTheme":"...","primaryColor":"...","accentColor":"...","decisions":["..."]}</intent>
After layout is done, ALWAYS call set_sample_data with realistic Thai business data for every {{binding}} used.

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

  const body = (await req.json()) as {
    messages: Array<{
      role: string;
      content: unknown;
      tool_calls?: unknown;
      tool_call_id?: string;
    }>;
    schema: LayoutSchema;
    sessionIntent?: string;
    mode?: 'design' | 'plan' | 'chat';
    model?: string;
    aiMode?: 'plan' | 'act';
  };
  const model =
    body.model ?? process.env.OPENROUTER_MODEL_NAME ?? 'anthropic/claude-sonnet-4-5';

  const isChatMode = body.mode === 'chat';
  const isPlanMode = body.mode === 'plan';

  let systemPrompt: string;
  if (isChatMode) {
    systemPrompt = buildChatPrompt(body.schema, body.sessionIntent);
  } else if (isPlanMode) {
    // Full canvas context, plan persona, but NO tools — discussion only
    systemPrompt = buildSystemPrompt(body.schema, body.sessionIntent, 'plan');
  } else {
    systemPrompt = buildSystemPrompt(body.schema, body.sessionIntent, body.aiMode);
  }

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
      max_tokens: isChatMode ? 1024 : isPlanMode ? 2048 : 3000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...body.messages,
      ],
      // Only design mode gets tools — plan and chat are tool-free
      ...(!isChatMode && !isPlanMode ? { tools: TOOLS, tool_choice: 'auto' } : {}),
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

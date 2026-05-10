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

// ─── Quick prompt (single-action, no workflow, no get_layout) ────────────────

function buildQuickPrompt(schema: LayoutSchema): string {
  const { page, zones, pages } = schema;
  const base = PAPER_DIMS[page.size] ?? PAPER_DIMS.A4;
  const [pageW, pageH] = page.orientation === 'landscape' ? [base.h, base.w] : [base.w, base.h];
  const ml = parseMarginMm(page.margin.left);
  const mr = parseMarginMm(page.margin.right);
  const mt = parseMarginMm(page.margin.top);
  const mb = parseMarginMm(page.margin.bottom);
  const usableW = Math.round(pageW - ml - mr);
  const usableH = Math.round(pageH - mt - mb);
  const cx = Math.round(usableW / 2);
  const cy = Math.round(usableH / 2);

  const headerSummary = zones.header.components.map(summarizeComponent).join(' | ') || 'empty';
  const footerSummary = zones.footer.components.map(summarizeComponent).join(' | ') || 'empty';
  const bodyLines = pages.map(
    (p, i) =>
      `  Page ${i + 1}: ${p.body.components.map(summarizeComponent).join(' | ') || 'empty'}`
  );

  return `PDF designer. Execute the user's single action with ONE tool call. No get_layout, no planning, no follow-up steps.
Canvas: ${page.size} ${pageW}×${pageH}mm | USABLE: ${usableW}×${usableH}mm | center=(${cx},${cy})
Coordinates in mm. zone options: header | body | footer.
CURRENT LAYOUT:
Header: ${headerSummary}
${bodyLines.join('\n')}
Footer: ${footerSummary}
Call exactly one tool now.`;
}

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
  const mid = Math.round(usableW * 0.55);
  const rightW = usableW - mid;

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
    ? `\n## SESSION MEMORY (maintain these choices — do NOT override)\n${sessionIntent}\n`
    : '';

  const modeBlock = aiMode === 'plan'
    ? '\n## MODE: PLAN — describe your full layout plan with exact mm positions before any tool calls.'
    : '\n## MODE: ACT — build directly and efficiently, batch 4–6 tool calls per round.';

  return `You are a senior PDF layout designer for TypstFlow. You create polished, production-ready business documents that look like they were designed by a professional graphic designer — not auto-generated.
${intentBlock}${modeBlock}

## Canvas
Page: ${page.size} ${page.orientation} ${pageW}×${pageH}mm | margins t=${mt} r=${mr} b=${mb} l=${ml}mm
USABLE AREA: ${usableW}×${usableH}mm | x:0–${usableW}mm, y:0–${usableH}mm per zone
Zones: header=top strip | body=main content | footer=bottom strip
Bindings: {{field}} for scalar values, {{items}} for arrays bound to tables

## Design Principles — apply EVERY time
VISUAL HIERARCHY (3 tiers):
  Tier 1 — Identity: Company name / Document title. 18–22pt bold, dark theme color. Commands attention.
  Tier 2 — Structure: Section labels, column headers, subtitles. 10–12pt semibold, primary accent color.
  Tier 3 — Data: Body text, table cells, addresses. 9–10pt, #333333. Readable, not dominant.

LAYOUT GRID (two-column):
  Left column:  x=0, w=${mid}mm — billing party info, description, terms
  Right column: x=${mid}, w=${rightW}mm — document refs, dates, amounts (right-aligned)

COLOR DISCIPLINE — pick ONE theme, use consistently:
  navy:   dark=#1a1a2e | primary=#4361ee | accent=#7b9eff | tint=#eef0ff
  teal:   dark=#0d3b38 | primary=#0a9396 | accent=#52b788 | tint=#e8f4f3
  slate:  dark=#1e293b | primary=#6366f1 | accent=#a5b4fc | tint=#eef2ff
  maroon: dark=#2d0a0a | primary=#c1121f | accent=#e63946 | tint=#fff5f5
  forest: dark=#0f2818 | primary=#2d6a4f | accent=#52b788 | tint=#d8f3dc

  Apply: dark → titles/headings | primary → accent lines, table header bg, section labels | tint → subtle panel bg | accent → highlights only

WHITESPACE: 5–8mm between sections. 3mm min between adjacent elements. Never pack edge-to-edge.
ALIGNMENT: Labels left-aligned, values right-aligned within their column. Consistent x-positions for the same role.

## Element Sizing Guide
  Text heights: 1 line=6mm | 2 lines=10mm | 3 lines=14mm
  Table: minimum 30mm height, add 7mm per expected data row
  Logo: 35×18mm | Company name: h=8mm | Address line: h=5mm
  Section gap (spacer): 5–8mm | Divider line: thickness=0.3–0.5mm

## Standard Invoice / Report Recipe
HEADER ZONE — brand identity strip:
  • image:   x=0,  y=2,  w=35, h=18  ← logo
  • text:    x=40, y=2,  w=${usableW - 40}, h=8   ← Company Name, 16pt bold, dark color
  • text:    x=40, y=11, w=${usableW - 40}, h=5   ← tagline/website, 8pt, #888888
  • line:    x=0,  y=21, w=${usableW}, thickness=0.4mm, primary color ← brand separator

BODY — Document Header block (y=0–35mm):
  • text: x=0,    y=0,  w=${mid}, h=10  ← "TAX INVOICE" / "QUOTATION", 20pt bold, dark color
  • text: x=${mid}, y=0,  w=${rightW}, h=6, right-align ← "Doc No: {{invoice.number}}", 9pt label
  • text: x=${mid}, y=7,  w=${rightW}, h=6, right-align ← "Date: {{invoice.date}}", 9pt
  • text: x=${mid}, y=14, w=${rightW}, h=6, right-align ← "Due: {{invoice.dueDate}}", 9pt
  • line: x=0,    y=22, w=${usableW}, thickness=0.25mm, #e0e0e0 ← subtle separator

BODY — Party Info block (y=25–60mm):
  • text: x=0,   y=25, w=5,   h=5  ← "BILL TO", 7pt bold, primary color (section label)
  • text: x=0,   y=30, w=${mid - 5}, h=7  ← client name, 11pt bold
  • text: x=0,   y=38, w=${mid - 5}, h=5  ← address line 1, 9pt #555
  • text: x=0,   y=43, w=${mid - 5}, h=5  ← address line 2 / tax ID, 9pt #555
  • text: x=${mid}, y=25, w=5,  h=5  ← "FROM", 7pt bold, primary color
  • text: x=${mid}, y=30, w=${rightW}, h=7  ← our company short name, 11pt bold
  • text: x=${mid}, y=38, w=${rightW}, h=5  ← our address, 9pt #555

BODY — Items Table (y=65–145mm):
  • table: x=0, y=65, w=${usableW}, h=80, dataSource={{items}}
    columns: description(auto,left), qty(20mm,center), unit(25mm,right), amount(30mm,right)
    style: headerBackground=primary color, headerText=#ffffff, borderColor=#e0e0e0, cellPadding=5pt

BODY — Totals block (y≈150mm, right column):
  • line:  x=${mid}, y=150, w=${rightW}, thickness=0.25mm, #cccccc
  • text:  x=${mid}, y=153, w=${rightW}, h=6, right-align ← "Subtotal: {{invoice.subtotal}}", 9pt
  • text:  x=${mid}, y=160, w=${rightW}, h=6, right-align ← "VAT 7%: {{invoice.vat}}", 9pt
  • line:  x=${mid}, y=168, w=${rightW}, thickness=0.4mm, primary color
  • text:  x=${mid}, y=170, w=${rightW}, h=8, right-align ← "TOTAL: {{invoice.total}}", 13pt bold, primary color

FOOTER ZONE — legal/contact strip:
  • text: x=0,     y=2, w=${mid}, h=5  ← contact info, 7.5pt, #888888
  • text: x=${mid}, y=2, w=${rightW}, h=5, right-align ← "Page {{page}} of {{totalPages}}", 7.5pt, #888888

## Mandatory Workflow
1. get_layout → read what exists and available y-space
2. Pick color theme → commit. Use dark color for headings, primary for accents, tint for backgrounds.
3. HEADER ZONE: logo + company name + separator line (3–4 elements)
4. BODY doc-header block: title + reference numbers + date (4–5 elements)
5. BODY party-info block: bill-to + from columns (5–6 elements)
6. BODY data table: columns with field bindings
7. BODY totals block: subtotal/tax/total text + lines
8. FOOTER ZONE: contact + page number
9. set_sample_data → EVERY {{binding}} with realistic Thai business data (company name in Thai, 13-digit tax ID, THB amounts with commas)

## Sample Data Quality Standard
Thai context: company name e.g. "บริษัท เทคโนโลยี จำกัด", tax ID "0105537123456", address real-sounding Thai street. Amounts in THB (e.g. 15750.00). Arrays: 3–5 rows with varied, plausible values.

DATA FIELDS: ${dataFields}

CURRENT LAYOUT:
Header: ${headerSummary}
${bodyLines.join('\n')}
Footer: ${footerSummary}

End every response with:
<intent>{"docType":"...","colorTheme":"...","primaryColor":"...","accentColor":"...","decisions":["..."]}</intent>`;
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
    mode?: 'design' | 'plan' | 'chat' | 'quick';
    model?: string;
    aiMode?: 'plan' | 'act';
  };
  const model =
    body.model ?? process.env.OPENROUTER_MODEL_NAME ?? 'anthropic/claude-sonnet-4-5';

  const isChatMode = body.mode === 'chat';
  const isPlanMode = body.mode === 'plan';
  const isQuickMode = body.mode === 'quick';

  let systemPrompt: string;
  if (isChatMode) {
    systemPrompt = buildChatPrompt(body.schema, body.sessionIntent);
  } else if (isPlanMode) {
    systemPrompt = buildSystemPrompt(body.schema, body.sessionIntent, 'plan');
  } else if (isQuickMode) {
    systemPrompt = buildQuickPrompt(body.schema);
  } else {
    systemPrompt = buildSystemPrompt(body.schema, body.sessionIntent, body.aiMode);
  }

  const hasTools = !isChatMode && !isPlanMode;

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
      max_tokens: isChatMode ? 1024 : isPlanMode ? 2048 : isQuickMode ? 1024 : 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        ...body.messages,
      ],
      ...(hasTools ? { tools: TOOLS, tool_choice: isQuickMode ? 'required' : 'auto' } : {}),
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

import {
  CREATIVE_PROCESS,
  DESIGN_PRINCIPLES,
  INTENT_FORMAT,
  type LayoutDims,
  MODE_BLOCKS,
  PERSONA,
  SAMPLE_DATA_GUIDE,
  buildCanvasContext,
  buildTechnicalConstraints,
} from '@/lib/ai/prompt-config';
import {
  AI_PROVIDER_CONFIG,
  getAiModel,
  resolveAiModel,
  resolveAiProvider,
} from '@/lib/utils/ai-models';
import type { ComponentNode, LayoutSchema } from '@/types/schema';
import type { NextRequest } from 'next/server';

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
      name: 'add_static_table',
      description:
        'Add a static table with literal cell values and support for MERGED cells (colspan/rowspan). Use this to reproduce bordered/complex tables — e.g. from an imported PDF — where cells span multiple columns or rows. Unlike add_table, it does NOT bind to data; every cell content is literal text.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number', description: 'X position in mm' },
          y: { type: 'number', description: 'Y position in mm' },
          width: { type: 'number', description: 'Total table width in mm' },
          height: { type: 'number', description: 'Total table height in mm' },
          columns: {
            type: 'array',
            description: 'Column definitions left→right. Length = number of grid columns.',
            items: {
              type: 'object',
              properties: {
                width: {
                  type: 'string',
                  description: 'Column width: "30mm", "1fr", "auto", "20%"',
                },
                align: { type: 'string', enum: ['left', 'center', 'right'] },
              },
            },
          },
          rows: {
            type: 'array',
            description:
              'Rows top→bottom. In each row list ONLY the cells that START there. A cell with colspan/rowspan covers neighbouring positions which you must NOT list again.',
            items: {
              type: 'object',
              properties: {
                cells: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string', description: 'Literal cell text (may be empty)' },
                      colspan: {
                        type: 'number',
                        description: 'Columns this cell spans (default 1)',
                      },
                      rowspan: { type: 'number', description: 'Rows this cell spans (default 1)' },
                      bold: { type: 'boolean' },
                      align: { type: 'string', enum: ['left', 'center', 'right'] },
                    },
                    required: ['content'],
                  },
                },
              },
              required: ['cells'],
            },
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'columns', 'rows'],
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
      description: 'Reset the canvas to a blank layout. This replaces the current layout.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: ['blank'],
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
      name: 'set_page',
      description:
        'Set the page size, orientation, and margins to match the source document. Call this FIRST when recreating a layout from an uploaded image/PDF so coordinates map correctly.',
      parameters: {
        type: 'object',
        properties: {
          size: {
            type: 'string',
            enum: ['A4', 'A5', 'Letter', 'Legal'],
            description: 'Paper size — infer from the document proportions (A4 ≈ 1:1.41).',
          },
          orientation: {
            type: 'string',
            enum: ['portrait', 'landscape'],
            description: 'Page orientation',
          },
          margin: {
            type: 'object',
            description: 'Page margins as CSS-like values, e.g. "15mm", "2cm".',
            properties: {
              top: { type: 'string' },
              bottom: { type: 'string' },
              left: { type: 'string' },
              right: { type: 'string' },
            },
          },
        },
        required: [],
      },
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
  {
    type: 'function',
    function: {
      name: 'add_barcode',
      description: 'Add a barcode component for scanning/inventory identification.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'], description: 'Target zone' },
          x: { type: 'number', description: 'X position in mm' },
          y: { type: 'number', description: 'Y position in mm' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          value: { type: 'string', description: 'Barcode value expression e.g. {{invoice.id}}' },
          format: {
            type: 'string',
            enum: ['code128', 'ean13', 'pdf417'],
            description: 'Barcode format',
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_qr',
      description: 'Add a QR code component e.g. for payments, web URLs, or check-ins.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'], description: 'Target zone' },
          x: { type: 'number', description: 'X position in mm' },
          y: { type: 'number', description: 'Y position in mm' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          value: {
            type: 'string',
            description: 'QR content/URL expression e.g. {{invoice.paymentUrl}}',
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_summary_box',
      description:
        'Add a structured summary box for totals, sub-totals, discounts, tax, and grand totals.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number', description: 'X position in mm' },
          y: { type: 'number', description: 'Y position in mm' },
          width: { type: 'number', description: 'Width in mm' },
          height: { type: 'number', description: 'Height in mm' },
          rows: {
            type: 'array',
            description: 'Rows to show inside the summary box',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Display label' },
                value: { type: 'string', description: 'Value expression e.g. {{invoice.total}}' },
                style: { type: 'string', enum: ['normal', 'subtotal', 'total', 'highlight'] },
                separator: { type: 'boolean' },
              },
              required: ['label', 'value'],
            },
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_page_break_indicator',
      description: 'Add a manual page break indicator to the layout.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          label: {
            type: 'string',
            description: 'Optional helper text e.g. "Continued on next page..."',
          },
          style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
          showPageNumber: { type: 'boolean' },
        },
        required: ['zone', 'x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_page_number',
      description: 'Add a page number component to render current/total pages dynamically.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          format: { type: 'string', description: 'String format e.g. "{{page}} / {{totalPages}}"' },
          fontSize: { type: 'number' },
          color: { type: 'string', description: 'Hex color code' },
          align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'format'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_checklist',
      description: 'Add a checklist (bulleted, numbered, checkbox, etc.) to the layout.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          listStyle: {
            type: 'string',
            enum: ['bullet', 'numbered', 'alpha', 'roman', 'checkbox', 'dash', 'custom'],
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                checked: { type: 'boolean' },
              },
              required: ['label'],
            },
          },
          dataSource: {
            type: 'string',
            description: 'Data array binding for dynamic checklist items, e.g. {{tasks}}',
          },
          labelField: { type: 'string', description: 'Field name for labels within data objects' },
          checkedField: {
            type: 'string',
            description: 'Field name for checked boolean within data objects',
          },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'listStyle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_rectangle',
      description: 'Add a rectangle component for backgrounds, banners, or borders.',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          fill: { type: 'string', description: 'Hex background fill color e.g. #f0f0f0' },
          radius: { type: 'string', description: 'Corner radius in mm e.g. "2mm"' },
          strokeColor: { type: 'string', description: 'Hex border color' },
          strokeWidth: { type: 'string', description: 'Border stroke width e.g. "0.5mm"' },
        },
        required: ['zone', 'x', 'y', 'width', 'height'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_signature',
      description:
        'Add a signature signing area component (often at the bottom of forms/invoices).',
      parameters: {
        type: 'object',
        properties: {
          zone: { type: 'string', enum: ['header', 'body', 'footer'] },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          slots: {
            type: 'array',
            description: 'Signing slots (e.g. Creator, Approved By)',
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'Title above/below signature e.g. Authorized Signature',
                },
                nameLabel: {
                  type: 'string',
                  description: 'Placeholder for print name e.g. Name: _______________',
                },
                dateLabel: {
                  type: 'string',
                  description: 'Placeholder for date e.g. Date: _______________',
                },
              },
              required: ['label'],
            },
          },
          showNameLine: { type: 'boolean' },
          showDateLine: { type: 'boolean' },
        },
        required: ['zone', 'x', 'y', 'width', 'height', 'slots'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_zone',
      description:
        'Configure zone settings such as changing layout mode (absolute vs flow) and spacing.',
      parameters: {
        type: 'object',
        properties: {
          zone: {
            type: 'string',
            enum: ['header', 'body', 'footer'],
            description: 'The zone to update',
          },
          updates: {
            type: 'object',
            properties: {
              layoutMode: {
                type: 'string',
                enum: ['absolute', 'flow'],
                description:
                  'Layout mode: absolute (coordinate-based) or flow (vertically stacked elements).',
              },
              flowGap: {
                type: 'string',
                description: 'Vertical space between flow components, e.g. "4mm" or "0mm"',
              },
            },
            required: ['layoutMode'],
          },
        },
        required: ['zone', 'updates'],
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

// ─── Shared dimension calculator ─────────────────────────────────────────────

function calcDims(schema: LayoutSchema): LayoutDims {
  const { page } = schema;
  const base = PAPER_DIMS[page.size] ?? PAPER_DIMS.A4;
  const [pageW, pageH] = page.orientation === 'landscape' ? [base.h, base.w] : [base.w, base.h];
  const ml = parseMarginMm(page.margin.left);
  const mr = parseMarginMm(page.margin.right);
  const mt = parseMarginMm(page.margin.top);
  const mb = parseMarginMm(page.margin.bottom);
  const usableW = Math.round(pageW - ml - mr);
  const usableH = Math.round(pageH - mt - mb);
  return {
    pageSize: page.size,
    orientation: page.orientation,
    pageW,
    pageH,
    mt,
    mr,
    mb,
    ml,
    usableW,
    usableH,
  };
}

function collectCanvasState(schema: LayoutSchema, includePageId = false) {
  const { zones, pages, dataSchema } = schema;
  return {
    headerSummary: zones.header.components.map(summarizeComponent).join(' | ') || 'empty',
    footerSummary: zones.footer.components.map(summarizeComponent).join(' | ') || 'empty',
    bodyLines: pages.map(
      (p, i) =>
        `  Page ${i + 1}${includePageId ? ` (id:${p.id})` : ''}: ${
          p.body.components.map(summarizeComponent).join(' | ') || 'empty'
        }`
    ),
    dataFields:
      dataSchema.length > 0
        ? dataSchema.map((f) => `${f.path}:${f.type}`).join(', ')
        : 'none defined',
  };
}

// ─── Quick prompt (single-action, no workflow, no get_layout) ────────────────

function buildQuickPrompt(schema: LayoutSchema): string {
  const dims = calcDims(schema);
  const canvas = collectCanvasState(schema);
  const cx = Math.round(dims.usableW / 2);
  const cy = Math.round(dims.usableH / 2);

  return `PDF designer. Execute the user's single action with ONE tool call. No get_layout, no planning, no follow-up steps.
Canvas: ${dims.pageSize} ${dims.pageW}×${dims.pageH}mm | USABLE: ${dims.usableW}×${dims.usableH}mm | center=(${cx},${cy})
Coordinates in mm. zone options: header | body | footer.
CURRENT LAYOUT:
Header: ${canvas.headerSummary}
${canvas.bodyLines.join('\n')}
Footer: ${canvas.footerSummary}
Call exactly one tool now.`;
}

// ─── Chat prompt (lightweight, no tools) ─────────────────────────────────────

function buildChatPrompt(schema: LayoutSchema, sessionIntent?: string): string {
  const { zones, pages, dataSchema } = schema;
  const dims = calcDims(schema);
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
Current document: ${dims.pageSize} ${dims.orientation} (${dims.pageW}×${dims.pageH}mm, usable width ${dims.usableW}mm)
Components on canvas: ${totalComponents} total (header: ${zones.header.components.length}, body: ${pages.reduce((n, p) => n + p.body.components.length, 0)}, footer: ${zones.footer.components.length})
Data fields: ${dataFields}`;
}

// ─── Design prompt (full agent) ───────────────────────────────────────────────

function buildSystemPrompt(
  schema: LayoutSchema,
  sessionIntent?: string,
  aiMode?: 'plan' | 'act'
): string {
  const dims = calcDims(schema);
  const canvas = collectCanvasState(schema, true);

  const intentBlock = sessionIntent
    ? `\n## SESSION MEMORY (maintain these choices — do NOT override)\n${sessionIntent}\n`
    : '';

  const modeBlock = `\n${MODE_BLOCKS[aiMode ?? 'act']}`;

  return `${PERSONA}
${intentBlock}${modeBlock}

${buildCanvasContext(dims, canvas)}

${DESIGN_PRINCIPLES}

${buildTechnicalConstraints(dims)}

${CREATIVE_PROCESS}

${SAMPLE_DATA_GUIDE}

${INTENT_FORMAT}`;
}

export async function POST(req: NextRequest) {
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
  const model = resolveAiModel(body.model ?? process.env.OPENROUTER_MODEL_NAME);
  const provider = resolveAiProvider(model);
  const providerConfig = AI_PROVIDER_CONFIG[provider];
  const apiKey = process.env[providerConfig.apiKeyEnv];

  if (!apiKey) {
    return Response.json(
      { error: `${providerConfig.apiKeyEnv} is not configured` },
      { status: 500 }
    );
  }

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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = req.headers.get('origin') ?? 'https://typstflow.app';
    headers['X-Title'] = 'TypstFlow';
  }

  const upstream = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: getAiModel(model)?.id ?? model,
      max_tokens: isChatMode ? 1024 : isPlanMode ? 2048 : isQuickMode ? 1024 : 4096,
      messages: [{ role: 'system', content: systemPrompt }, ...body.messages],
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

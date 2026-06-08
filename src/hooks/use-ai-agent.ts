'use client';

import { resolveAiModel } from '@/lib/utils/ai-models';
import { useDesignerStore } from '@/store/designer-store';
import type {
  BarcodeComponent,
  ChecklistComponent,
  ComponentNode,
  ImageComponent,
  LayoutSchema,
  LineComponent,
  PageBreakIndicatorComponent,
  PageNumberComponent,
  QRComponent,
  RectangleComponent,
  SignatureComponent,
  SpacerComponent,
  SummaryBoxComponent,
  TableColumn,
  TableComponent,
  TextComponent,
  Zone,
  ZoneKey,
} from '@/types/schema';
import { useCallback, useRef, useState } from 'react';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: 'chat' | 'plan' | 'design';
  snapshotIndex?: number;
  toolCalls?: Array<{ name: string; success: boolean; description: string }>;
  image?: string;
}

// ─── Session Memory ───────────────────────────────────────────────────────────

interface SessionMemory {
  docType: string;
  colorTheme: string;
  primaryColor: string;
  accentColor: string;
  language: string;
  decisions: string[];
  dataBindings: string[];
}

const DEFAULT_SESSION_MEMORY: SessionMemory = {
  docType: '',
  colorTheme: '',
  primaryColor: '',
  accentColor: '',
  language: 'th',
  decisions: [],
  dataBindings: [],
};

function serializeMemory(mem: SessionMemory): string {
  const lines: string[] = [];
  if (mem.docType) lines.push(`docType: ${mem.docType}`);
  if (mem.colorTheme) lines.push(`colorTheme: ${mem.colorTheme}`);
  if (mem.primaryColor) lines.push(`primaryColor: ${mem.primaryColor}`);
  if (mem.accentColor) lines.push(`accentColor: ${mem.accentColor}`);
  if (mem.language) lines.push(`language: ${mem.language}`);
  if (mem.decisions.length > 0) lines.push(`decisions: ${mem.decisions.slice(-6).join(' | ')}`);
  if (mem.dataBindings.length > 0)
    lines.push(`bindings used: ${[...new Set(mem.dataBindings)].join(', ')}`);
  return lines.join('\n');
}

function extractIntentFromText(text: string): Partial<SessionMemory> {
  const match = text.match(/<intent>([\s\S]*?)<\/intent>/);
  if (!match) return {};
  try {
    return JSON.parse(match[1].trim()) as Partial<SessionMemory>;
  } catch {
    return {};
  }
}

function stripIntentBlock(text: string): string {
  return text.replace(/<intent>[\s\S]*?<\/intent>/g, '').trim();
}

function extractBindingsFromArgs(args: Record<string, unknown>): string[] {
  const raw = JSON.stringify(args);
  const matches = raw.match(/\{\{[\w.[\]]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

function mergeMemory(prev: SessionMemory, patch: Partial<SessionMemory>): SessionMemory {
  return {
    ...prev,
    ...patch,
    decisions: [...new Set([...prev.decisions, ...(patch.decisions ?? [])])].slice(-10),
    dataBindings: [...new Set([...prev.dataBindings, ...(patch.dataBindings ?? [])])],
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const WELCOME: AgentMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hello! I am your AI Design Assistant. Describe the layout you want and I will build it for you.',
  timestamp: new Date(),
};

type AnyRecord = Record<string, unknown>;

// Rust WASM deserializer requires `id` on TableColumn, TableRow, and TableCell.
// The AI often omits these, so we inject them before passing to the store.
function ensureTableIds(updates: AnyRecord): AnyRecord {
  const patched = { ...updates };

  if (Array.isArray(patched.columns)) {
    patched.columns = (patched.columns as AnyRecord[]).map((col, i) => ({
      id: col.id ?? `col-${i}-${Date.now()}`,
      ...col,
    }));
  }

  for (const rowsKey of ['headerRows', 'detailRows', 'footerRows'] as const) {
    if (Array.isArray(patched[rowsKey])) {
      patched[rowsKey] = (patched[rowsKey] as AnyRecord[]).map((row, ri) => ({
        id: row.id ?? `row-${rowsKey[0]}-${ri}-${Date.now()}`,
        ...row,
        cells: Array.isArray(row.cells)
          ? (row.cells as AnyRecord[]).map((cell, ci) => ({
              id: cell.id ?? `cell-${ri}-${ci}-${Date.now()}`,
              ...cell,
            }))
          : row.cells,
      }));
    }
  }

  return patched;
}

function execTool(name: string, args: Record<string, unknown>): string {
  const store = useDesignerStore.getState();
  const { schema, activePageId } = store;
  const zone = args.zone as ZoneKey;
  const pageId = zone === 'body' ? (activePageId ?? schema.pages[0]?.id) : undefined;

  switch (name) {
    case 'add_text': {
      const comp: TextComponent = {
        id: crypto.randomUUID(),
        type: 'text',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        content: args.content as string,
        style: {
          fontSize: (args.fontSize as number | undefined) ?? 11,
          fontWeight: args.bold ? 'bold' : 'regular',
          color: (args.color as string | undefined) ?? '#000000',
        },
        ...(args.align ? { align: args.align as TextComponent['align'] } : {}),
      };
      store.addComponent(zone, comp, pageId);
      return `Added text "${(args.content as string).slice(0, 40)}" to ${zone}`;
    }

    case 'add_table': {
      const rawCols = (
        args.columns as Array<{ key: string; label: string; width?: string; align?: string }>
      ).map(
        (c, i): TableColumn => ({
          id: (c as AnyRecord).id ? String((c as AnyRecord).id) : `col-${i}-${Date.now()}`,
          header: c.label,
          field: c.key,
          width: c.width ?? 'auto',
          align: (c.align as TableColumn['align']) ?? 'left',
        })
      );
      const comp: TableComponent = {
        id: crypto.randomUUID(),
        type: 'table',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        dataSource: args.dataSource as string,
        columns: rawCols,
        style: {
          fontSize: 10,
          headerBackground: '#f5f5f5',
          borderColor: '#e0e0e0',
          borderWidth: '0.5pt',
          cellPadding: '4pt',
        },
        showHeader: (args.showHeader as boolean | undefined) ?? true,
        repeatHeaderOnPage: false,
      };
      store.addComponent(zone, comp, pageId);
      return `Added ${rawCols.length}-column table to ${zone}`;
    }

    case 'add_image': {
      const comp: ImageComponent = {
        id: crypto.randomUUID(),
        type: 'image',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        src: (args.src as string | undefined) ?? '',
        fit: (args.fit as ImageComponent['fit']) ?? 'contain',
      };
      store.addComponent(zone, comp, pageId);
      return `Added image to ${zone}`;
    }

    case 'add_line': {
      const thickness = (args.thickness as number | undefined) ?? 0.25;
      const comp: LineComponent = {
        id: crypto.randomUUID(),
        type: 'line',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: 1,
        color: (args.color as string | undefined) ?? '#cccccc',
        thickness: `${thickness}mm`,
        style: (args.style as LineComponent['style']) ?? 'solid',
      };
      store.addComponent(zone, comp, pageId);
      return `Added line to ${zone}`;
    }

    case 'add_spacer': {
      const comp: SpacerComponent = {
        id: crypto.randomUUID(),
        type: 'spacer',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
      };
      store.addComponent(zone, comp, pageId);
      return `Added ${args.height}mm spacer to ${zone}`;
    }

    case 'add_barcode': {
      const comp: BarcodeComponent = {
        id: crypto.randomUUID(),
        type: 'barcode',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        value: args.value as string,
        format: (args.format as BarcodeComponent['format']) ?? 'code128',
      };
      store.addComponent(zone, comp, pageId);
      return `Added barcode to ${zone}`;
    }

    case 'add_qr': {
      const comp: QRComponent = {
        id: crypto.randomUUID(),
        type: 'qr',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        value: args.value as string,
      };
      store.addComponent(zone, comp, pageId);
      return `Added QR code to ${zone}`;
    }

    case 'add_summary_box': {
      const comp: SummaryBoxComponent = {
        id: crypto.randomUUID(),
        type: 'summary-box',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        rows: (args.rows as SummaryBoxComponent['rows']) ?? [],
      };
      store.addComponent(zone, comp, pageId);
      return `Added summary box to ${zone}`;
    }

    case 'add_page_break_indicator': {
      const comp: PageBreakIndicatorComponent = {
        id: crypto.randomUUID(),
        type: 'page-break-indicator',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        label: args.label as string | undefined,
        style: (args.style as PageBreakIndicatorComponent['style']) ?? 'dashed',
        showPageNumber: args.showPageNumber as boolean | undefined,
      };
      store.addComponent(zone, comp, pageId);
      return `Added page break indicator to ${zone}`;
    }

    case 'add_page_number': {
      const comp: PageNumberComponent = {
        id: crypto.randomUUID(),
        type: 'page-number',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        format: args.format as string,
        style: {
          fontSize: (args.fontSize as number | undefined) ?? 9,
          color: (args.color as string | undefined) ?? '#666666',
          align: (args.align as PageNumberComponent['style']['align']) ?? 'center',
        },
      };
      store.addComponent(zone, comp, pageId);
      return `Added page number to ${zone}`;
    }

    case 'add_checklist': {
      const comp: ChecklistComponent = {
        id: crypto.randomUUID(),
        type: 'checklist',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        listStyle: (args.listStyle as ChecklistComponent['listStyle']) ?? 'checkbox',
        items: (args.items as ChecklistComponent['items']) ?? [],
        dataSource: args.dataSource as string | undefined,
        labelField: args.labelField as string | undefined,
        checkedField: args.checkedField as string | undefined,
      };
      store.addComponent(zone, comp, pageId);
      return `Added checklist to ${zone}`;
    }

    case 'add_rectangle': {
      const comp: RectangleComponent = {
        id: crypto.randomUUID(),
        type: 'rectangle',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        fill: args.fill as string | undefined,
        radius: args.radius as string | undefined,
        strokeColor: args.strokeColor as string | undefined,
        strokeWidth: args.strokeWidth as string | undefined,
      };
      store.addComponent(zone, comp, pageId);
      return `Added rectangle to ${zone}`;
    }

    case 'add_signature': {
      const comp: SignatureComponent = {
        id: crypto.randomUUID(),
        type: 'signature',
        x: args.x as number,
        y: args.y as number,
        width: args.width as number,
        height: args.height as number,
        slots: (args.slots as SignatureComponent['slots']) ?? [],
        showNameLine: args.showNameLine as boolean | undefined,
        showDateLine: args.showDateLine as boolean | undefined,
      };
      store.addComponent(zone, comp, pageId);
      return `Added signature to ${zone}`;
    }

    case 'update_zone': {
      const updates: Partial<Zone> = {};
      if (args.updates && typeof args.updates === 'object') {
        const u = args.updates as Record<string, unknown>;
        if (u.layoutMode !== undefined) {
          updates.layoutMode = u.layoutMode as Zone['layoutMode'];
        }
        if (u.flowGap !== undefined) {
          updates.flowGap = u.flowGap as string;
        }
      }
      store.updateZone(zone, updates, pageId);
      return `Updated zone ${zone} settings`;
    }

    case 'update_component': {
      const safeUpdates = ensureTableIds(args.updates as AnyRecord);
      store.updateComponent(
        args.id as string,
        safeUpdates as Parameters<typeof store.updateComponent>[1]
      );
      return `Updated component ${args.id}`;
    }

    case 'remove_component':
      store.removeComponent(args.id as string);
      return `Removed component ${args.id}`;

    case 'load_template':
      store.loadTemplate(args.name as Parameters<typeof store.loadTemplate>[0]);
      return `Loaded template "${args.name}"`;

    case 'set_page': {
      const current = useDesignerStore.getState().schema.page;
      const m = (args.margin as Record<string, string> | undefined) ?? {};
      store.updateSchema({
        page: {
          ...current,
          size: (args.size as typeof current.size | undefined) ?? current.size,
          orientation:
            (args.orientation as typeof current.orientation | undefined) ?? current.orientation,
          margin: {
            top: m.top ?? current.margin.top,
            bottom: m.bottom ?? current.margin.bottom,
            left: m.left ?? current.margin.left,
            right: m.right ?? current.margin.right,
          },
        },
      });
      return `Set page to ${args.size ?? current.size} ${args.orientation ?? current.orientation}`;
    }

    case 'set_sample_data': {
      store.setSampleData(args.data as Record<string, unknown>);
      return 'Sample data injected';
    }

    case 'get_layout': {
      const { schema: s } = useDesignerStore.getState();
      const fmt = (cs: ComponentNode[]) =>
        cs.length === 0
          ? 'empty'
          : cs
              .map((c) => {
                const p = `${(c.x ?? 0).toFixed(0)},${(c.y ?? 0).toFixed(0)}`;
                const sz = `${(c.width ?? 0).toFixed(0)}×${(c.height ?? 0).toFixed(0)}mm`;
                if (c.type === 'text')
                  return `text(id:${c.id} @${p} ${sz} "${c.content.slice(0, 30)}")`;
                if (c.type === 'table')
                  return `table(id:${c.id} @${p} ${sz} ${c.columns.length}cols)`;
                return `${c.type}(id:${c.id} @${p} ${sz})`;
              })
              .join(' | ');
      return [
        `Header: ${fmt(s.zones.header.components)}`,
        ...s.pages.map((p, i) => `Body p${i + 1}: ${fmt(p.body.components)}`),
        `Footer: ${fmt(s.zones.footer.components)}`,
      ].join('\n');
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── API types ────────────────────────────────────────────────────────────────

interface ApiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

type ApiMsg =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ApiToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface ApiResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: ApiToolCall[];
    };
    finish_reason: string;
  }>;
}

const MAX_TOOL_ROUNDS = 8;
const HISTORY_WINDOW = 6; // UI messages to include in each request

type IntentMode = 'chat' | 'plan' | 'design' | 'quick';

// Fast client-side pre-classifier — skips server round-trip for obvious cases
function quickClassify(text: string): IntentMode | null {
  const t = text.trim().toLowerCase();

  // Short greetings / acknowledgements → chat immediately
  if (
    t.length <= 25 &&
    /^(hi|hello|hey|yo|sup|ok|okay|thanks|thank you|สวัสดี|หวัดดี|ดีจ้า|โอเค|ขอบคุณ|ขอบคุณมาก)/.test(t)
  ) {
    return 'chat';
  }

  // Explicit planning vocabulary → plan
  if (
    /ช่วยวางแผน|help me plan|let'?s plan|advise( me)?|what should (i|we) include|best (way|structure|approach) (to|for)|how should i (design|layout|structure)|planning|วางแผน|แนะนำ layout/.test(
      t
    )
  ) {
    return 'plan';
  }

  // Single-element CRUD → quick (1 API call, no get_layout loop)
  // Pattern: short action on one specific element type
  const isShort = t.length <= 80;
  if (isShort) {
    if (/^(เพิ่ม|add|insert|place)\s+(text|ข้อความ|image|รูป|line|เส้น|spacer|ช่องว่าง)/.test(t))
      return 'quick';
    if (/^(ลบ|delete|remove)\s/.test(t)) return 'quick';
    if (
      /^(แก้ไข|update|change|edit|move|ย้าย|ปรับ)\s/.test(t) &&
      !/(layout|ทั้งหมด|all|invoice|report)/.test(t)
    )
      return 'quick';
  }

  // Full layout / complex build → design (multi-round loop)
  if (
    /^(create |build |make |สร้าง |ออกแบบ |design |load |โหลด |ทำ )(invoice|layout|report|template|รายงาน|ใบแจ้ง|ใบเสร็จ|เอกสาร)/.test(
      t
    ) ||
    /invoice|layout|template|report|ใบแจ้ง|ใบเสร็จ|รายงาน/.test(t)
  ) {
    return 'design';
  }

  // Short direct imperative (เพิ่ม/add with no matching element type above) → quick if short
  if (isShort && /^(เพิ่ม |add |ลบ |delete |remove )/.test(t)) return 'quick';

  return null; // uncertain — let the server classifier decide
}

async function classifyIntent(message: string, signal?: AbortSignal): Promise<IntentMode> {
  try {
    const res = await fetch('/api/chat/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    });
    if (!res.ok) return 'design';
    const data = (await res.json()) as { mode: IntentMode };
    return data.mode;
  } catch {
    return 'design';
  }
}

function parseAiError(errorStr: string): string {
  try {
    const parsed = JSON.parse(errorStr);
    // OpenRouter/OpenAI often nest errors
    const innerError = typeof parsed.error === 'string' ? JSON.parse(parsed.error) : parsed.error;
    return innerError?.error?.message || innerError?.message || errorStr;
  } catch {
    return errorStr;
  }
}

async function callApi(
  apiMessages: ApiMsg[],
  schema: LayoutSchema,
  sessionIntent?: string,
  signal?: AbortSignal,
  mode?: IntentMode,
  model?: string,
  aiMode?: 'plan' | 'act'
): Promise<ApiResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: apiMessages, schema, sessionIntent, mode, model, aiMode }),
    signal,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(parseAiError(errorText));
  }
  return res.json() as Promise<ApiResponse>;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const STORAGE_MESSAGES_KEY = 'typstflow-ai-chat-messages';
const STORAGE_MEMORY_KEY = 'typstflow-ai-session-memory';

function loadPersistedMessages(): AgentMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES_KEY);
    if (!raw) return [WELCOME];
    const parsed = JSON.parse(raw) as Array<
      Omit<AgentMessage, 'timestamp'> & { timestamp: string }
    >;
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [WELCOME];
  }
}

function loadPersistedMemory(): SessionMemory {
  try {
    const raw = localStorage.getItem(STORAGE_MEMORY_KEY);
    if (!raw) return { ...DEFAULT_SESSION_MEMORY };
    return { ...DEFAULT_SESSION_MEMORY, ...(JSON.parse(raw) as Partial<SessionMemory>) };
  } catch {
    return { ...DEFAULT_SESSION_MEMORY };
  }
}

function persistMessages(msgs: AgentMessage[]): void {
  try {
    localStorage.setItem(
      STORAGE_MESSAGES_KEY,
      JSON.stringify(msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })))
    );
  } catch {
    try {
      localStorage.setItem(
        STORAGE_MESSAGES_KEY,
        JSON.stringify(
          msgs.map((m) => ({ ...m, image: undefined, timestamp: m.timestamp.toISOString() }))
        )
      );
    } catch {}
  }
}

function persistMemory(mem: SessionMemory): void {
  try {
    localStorage.setItem(STORAGE_MEMORY_KEY, JSON.stringify(mem));
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAiAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>(() => loadPersistedMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const sessionMemoryRef = useRef<SessionMemory>(loadPersistedMemory());
  const abortControllerRef = useRef<AbortController | null>(null);
  const { aiModel, aiMode } = useDesignerStore();

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setThinkingStep('');

      // Immediately update the last assistant message to reflect it was stopped
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && (last.content === 'Working…' || !last.content)) {
          return [...prev.slice(0, -1), { ...last, content: 'Generation cancelled.' }];
        }
        return prev;
      });
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, image?: string) => {
      const model = resolveAiModel(aiModel);
      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        image,
        timestamp: new Date(),
      };
      const uiHistory = [...messages, userMsg];
      setMessages(uiHistory);
      setIsLoading(true);
      setError(null);
      setThinkingStep('Analyzing request...');

      const assistantId = crypto.randomUUID();

      const upsertAssistantMessage = (
        content: string,
        tools?: NonNullable<AgentMessage['toolCalls']>,
        msgMode?: AgentMessage['mode'],
        snapshot?: number
      ) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === assistantId);
          if (!exists) {
            return [
              ...prev,
              {
                id: assistantId,
                role: 'assistant' as const,
                content,
                mode: msgMode,
                snapshotIndex: snapshot,
                toolCalls: tools,
                timestamp: new Date(),
              },
            ];
          }
          return prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content,
                  mode: msgMode ?? m.mode,
                  snapshotIndex: snapshot ?? m.snapshotIndex,
                  toolCalls: tools ?? m.toolCalls,
                }
              : m
          );
        });
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const sessionIntent = serializeMemory(sessionMemoryRef.current);

        // Quick client-side classify first — skip network round-trip for obvious cases
        let intent: IntentMode;
        if (image) {
          intent = 'design';
        } else {
          const quickResult = quickClassify(content);
          if (quickResult) {
            intent = quickResult;
          } else {
            setThinkingStep('Classifying intent...');
            intent = await classifyIntent(content, controller.signal);
          }
        }
        if (controller.signal.aborted) return;

        const STEP_LABELS: Record<IntentMode, string> = {
          chat: 'Thinking...',
          plan: 'Planning strategy...',
          design: 'Building layout...',
          quick: 'Applying...',
        };
        setThinkingStep(STEP_LABELS[intent]);

        // Build initial API message window — strip intent blocks from history to save tokens
        const windowedHistory: ApiMsg[] = uiHistory.slice(-HISTORY_WINDOW).map((m, idx, arr) => {
          const isLatest = idx === arr.length - 1;
          const textContent = stripIntentBlock(m.content);
          if (m.role === 'user' && m.image && isLatest) {
            return {
              role: 'user',
              content: [
                { type: 'text', text: textContent },
                {
                  type: 'image_url',
                  image_url: { url: m.image },
                },
              ] as any,
            };
          }
          return { role: m.role, content: textContent };
        });

        let apiMessages: ApiMsg[] = windowedHistory;
        const allToolCalls: NonNullable<AgentMessage['toolCalls']> = [];
        const newBindings: string[] = [];
        let finalText = '';

        // Chat mode: single round, no tools, lightweight prompt
        if (intent === 'chat') {
          const { schema } = useDesignerStore.getState();
          const data = await callApi(
            apiMessages,
            schema,
            sessionIntent || undefined,
            controller.signal,
            'chat',
            model,
            aiMode
          );
          finalText = data.choices?.[0]?.message?.content ?? '';
          upsertAssistantMessage(finalText || '(no response)', undefined, 'chat');
          setMessages((prev) => {
            persistMessages(prev);
            return prev;
          });
          return;
        }

        // Plan mode: single round, full canvas context, plan persona, no tools
        if (intent === 'plan') {
          const { schema } = useDesignerStore.getState();
          const data = await callApi(
            apiMessages,
            schema,
            sessionIntent || undefined,
            controller.signal,
            'plan',
            model,
            aiMode
          );
          finalText = stripIntentBlock(data.choices?.[0]?.message?.content ?? '');
          upsertAssistantMessage(finalText || '(no response)', undefined, 'plan');
          setMessages((prev) => {
            persistMessages(prev);
            return prev;
          });
          return;
        }

        // Quick mode: single API call, no loop, no auto sample-data — for simple CRUD
        if (intent === 'quick') {
          const { schema } = useDesignerStore.getState();
          const data = await callApi(
            [{ role: 'user', content }], // skip history window — context is in system prompt
            schema,
            undefined,
            controller.signal,
            'quick',
            model,
            aiMode
          );
          const msg = data.choices?.[0]?.message;
          const quickToolCalls = msg?.tool_calls ?? [];
          const quickText = msg?.content ?? '';
          const executedCalls: NonNullable<AgentMessage['toolCalls']> = [];
          for (const tc of quickToolCalls) {
            let result: string;
            let success = true;
            try {
              const parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
              result = execTool(tc.function.name, parsedArgs);
            } catch (e) {
              result = e instanceof Error ? e.message : String(e);
              success = false;
            }
            executedCalls.push({ name: tc.function.name, success, description: result });
          }
          const displayText = quickText || (executedCalls.length > 0 ? 'Done!' : '(no response)');
          upsertAssistantMessage(
            displayText,
            executedCalls.length > 0 ? executedCalls : undefined,
            'design'
          );
          setMessages((prev) => {
            persistMessages(prev);
            return prev;
          });
          return;
        }

        // Capture history position before any tool mutates the canvas
        const checkpoint = useDesignerStore.getState().historyIndex;

        // Design mode: multi-round tool loop
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (controller.signal.aborted) break;
          setThinkingStep(
            round === 0 ? 'Executing initial plan...' : `Processing step ${round + 1}...`
          );

          const { schema } = useDesignerStore.getState();
          const data = await callApi(
            apiMessages,
            schema,
            sessionIntent || undefined,
            controller.signal,
            'design',
            model,
            aiMode
          );
          const msg = data.choices?.[0]?.message;
          finalText = msg?.content ?? '';
          const toolCalls = msg?.tool_calls ?? [];

          // Stream text update to UI (strip intent block before displaying)
          const displayText = stripIntentBlock(finalText);
          if (displayText || toolCalls.length > 0) {
            upsertAssistantMessage(
              displayText,
              allToolCalls.length > 0 ? [...allToolCalls] : undefined
            );
          }

          if (toolCalls.length === 0) break;

          // Execute tools — collect results + extract bindings from args
          const toolResults: Array<{ id: string; result: string }> = [];
          for (const tc of toolCalls) {
            let result: string;
            let success = true;
            try {
              setThinkingStep(`Applying: ${tc.function.name.replace(/_/g, ' ')}...`);
              const parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
              result = execTool(tc.function.name, parsedArgs);
              newBindings.push(...extractBindingsFromArgs(parsedArgs));
            } catch (e) {
              result = e instanceof Error ? e.message : String(e);
              success = false;
            }
            toolResults.push({ id: tc.id, result });
            allToolCalls.push({ name: tc.function.name, success, description: result });
          }

          // Update UI with accumulated tool badges (include checkpoint so Rewind appears during generation)
          upsertAssistantMessage(
            stripIntentBlock(finalText) || 'Working...',
            [...allToolCalls],
            'design',
            checkpoint
          );

          // Append assistant turn + tool results to conversation
          apiMessages = [
            ...apiMessages,
            { role: 'assistant', content: finalText || null, tool_calls: toolCalls },
            ...toolResults.map(
              (r): ApiMsg => ({ role: 'tool', tool_call_id: r.id, content: r.result })
            ),
          ];
        }

        // Auto-inject sample data if layout was built but AI forgot to call set_sample_data
        const LAYOUT_TOOLS = new Set([
          'add_text',
          'add_table',
          'add_image',
          'add_line',
          'add_spacer',
          'load_template',
        ]);
        const builtLayout = allToolCalls.some((tc) => LAYOUT_TOOLS.has(tc.name));
        const hasSampleData = allToolCalls.some((tc) => tc.name === 'set_sample_data');

        if (builtLayout && !hasSampleData && !controller.signal.aborted) {
          try {
            setThinkingStep('Generating sample data...');
            const { schema: freshSchema } = useDesignerStore.getState();
            const usedBindings = [...new Set(newBindings)].join(', ') || 'none';
            // Minimal context — avoids re-sending the full accumulated conversation
            const dataReq: ApiMsg[] = [
              {
                role: 'user',
                content: `Layout complete. Bindings used: ${usedBindings}. Call set_sample_data once with realistic Thai business mock data for every binding.`,
              },
            ];
            const dataResp = await callApi(
              dataReq,
              freshSchema,
              sessionIntent || undefined,
              controller.signal,
              'design',
              model,
              aiMode
            );
            const dataTool = dataResp.choices?.[0]?.message?.tool_calls?.find(
              (tc) => tc.function.name === 'set_sample_data'
            );
            if (dataTool) {
              const result = execTool(
                'set_sample_data',
                JSON.parse(dataTool.function.arguments) as Record<string, unknown>
              );
              allToolCalls.push({ name: 'set_sample_data', success: true, description: result });
            }
          } catch {
            // best-effort — don't fail the whole operation
          }
        }

        // Extract intent from final AI response and update session memory
        const intentPatch = extractIntentFromText(finalText);
        sessionMemoryRef.current = mergeMemory(
          { ...sessionMemoryRef.current, dataBindings: newBindings },
          intentPatch
        );
        persistMemory(sessionMemoryRef.current);

        const lastDisplayText = stripIntentBlock(finalText);
        const finalContent = controller.signal.aborted
          ? lastDisplayText
            ? `${lastDisplayText} (Stopped)`
            : 'Generation cancelled.'
          : lastDisplayText || (allToolCalls.length > 0 ? 'Done!' : '(no response)');

        upsertAssistantMessage(
          finalContent,
          allToolCalls.length > 0 ? allToolCalls : undefined,
          'design',
          checkpoint
        );
        setMessages((prev) => {
          persistMessages(prev);
          return prev;
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          // Silent abort
          return;
        }
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        upsertAssistantMessage(`Error: ${msg}`);
        setMessages((prev) => {
          persistMessages(prev);
          return prev;
        });
      } finally {
        setIsLoading(false);
        setThinkingStep('');
      }
    },
    [messages, aiModel, aiMode]
  );

  const clearMessages = useCallback(() => {
    const fresh: AgentMessage[] = [{ ...WELCOME, id: crypto.randomUUID(), timestamp: new Date() }];
    setMessages(fresh);
    persistMessages(fresh);
    sessionMemoryRef.current = { ...DEFAULT_SESSION_MEMORY };
    persistMemory(sessionMemoryRef.current);
    setError(null);
    setThinkingStep('');
  }, []);

  return { messages, isLoading, thinkingStep, error, sendMessage, clearMessages, stop };
}

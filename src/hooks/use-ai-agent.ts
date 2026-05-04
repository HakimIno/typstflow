'use client';

import { useDesignerStore } from '@/store/designer-store';
import type {
  ComponentNode,
  ImageComponent,
  LayoutSchema,
  LineComponent,
  SpacerComponent,
  TableColumn,
  TableComponent,
  TextComponent,
  ZoneKey,
} from '@/types/schema';
import { useCallback, useState } from 'react';

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolCalls?: Array<{ name: string; success: boolean; description: string }>;
}

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

const MAX_TOOL_ROUNDS = 6;
const HISTORY_WINDOW = 8; // UI messages to include in each request

async function callApi(apiMessages: ApiMsg[], schema: LayoutSchema): Promise<ApiResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: apiMessages, schema }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<ApiResponse>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAiAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([WELCOME]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      const uiHistory = [...messages, userMsg];
      setMessages(uiHistory);
      setIsLoading(true);
      setError(null);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: 'Working…', timestamp: new Date() },
      ]);

      try {
        // Build initial API message window (last N UI messages + new user msg)
        const windowedHistory: ApiMsg[] = uiHistory
          .slice(-HISTORY_WINDOW)
          .map((m) => ({ role: m.role, content: m.content }));

        let apiMessages: ApiMsg[] = windowedHistory;
        const allToolCalls: NonNullable<AgentMessage['toolCalls']> = [];
        let finalText = '';

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const { schema } = useDesignerStore.getState();
          const data = await callApi(apiMessages, schema);
          const msg = data.choices?.[0]?.message;
          finalText = msg?.content ?? '';
          const toolCalls = msg?.tool_calls ?? [];

          // Stream text update to UI
          if (finalText) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: finalText } : m))
            );
          }

          if (toolCalls.length === 0) break;

          // Execute tools and collect results
          const toolResults: Array<{ id: string; result: string }> = [];
          for (const tc of toolCalls) {
            let result: string;
            let success = true;
            try {
              const parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
              result = execTool(tc.function.name, parsedArgs);
            } catch (e) {
              result = e instanceof Error ? e.message : String(e);
              success = false;
            }
            toolResults.push({ id: tc.id, result });
            allToolCalls.push({ name: tc.function.name, success, description: result });
          }

          // Update UI with accumulated tool badges
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: finalText || `Round ${round + 1} complete…`,
                    toolCalls: [...allToolCalls],
                  }
                : m
            )
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

        if (builtLayout && !hasSampleData) {
          try {
            const { schema: freshSchema } = useDesignerStore.getState();
            const dataReq: ApiMsg[] = [
              ...apiMessages,
              {
                role: 'user',
                content:
                  'The layout is built. Now call set_sample_data once with a complete, realistic Thai business mock data object covering every {{binding}} used in the layout.',
              },
            ];
            const dataResp = await callApi(dataReq, freshSchema);
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

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: finalText || (allToolCalls.length > 0 ? 'Done!' : '(no response)'),
                  toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
                }
              : m
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([{ ...WELCOME, id: crypto.randomUUID(), timestamp: new Date() }]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}

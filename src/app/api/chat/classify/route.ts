import type { NextRequest } from 'next/server';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Cheap intent classifier — uses the same model but with max_tokens:4
// Returns { mode: 'chat' | 'design' }
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ mode: 'design' });

  const model = process.env.OPENROUTER_MODEL_NAME ?? 'anthropic/claude-3.5-sonnet';
  const { message } = (await req.json()) as { message: string };

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': req.headers.get('origin') ?? 'https://typstflow.app',
      'X-Title': 'TypstFlow',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4,
      messages: [
        {
          role: 'system',
          content:
            'You classify messages for a PDF report designer tool called TypstFlow.\n' +
            'Reply with only ONE word:\n' +
            '  "design" — if the message requests creating, editing, or modifying layout elements on the canvas (add component, build layout, load template, change style, etc.)\n' +
            '  "chat"   — if the message is a question, greeting, explanation request, or does NOT require touching the canvas.\n' +
            'Examples of "design": "สร้าง invoice", "add a table", "make the title bold", "build me a receipt"\n' +
            'Examples of "chat": "what is Typst?", "ทำไม font ถึงเล็ก", "hello", "how many pages do I have?", "explain binding syntax"',
        },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok) return Response.json({ mode: 'design' });

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim().toLowerCase() ?? '';
  const mode = raw.startsWith('chat') ? 'chat' : 'design';

  return Response.json({ mode });
}

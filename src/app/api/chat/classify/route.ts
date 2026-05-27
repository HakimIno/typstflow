import type { NextRequest } from 'next/server';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Returns { mode: 'chat' | 'plan' | 'design' }
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ mode: 'design' });

  const { message } = (await req.json()) as { message: string };
  // Classifier uses a cheap fast model — binary output only needs gpt-4o-mini
  const model = process.env.OPENROUTER_CLASSIFIER_MODEL ?? 'openai/gpt-4o-mini';

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
      max_tokens: 6,
      messages: [
        {
          role: 'system',
          content:
            'You classify user messages for TypstFlow, a PDF report designer.\n' +
            'Reply with exactly ONE word: "chat", "plan", or "design"\n\n' +
            '"design" — user wants to CREATE or MODIFY canvas elements RIGHT NOW (add component, build layout, load template, update/delete element, change style)\n' +
            '"plan"   — user wants to DISCUSS, STRATEGIZE, or GET ADVICE about a design WITHOUT building yet (help plan, what should I include, best way to design, advise on layout, let\'s think about, ช่วยวางแผน)\n' +
            '"chat"   — greeting, general question, explanation request, or does NOT require touching the canvas\n\n' +
            'Examples "design": "สร้าง invoice", "add a table", "make the title bold", "build me a receipt", "load template", "delete the header text"\n' +
            'Examples "plan":   "I want to build a receipt, what should I include?", "ช่วยวางแผน layout ใบเสร็จ", "what\'s the best structure for a tax invoice?", "advise me on layout"\n' +
            'Examples "chat":   "what is Typst?", "สวัสดี", "hello", "hi", "how many pages do I have?", "explain binding syntax", "thanks"',
        },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!res.ok) return Response.json({ mode: 'design' });

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim().toLowerCase() ?? '';
  const mode = raw.startsWith('plan') ? 'plan' : raw.startsWith('chat') ? 'chat' : 'design';

  return Response.json({ mode: mode as 'chat' | 'plan' | 'design' });
}

import { createShare } from '@/lib/server/share-db';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schema, sampleData } = body as {
      schema: unknown;
      sampleData: unknown;
    };

    if (!schema || typeof schema !== 'object') {
      return NextResponse.json({ error: 'schema is required' }, { status: 400 });
    }

    const share = createShare(
      schema as Parameters<typeof createShare>[0],
      (sampleData as Record<string, unknown>) ?? {}
    );

    return NextResponse.json({ id: share.id, name: share.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

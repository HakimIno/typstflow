import { getShare } from '@/lib/server/share-db';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = getShare(id);
  if (!share) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    id: share.id,
    schema: share.schema,
    sampleData: share.sampleData,
    name: share.name,
    createdAt: share.createdAt,
  });
}

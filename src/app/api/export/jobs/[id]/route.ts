import { getExportJob } from '@/lib/server/export-jobs';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const job = getExportJob(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    error: job.error,
    fileName: job.fileName,
  });
}

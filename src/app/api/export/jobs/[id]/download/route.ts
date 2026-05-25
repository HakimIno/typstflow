import { deleteExportJob, getExportJob, readExportJobPdf } from '@/lib/server/export-jobs';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const job = getExportJob(id);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'done') {
    return NextResponse.json(
      { error: 'PDF not ready', status: job.status, progress: job.progress },
      { status: 409 }
    );
  }

  const pdfBuffer = readExportJobPdf(id);
  if (!pdfBuffer) {
    return NextResponse.json({ error: 'PDF file missing' }, { status: 410 });
  }

  const response = new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${job.fileName}"`,
    },
  });

  // Remove job after successful download to free disk space.
  deleteExportJob(id);

  return response;
}

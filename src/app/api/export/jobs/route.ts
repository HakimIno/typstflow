import { createExportJob } from '@/lib/server/export-jobs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createJobSchema = z.object({
  schema: z.unknown(),
  data: z.record(z.string(), z.unknown()).default({}),
  fileName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = createJobSchema.parse(body);
    const fileName = validated.fileName?.trim() || 'report.pdf';

    const job = createExportJob(validated.schema, validated.data, fileName);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('[export/jobs] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

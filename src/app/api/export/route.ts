import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prepareExportWorkspace, removeExportJobDir } from '@/lib/server/export-workspace';
import { compileTypstToPdf } from '@/lib/server/typst-compile';
import type { LayoutSchema } from '@/types/schema';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const exportSchema = z.object({
  schema: z.unknown(),
  data: z.record(z.string(), z.unknown()).default({}),
});

/** Synchronous PDF export with full assets/fonts/packages (WYSIWYG with preview). */
export async function POST(req: NextRequest) {
  let jobId: string | undefined;

  try {
    const body = await req.json();
    const validated = exportSchema.parse(body);

    const tmpDir = path.join(process.cwd(), '.tmp');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    jobId = Math.random().toString(36).substring(7);
    const workspace = await prepareExportWorkspace(
      jobId,
      validated.schema as LayoutSchema,
      validated.data
    );

    try {
      await compileTypstToPdf({
        inputPath: workspace.typPath,
        outputPath: workspace.pdfPath,
        rootDir: workspace.jobDir,
        fontDir: workspace.fontsDir,
        packageDir: workspace.packagesDir,
      });
    } catch (compileError) {
      console.error('Typst compile error:', compileError);
      return NextResponse.json({ error: 'Failed to compile PDF' }, { status: 500 });
    }

    const pdfBuffer = readFileSync(workspace.pdfPath);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${jobId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    if (jobId) await removeExportJobDir(jobId);
  }
}

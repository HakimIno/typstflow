import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { prepareExportWorkspace } from '@/lib/server/export-workspace';
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
  try {
    const body = await req.json();
    const validated = exportSchema.parse(body);

    const tmpDir = path.join(process.cwd(), '.tmp');
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    const id = Math.random().toString(36).substring(7);
    const workspace = await prepareExportWorkspace(
      id,
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

    try {
      unlinkSync(workspace.pdfPath);
      unlinkSync(workspace.typPath);
    } catch {
      // ignore
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

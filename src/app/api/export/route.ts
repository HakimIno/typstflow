import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { schemaToTypst } from '@/lib/schema-to-typst';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const exportSchema = z.object({
  schema: z.any(), // We could use a more specific Zod schema if we had time to mirror the TS interfaces
  data: z.record(z.string(), z.any()),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = exportSchema.parse(body);

    const typstCode = schemaToTypst(validated.schema, validated.data);

    // Create tmp directory if not exists
    const tmpDir = path.join(process.cwd(), '.tmp');
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }

    const id = Math.random().toString(36).substring(7);
    const typPath = path.join(tmpDir, `${id}.typ`);
    const pdfPath = path.join(tmpDir, `${id}.pdf`);

    // Write .typ file
    writeFileSync(typPath, typstCode);

    // Run typst compile
    // Using absolute path for typst as found earlier
    try {
      execSync(`/usr/local/bin/typst compile "${typPath}" "${pdfPath}"`, {
        stdio: 'inherit',
      });
    } catch (compileError) {
      console.error('Typst compile error:', compileError);
      return NextResponse.json({ error: 'Failed to compile PDF' }, { status: 500 });
    }

    // Read PDF
    const pdfBuffer = readFileSync(pdfPath);

    // Cleanup
    unlinkSync(typPath);
    unlinkSync(pdfPath);

    // Return PDF
    return new NextResponse(pdfBuffer, {
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

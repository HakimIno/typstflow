import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const CUSTOM_FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'custom');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // Security check: prevent directory traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(CUSTOM_FONTS_DIR, safeFileName);

    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(safeFileName).toLowerCase();
      const contentType = ext === '.otf' ? 'font/otf' : 'font/ttf';

      return new Response(data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Font file not found' }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

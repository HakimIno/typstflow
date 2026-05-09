import { FONT_CATALOG } from '@/lib/font-catalog';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const family = searchParams.get('family');
  const weight = parseInt(searchParams.get('weight') || '400', 10);

  if (!family) {
    return NextResponse.json({ error: 'family is required' }, { status: 400 });
  }

  const entry = FONT_CATALOG.find((f) => f.family === family);
  if (!entry) {
    return NextResponse.json({ error: `Unknown font family: ${family}` }, { status: 404 });
  }
  if (entry.builtIn) {
    return NextResponse.json({ error: 'Built-in font — no download needed' }, { status: 400 });
  }
  if (!entry.githubUrls) {
    return NextResponse.json({ error: 'No source URL configured for this font' }, { status: 500 });
  }

  const url = entry.githubUrls[weight] ?? entry.githubUrls[400];
  if (!url) {
    return NextResponse.json({ error: `No URL for weight ${weight}` }, { status: 404 });
  }

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TypstFlow/1.0 (font-proxy)' },
    });
    if (!res.ok) {
      console.error(`[fonts API] GitHub fetch failed: ${res.status} ${url}`);
      return NextResponse.json({ error: `Source fetch failed: ${res.status}` }, { status: 502 });
    }
    buffer = await res.arrayBuffer();
  } catch (e) {
    console.error('[fonts API] Fetch error:', e);
    return NextResponse.json({ error: 'Cannot reach font source' }, { status: 502 });
  }

  if (buffer.byteLength < 4000) {
    console.error(`[fonts API] File too small (${buffer.byteLength} bytes) — likely an error page: ${url}`);
    return NextResponse.json({ error: 'Font data too small' }, { status: 502 });
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': 'font/ttf',
      'Cache-Control': 'public, max-age=604800', // 7 days
    },
  });
}

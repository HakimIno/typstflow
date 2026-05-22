import { TypstGenerator } from '../engine/generator';
import init, { TypstBridge } from '../wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;

const imageCache = new Map<string, string>();
const compressedImageCache = new Map<string, string>();
let lastImagesHash = '';

// IDs of in-flight SVG streams that have been cancelled by the main thread.
// Checked before each chunk yield so the worker can bail early.
const cancelledIds = new Set<string>();

async function initialize() {
  if (bridge) return;
  try {
    await init();
    bridge = new TypstBridge();
    self.postMessage({ type: 'READY' });
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      payload: `Failed to initialize WASM: ${err.message || err}`,
    });
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function workerLog(type: 'log' | 'warn' | 'error', ...args: any[]) {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  self.postMessage({ type: 'worker_log', logType: type, payload: msg });
}

function getMimeFromDataUrl(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : undefined;
}

function sniffExtension(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
      return 'webp';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return 'gif';
  return 'png';
}

function getExtFromMime(mime?: string): string {
  if (!mime) return 'png';
  const mapping: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return mapping[mime] || 'png';
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL: missing comma');
  const base64 = dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getImageCacheKey(compId: string, srcData: string): string {
  return `${compId}:${srcData.length}:${srcData.slice(0, 32)}`;
}

function bytesToBinaryString(bytes: Uint8Array): string {
  // Never use spread (`...bytes`) — large arrays exceed the call stack.
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    let segment = '';
    for (let j = i; j < end; j++) {
      segment += String.fromCharCode(bytes[j]);
    }
    parts.push(segment);
  }
  return parts.join('');
}

// ── Image Compression ─────────────────────────────────────────────────────────

/** Max pixel dimension for PDF images — 150 DPI on A4 (210mm × ~1240px) with headroom. */
const PDF_MAX_DIMENSION = 1800;
/** JPEG quality for PDF export — visually lossless for print, ~40-70% smaller than PNG. */
const PDF_JPEG_QUALITY = 0.88;

/**
 * Sample corners, edges, and center of the canvas to detect semi-transparent pixels.
 * Uses 7 small 32×32 regions instead of reading the full image — O(1) for any size.
 */
function detectAlpha(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): boolean {
  const sw = Math.min(w, 32);
  const sh = Math.min(h, 32);
  const cx = Math.floor((w - sw) / 2);
  const cy = Math.floor((h - sh) / 2);
  const regions: [number, number, number, number][] = [
    [0, 0, sw, sh], // top-left
    [w - sw, 0, sw, sh], // top-right
    [0, h - sh, sw, sh], // bottom-left
    [w - sw, h - sh, sw, sh], // bottom-right
    [cx, 0, sw, sh], // top-center
    [0, cy, sw, sh], // left-center
    [cx, cy, sw, sh], // center
  ];
  for (const [rx, ry, rw, rh] of regions) {
    const data = ctx.getImageData(rx, ry, rw, rh).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
  }
  return false;
}

/**
 * Compress a single image data URL for PDF embedding:
 * - Resize to PDF_MAX_DIMENSION if larger (preserves aspect ratio)
 * - Convert to JPEG (0.88 quality) unless image has alpha transparency
 * - Keep as PNG if transparent (JPEG has no alpha channel)
 * - Skip tiny images (≤ 200px) — already minimal
 * - Return original if compressed result is not meaningfully smaller (< 5% gain)
 */
async function compressImageForPdf(dataUrl: string): Promise<string> {
  const cacheKey = `${dataUrl.length}:${dataUrl.slice(0, 100)}`;
  const cached = compressedImageCache.get(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;

    // Tiny images (icons, stamps, small logos) — skip, not worth the overhead
    if (width <= 200 && height <= 200) {
      bitmap.close();
      return dataUrl;
    }

    const scale = Math.min(1, PDF_MAX_DIMENSION / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    // Only check for alpha on formats that support it
    const mightHaveAlpha = blob.type === 'image/png' || blob.type === 'image/webp';
    const transparent = mightHaveAlpha && detectAlpha(ctx, w, h);

    const outType = transparent ? 'image/png' : 'image/jpeg';
    const outBlob = await canvas.convertToBlob({
      type: outType,
      quality: transparent ? undefined : PDF_JPEG_QUALITY,
    });

    // Only accept compressed version if it's meaningfully smaller
    if (outBlob.size >= blob.size * 0.95) return dataUrl;

    // Blob → base64 data URL (chunked — no spread on large byte arrays)
    const buf = await outBlob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const result = `data:${outType};base64,${btoa(bytesToBinaryString(bytes))}`;
    compressedImageCache.set(cacheKey, result);
    return result;
  } catch {
    return dataUrl; // Graceful fallback — never break export on compression error
  }
}

/**
 * Walk every image component in the schema and compress all in parallel.
 * Mutates comp.srcData in-place (safe — the schema received via postMessage
 * is a structured-clone copy; the main thread's store is untouched).
 */
async function compressSchemaImages(schema: any): Promise<void> {
  const tasks: Promise<void>[] = [];

  const collect = (comps: any[]) => {
    if (!Array.isArray(comps)) return;
    for (const comp of comps) {
      if (comp.type === 'image' && comp.srcData) {
        tasks.push(
          compressImageForPdf(comp.srcData).then((compressed) => {
            comp.srcData = compressed;
          })
        );
      }
      if (comp.type === 'repeater') collect(comp.children ?? []);
      if (comp.type === 'columns') {
        for (const col of comp.columns ?? []) collect(col.components ?? []);
      }
    }
  };

  collect(schema.zones?.header?.components ?? []);
  collect(schema.zones?.footer?.components ?? []);
  for (const page of schema.pages ?? []) collect(page.body?.components ?? []);
  for (const g of schema.groups ?? []) {
    collect(g.header?.components ?? []);
    collect(g.footer?.components ?? []);
  }

  await Promise.all(tasks);
}

// ── Image Registry ────────────────────────────────────────────────────────────

function walkComponents(components: any[], activeCacheKeys: Set<string>): void {
  if (!components || !Array.isArray(components)) return;

  for (const comp of components) {
    if (comp.type === 'image' && comp.srcData) {
      const cacheKey = getImageCacheKey(comp.id, comp.srcData);
      const cached = imageCache.get(cacheKey);

      if (cached) {
        comp.src = cached;
      } else {
        try {
          const bytes = dataUrlToBytes(comp.srcData);
          const sniffedExt = sniffExtension(bytes);
          let ext = sniffedExt;
          if (sniffedExt === 'png' && !comp.srcData.startsWith('data:image/png')) {
            const mimeFromData = getMimeFromDataUrl(comp.srcData);
            ext = getExtFromMime(mimeFromData || comp.mimeType);
          }
          const virtualPath = `asset-${comp.id}.${ext}`;
          bridge?.register_image(virtualPath, bytes);
          imageCache.set(cacheKey, virtualPath);
          comp.src = virtualPath;
        } catch (e) {
          console.warn(`[Worker] Failed to register image ${comp.id} (${comp.src}):`, e);
        }
      }

      if (comp.src) activeCacheKeys.add(cacheKey);
    }

    if (comp.type === 'repeater' && comp.children) {
      walkComponents(comp.children, activeCacheKeys);
    } else if (comp.type === 'columns' && comp.columns) {
      for (const col of comp.columns) {
        if (col.components) walkComponents(col.components, activeCacheKeys);
      }
    }
  }
}

function computeImagesHash(schema: any): string {
  const parts: string[] = [];
  const collect = (comps: any[]) => {
    for (const c of comps || []) {
      if (c.type === 'image' && c.srcData) parts.push(`${c.id}:${c.srcData.length}`);
      if (c.type === 'repeater') collect(c.children || []);
      if (c.type === 'columns') {
        for (const col of c.columns || []) collect(col.components || []);
      }
    }
  };
  collect(schema.zones?.header?.components || []);
  collect(schema.zones?.footer?.components || []);
  for (const p of schema.pages || []) collect(p.body?.components || []);
  for (const g of schema.groups || []) {
    collect(g.header?.components || []);
    collect(g.footer?.components || []);
  }
  return parts.join('|');
}

function injectImagesIntoSchema(schema: any): any {
  if (!bridge || !schema?.zones) return schema;

  const s = schema;
  const currentHash = computeImagesHash(s);
  const imagesChanged = currentHash !== lastImagesHash;

  if (imagesChanged) {
    bridge.clear_images();
    imageCache.clear();
    lastImagesHash = currentHash;
  }

  if (s.zones.header.repeatOnEveryPage === undefined) s.zones.header.repeatOnEveryPage = false;
  if (s.zones.footer.repeatOnEveryPage === undefined) s.zones.footer.repeatOnEveryPage = false;

  const activeCacheKeys = new Set<string>();

  for (const zoneName of ['header', 'footer'] as const) {
    const zone = s.zones?.[zoneName];
    if (!zone) continue;
    if (!zone.components || zone.components.length === 0) {
      zone.components = [
        { id: `dummy-${zoneName}`, type: 'text', content: '', x: 0, y: 0, width: 1, height: 1 },
      ];
    } else {
      walkComponents(zone.components, activeCacheKeys);
    }
  }

  if (s.pages && Array.isArray(s.pages)) {
    for (const page of s.pages) {
      if (!page.body) continue;
      if (!page.body.components || page.body.components.length === 0) {
        page.body.components = [
          {
            id: `dummy-body-${page.id}`,
            type: 'text',
            content: '',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ];
      } else {
        walkComponents(page.body.components, activeCacheKeys);
      }
    }
  }

  for (const key of imageCache.keys()) {
    if (!activeCacheKeys.has(key)) imageCache.delete(key);
  }

  return s;
}

// ── Message Handler ───────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  if (type === 'INIT') {
    await initialize();
    return;
  }

  if (!bridge) {
    self.postMessage({ id, type: 'error', payload: 'Bridge not initialized' });
    return;
  }

  try {
    switch (type) {
      case 'RENDER_SVG': {
        const svg = bridge.render_svg(payload);
        self.postMessage({ id, type: 'success', payload: svg });
        break;
      }
      case 'RENDER_PDF': {
        const pdf = bridge.render_pdf(payload);
        self.postMessage({ id, type: 'success', payload: pdf }, {
          transfer: [pdf.buffer],
        } as any);
        break;
      }
      case 'RENDER_REPORT_SVG': {
        const { schema, data } = payload;
        const now = new Date();
        bridge.set_today(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const preparedSchema = injectImagesIntoSchema(schema);
        const generator = new TypstGenerator();
        const typstCode = generator.generate(preparedSchema, data);
        const svg = bridge.render_svg(typstCode);
        self.postMessage({ id, type: 'success', payload: svg });
        break;
      }
      case 'CANCEL': {
        // Fire-and-forget: mark the given stream id as cancelled.
        // The chunk loop in RENDER_REPORT_SVG_STREAM checks this before each yield.
        if (payload?.id) cancelledIds.add(payload.id as string);
        break;
      }
      case 'RENDER_REPORT_SVG_STREAM': {
        const { schema, data, pageIndices } = payload as {
          schema: unknown;
          data: unknown;
          pageIndices?: number[];
        };
        const now = new Date();
        bridge.set_today(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const preparedSchema = injectImagesIntoSchema(schema);
        const generator = new TypstGenerator();
        const generateOpts =
          pageIndices && pageIndices.length > 0 ? { pageIndices } : undefined;
        const typstCode = generator.generate(
          preparedSchema,
          data as Record<string, unknown>,
          generateOpts ?? {}
        );

        const svgString = bridge.render_svg(typstCode);
        const pages = svgString
          .split('<!-- PAGE_BREAK -->')
          .filter((s: string) => s.trim().length > 0);

        if (pageIndices && pageIndices.length > 0) {
          for (let i = 0; i < pages.length; i++) {
            if (cancelledIds.has(id)) {
              cancelledIds.delete(id);
              return;
            }
            const targetIdx = pageIndices[i] ?? i;
            self.postMessage({
              id,
              type: 'progress',
              payload: { pages: [pages[i]], startIdx: targetIdx },
            });
            await new Promise((r) => setTimeout(r, 0));
          }
        } else {
          const CHUNK_SIZE = 25;
          for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
            if (cancelledIds.has(id)) {
              cancelledIds.delete(id);
              return;
            }
            self.postMessage({
              id,
              type: 'progress',
              payload: { pages: pages.slice(i, i + CHUNK_SIZE), startIdx: i },
            });
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        if (cancelledIds.has(id)) {
          cancelledIds.delete(id);
        } else {
          self.postMessage({ id, type: 'success', payload: null });
        }
        break;
      }
      case 'RENDER_REPORT_PDF': {
        const { schema, data } = payload;
        const now = new Date();
        bridge.set_today(now.getFullYear(), now.getMonth() + 1, now.getDate());

        // Stage 1: compress all images in parallel before WASM sees them
        self.postMessage({ id, type: 'stage', payload: 'compressing' });
        await compressSchemaImages(schema);

        // Stage 2: compile Typst → PDF via WASM
        self.postMessage({ id, type: 'stage', payload: 'compiling' });
        const preparedSchema = injectImagesIntoSchema(schema);
        const generator = new TypstGenerator();
        const typstCode = generator.generate(preparedSchema, data);
        const pdf = bridge.render_pdf(typstCode);

        self.postMessage({ id, type: 'success', payload: pdf }, {
          transfer: [pdf.buffer],
        } as any);
        break;
      }
      case 'GENERATE_REPORT_TYPST': {
        const { schema, data } = payload;
        const generator = new TypstGenerator();
        const source = generator.generate(schema, data, { pretty: true });
        self.postMessage({ id, type: 'success', payload: source });
        break;
      }
      case 'REGISTER_FONT': {
        const bytes = new Uint8Array(payload as ArrayBuffer);
        const success = bridge.register_font(bytes);
        workerLog('log', 'REGISTER_FONT success:', success, 'Current WASM fonts:', Array.from(bridge.get_font_names() as string[]));
        self.postMessage({ id, type: 'success', payload: success });
        break;
      }
      case 'GET_FONT_NAMES': {
        const names = Array.from(bridge.get_font_names() as string[]);
        self.postMessage({ id, type: 'success', payload: names });
        break;
      }
      case 'PARSE_CSV': {
        const jsonStr = bridge.parse_csv_bytes(payload as Uint8Array);
        self.postMessage({ id, type: 'success', payload: jsonStr });
        break;
      }
      case 'PARSE_XLSX': {
        const jsonStr = bridge.parse_xlsx(payload as Uint8Array);
        self.postMessage({ id, type: 'success', payload: jsonStr });
        break;
      }
    }
  } catch (err: any) {
    console.error('Typst Worker [RENDER ERROR]:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, type: 'error', payload: errorMessage });
  }
};

initialize();

import init, { TypstBridge } from '../wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;

// Image cache: tracks which images are currently registered in the WASM bridge.
// Key = "<compId>:<dataLength>:<first32chars>" — cheap but reliable identity check.
// This avoids bridge.clear_images() + full re-decode on every render call.
const imageCache = new Map<string, string>(); // cacheKey → virtualPath
let lastImagesHash = '';

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
  // Length + prefix is fast and effectively unique for normal usage
  return `${compId}:${srcData.length}:${srcData.slice(0, 32)}`;
}

/**
 * Walk components, register new/changed images, and swap comp.src to virtual paths.
 * Uses imageCache to skip re-decoding unchanged images.
 */
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

/**
 * Build a cheap hash of all image identities in the schema.
 * Used to detect whether any images have changed since the last render.
 */
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

/**
 * Walk the schema, register image bytes in the WASM bridge (only if changed),
 * and replace comp.src with virtual paths. Also injects dummy components into
 * empty zones to force the WASM bridge to render them.
 */
function injectImagesIntoSchema(schema: any): any {
  if (!bridge || !schema?.zones) return schema;

  const s = schema;

  // Only clear + re-register images when something has actually changed.
  // Most renders (text edits, position moves) touch no images — skip entirely.
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

  // Prune stale entries from the local cache (not from WASM — bridge manages its own memory)
  for (const key of imageCache.keys()) {
    if (!activeCacheKeys.has(key)) imageCache.delete(key);
  }

  return s;
}

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
        const svg = bridge.render_report_svg(JSON.stringify(preparedSchema), JSON.stringify(data));
        self.postMessage({ id, type: 'success', payload: svg });
        break;
      }
      case 'RENDER_REPORT_SVG_STREAM': {
        const { schema, data } = payload;
        const now = new Date();
        bridge.set_today(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const preparedSchema = injectImagesIntoSchema(schema);
        const svgString = bridge.render_report_svg(
          JSON.stringify(preparedSchema),
          JSON.stringify(data),
        );
        const pages = svgString
          .split('<!-- PAGE_BREAK -->')
          .filter((s: string) => s.trim().length > 0);

        const CHUNK_SIZE = 10;
        for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
          self.postMessage({
            id,
            type: 'progress',
            payload: { pages: pages.slice(i, i + CHUNK_SIZE), startIdx: i },
          });
          // Yield to let the main thread process this chunk before sending the next.
          await new Promise((r) => setTimeout(r, 0));
        }
        self.postMessage({ id, type: 'success', payload: null });
        break;
      }
      case 'RENDER_REPORT_PDF': {
        const { schema, data } = payload;
        const now = new Date();
        bridge.set_today(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const preparedSchema = injectImagesIntoSchema(schema);
        const pdf = bridge.render_report_pdf(JSON.stringify(preparedSchema), JSON.stringify(data));
        self.postMessage({ id, type: 'success', payload: pdf }, {
          transfer: [pdf.buffer],
        } as any);
        break;
      }
      case 'GENERATE_REPORT_TYPST': {
        const { schema, data } = payload;
        const source = bridge.generate_report_typst(JSON.stringify(schema), JSON.stringify(data));
        self.postMessage({ id, type: 'success', payload: source });
        break;
      }
      case 'REGISTER_FONT': {
        const bytes = new Uint8Array(payload as ArrayBuffer);
        const success = bridge.register_font(bytes);
        self.postMessage({ id, type: 'success', payload: success });
        break;
      }
      case 'GET_FONT_NAMES': {
        const names = Array.from(bridge.get_font_names() as string[]);
        self.postMessage({ id, type: 'success', payload: names });
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

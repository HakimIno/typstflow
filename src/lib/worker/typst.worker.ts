import init, { TypstBridge } from '../wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;

// Initialize the WASM module in the worker thread
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

/**
 * Extract MIME type from a data URL (e.g., "data:image/webp;base64,..." -> "image/webp").
 */
function getMimeFromDataUrl(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : undefined;
}

/**
 * Sniff the file extension from image magic bytes.
 * This is more reliable than trusting the MIME type header.
 */
function sniffExtension(bytes: Uint8Array): string {
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  // WebP: RIFF .... WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
      return 'webp';
  }
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return 'gif';

  return 'png';
}

/**
 * Determine the file extension from a MIME type (fallback).
 */
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

/**
 * Decode a base64 data URL ("data:image/png;base64,...") to a Uint8Array.
 */
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

/**
 * Recursively walk components to register images and swap src to virtual paths.
 */
function walkComponents(components: any[]) {
  if (!components || !Array.isArray(components)) return;

  for (const comp of components) {
    if (comp.type === 'image' && comp.srcData) {
      try {
        const bytes = dataUrlToBytes(comp.srcData);

        // Sniff real extension from bytes instead of trusting headers
        const sniffedExt = sniffExtension(bytes);

        // Only fallback to MIME detection if sniffing didn't yield common binary formats
        // (e.g. for SVGs which are text-based)
        let ext = sniffedExt;
        if (sniffedExt === 'png' && !comp.srcData.startsWith('data:image/png')) {
          const mimeFromData = getMimeFromDataUrl(comp.srcData);
          ext = getExtFromMime(mimeFromData || comp.mimeType);
        }

        const virtualPath = `asset-${comp.id}.${ext}`;

        bridge?.register_image(virtualPath, bytes);

        // Swapping src here ensures the generator (Rust or TS) uses this exact path
        comp.src = virtualPath;
      } catch (e) {
        console.warn(`[Worker] Failed to register image ${comp.id} (${comp.src}):`, e);
        // Do NOT change comp.src if registration fails, 
        // so the generator can show "FILE NOT FOUND" instead of crashing
      }
    }

    if (comp.type === 'repeater' && comp.children) {
      walkComponents(comp.children);
    } else if (comp.type === 'columns' && comp.columns) {
      for (const col of comp.columns) {
        if (col.components) {
          walkComponents(col.components);
        }
      }
    }
  }
}

/**
 * Walk the schema, register image bytes in the WASM bridge registry, and
 * REPLACE comp.src with the virtual path "asset-{id}.{ext}".
 */
/**
 * Walk the schema, register image bytes in the WASM bridge registry, and
 * REPLACE comp.src with the virtual path "asset-{id}.{ext}".
 * Also injects dummy components into empty zones to force WASM bridge to render them.
 */
function injectImagesIntoSchema(schema: any): any {
  if (!bridge || !schema?.zones) return schema;

  // We can mutate the schema directly because the worker receives 
  // a structured clone of the data, so it won't affect the main thread.
  const s = schema;

  bridge.clear_images();

  // Ensure Header/Footer repetition is explicitly defined for WASM bridge
  if (s.zones.header.repeatOnEveryPage === undefined) s.zones.header.repeatOnEveryPage = false;
  if (s.zones.footer.repeatOnEveryPage === undefined) s.zones.footer.repeatOnEveryPage = false;

  const zoneNames = ['header', 'footer'];
  for (const zoneName of zoneNames) {
    const zone = s.zones?.[zoneName];
    if (zone) {
      // FIX: Force blank pages/zones to render in WASM bridge by adding a tiny invisible spacer if empty
      if (!zone.components || zone.components.length === 0) {
        zone.components = [{
          id: `dummy-${zoneName}`,
          type: 'text',
          content: '',
          x: 0, y: 0, width: 1, height: 1
        }];
      } else {
        walkComponents(zone.components);
      }
    }
  }

  // Iterate over all pages for body components
  if (s.pages && Array.isArray(s.pages)) {
    for (const page of s.pages) {
      if (page.body) {
        // FIX: Force empty pages to render
        if (!page.body.components || page.body.components.length === 0) {
          page.body.components = [{
            id: `dummy-body-${page.id}`,
            type: 'text',
            content: '',
            x: 0, y: 0, width: 1, height: 1
          }];
        } else {
          walkComponents(page.body.components);
        }
      }
    }
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
        const preparedSchema = injectImagesIntoSchema(schema);
        const svg = bridge.render_report_svg(JSON.stringify(preparedSchema), JSON.stringify(data));
        self.postMessage({ id, type: 'success', payload: svg });
        break;
      }
      case 'RENDER_REPORT_PDF': {
        const { schema, data } = payload;
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
    }
  } catch (err: any) {
    console.error('Typst Worker [RENDER ERROR]:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, type: 'error', payload: errorMessage });
  }
};

// Start initialization immediately
initialize();

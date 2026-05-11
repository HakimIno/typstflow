export type PdfExportStage = 'compressing' | 'compiling';

let worker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    onProgress?: (pages: string[], startIdx: number) => void;
    onStage?: (stage: PdfExportStage) => void;
  }
>();
let workerReadyPromise: Promise<void> | null = null;
let resolveWorkerReady: (() => void) | null = null;
let isWorkerReady = false;
let _idSeq = 0;

function generateId(): string {
  return `r${(++_idSeq).toString(36)}`;
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./worker/typst.worker.ts', import.meta.url));
  workerReadyPromise = new Promise((resolve) => {
    resolveWorkerReady = resolve;
  });

  worker.onmessage = (e) => {
    const { type, id, payload } = e.data;

    if (type === 'READY') {
      resolveWorkerReady?.();
      isWorkerReady = true;
      workerReadyPromise = null;
      return;
    }

    const request = pendingRequests.get(id);
    if (!request) return;

    if (type === 'progress') {
      // SVG streaming chunk: { pages: string[], startIdx: number }
      request.onProgress?.(payload.pages, payload.startIdx);
      return; // keep request alive — more chunks incoming
    }

    if (type === 'stage') {
      // PDF export stage update: 'compressing' | 'compiling'
      request.onStage?.(payload as PdfExportStage);
      return; // keep request alive — PDF result still coming
    }

    pendingRequests.delete(id);
    if (type === 'success') {
      request.resolve(payload);
    } else {
      console.error('Typst Compilation Failed:', payload);
      request.reject(new Error(payload));
    }
  };

  worker.onerror = (e) => {
    console.error('Typst Worker Error:', e);
  };

  return worker;
}

async function callWorker(type: string, payload: any, transfer?: Transferable[]): Promise<any> {
  const id = generateId();
  const w = getWorker();

  if (!isWorkerReady && workerReadyPromise) {
    await workerReadyPromise;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    if (transfer && transfer.length > 0) {
      w.postMessage({ type, id, payload }, transfer);
    } else {
      w.postMessage({ type, id, payload });
    }
  });
}

async function callWorkerStream(
  type: string,
  payload: any,
  onProgress: (pages: string[], startIdx: number) => void,
): Promise<void> {
  const id = generateId();
  const w = getWorker();

  if (!isWorkerReady && workerReadyPromise) {
    await workerReadyPromise;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
    w.postMessage({ type, id, payload });
  });
}

/**
 * Initializes the Typst WASM engine (triggers worker startup).
 */
export async function initTypst() {
  getWorker();
  return Promise.resolve();
}

/**
 * Renders Typst source code to an SVG string using the Web Worker.
 */
export async function renderToSvg(mainContent: string): Promise<string> {
  return callWorker('RENDER_SVG', mainContent);
}

/**
 * Renders Typst source code to a PDF Uint8Array using the Web Worker.
 */
export async function renderToPdf(mainContent: string): Promise<Uint8Array> {
  return callWorker('RENDER_PDF', mainContent);
}

/**
 * Streams rendered SVG pages back in chunks as they are ready.
 * onChunk is called repeatedly with each batch; resolves when all pages are sent.
 */
export async function renderReportToSvgStream(
  schema: any,
  data: any,
  onChunk: (pages: string[], startIdx: number) => void,
): Promise<void> {
  return callWorkerStream('RENDER_REPORT_SVG_STREAM', { schema, data }, onChunk);
}

/**
 * Renders a full report to a PDF Uint8Array.
 * Images are compressed (resize + JPEG re-encode) in the worker before WASM
 * receives them, reducing PDF file size by 40–80% for image-heavy documents.
 *
 * @param onStage - Optional callback fired when the worker changes phase:
 *   'compressing' (image optimization) → 'compiling' (Typst → PDF).
 *   Use this to drive progress UI.
 */
export async function renderReportToPdf(
  schema: any,
  data: any,
  onStage?: (stage: PdfExportStage) => void,
): Promise<Uint8Array> {
  const id = generateId();
  const w = getWorker();

  if (!isWorkerReady && workerReadyPromise) {
    await workerReadyPromise;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onStage });
    w.postMessage({ type: 'RENDER_REPORT_PDF', id, payload: { schema, data } });
  });
}

/**
 * Renders a full report to a PDF Uint8Array using the WASM-powered engine.
 */
export async function renderReportToSvg(schema: any, data: any): Promise<string> {
  return callWorker('RENDER_REPORT_SVG', { schema, data });
}

/**
 * Generates the Typst source code for a report using the Rust generator.
 */
export async function generateReportTypst(schema: any, data: any): Promise<string> {
  return callWorker('GENERATE_REPORT_TYPST', { schema, data });
}

/**
 * Register a font in the WASM engine at runtime.
 * Pass raw TTF/OTF bytes. The ArrayBuffer is transferred (zero-copy).
 */
export async function registerFontInWasm(data: ArrayBuffer): Promise<boolean> {
  const copy = data.slice(0);
  return callWorker('REGISTER_FONT', copy, [copy]);
}

/**
 * Get list of font family names currently available in the WASM engine.
 */
export async function getWasmFontNames(): Promise<string[]> {
  return callWorker('GET_FONT_NAMES', null);
}

/**
 * Parse CSV binary data using the high-performance Rust parser in the worker.
 */
export async function parseCsv(data: Uint8Array): Promise<string> {
  return callWorker('PARSE_CSV', data);
}

/**
 * Parse Excel binary data (XLSX, XLS, ODS) using the high-performance Rust parser in the worker.
 */
export async function parseXlsx(data: Uint8Array): Promise<string> {
  return callWorker('PARSE_XLSX', data);
}

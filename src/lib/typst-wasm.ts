let worker: Worker | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void }
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
      workerReadyPromise = null; // Clear so future calls skip the await entirely
      return;
    }

    const request = pendingRequests.get(id);
    if (!request) return;

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

async function callWorker(type: string, payload: any): Promise<any> {
  const id = generateId();
  const w = getWorker();

  // Only await the ready promise once — after it resolves, isWorkerReady
  // is set and workerReadyPromise is nulled, so future calls skip this branch.
  if (!isWorkerReady && workerReadyPromise) {
    await workerReadyPromise;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
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
 * Renders a full report to an SVG string using the WASM-powered engine.
 */
export async function renderReportToSvg(schema: any, data: any): Promise<string> {
  return callWorker('RENDER_REPORT_SVG', { schema, data });
}

/**
 * Renders a full report to a PDF Uint8Array using the WASM-powered engine.
 */
export async function renderReportToPdf(schema: any, data: any): Promise<Uint8Array> {
  return callWorker('RENDER_REPORT_PDF', { schema, data });
}

/**
 * Generates the Typst source code for a report using the Rust generator.
 */
export async function generateReportTypst(schema: any, data: any): Promise<string> {
  return callWorker('GENERATE_REPORT_TYPST', { schema, data });
}

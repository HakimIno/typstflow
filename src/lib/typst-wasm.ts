let worker: Worker | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void }
>();
let workerReadyPromise: Promise<void> | null = null;
let resolveWorkerReady: (() => void) | null = null;

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
  const id = Math.random().toString(36).substring(7);
  const w = getWorker();

  if (workerReadyPromise) {
    await workerReadyPromise;
  }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    w.postMessage({ type, id, payload });
  });
}

/**
 * Initializes the Typst WASM engine (stub for compatibility).
 */
export async function initTypst() {
  getWorker(); // Trigger initialization
  return Promise.resolve();
}

/**
 * Renders Typst source code to an SVG string using the Web Worker.
 */
export async function renderToSvg(mainContent: string): Promise<string> {
  console.log('DEBUG: Compiling Typst source:', mainContent);
  return callWorker('RENDER_SVG', mainContent);
}

/**
 * Renders Typst source code to a PDF Uint8Array using the Web Worker.
 */
export async function renderToPdf(mainContent: string): Promise<Uint8Array> {
  return callWorker('RENDER_PDF', mainContent);
}

/**
 * Renders a full report to an SVG string using the new WASM-powered engine.
 */
export async function renderReportToSvg(schema: any, data: any): Promise<string> {
  return callWorker('RENDER_REPORT_SVG', { schema, data });
}

/**
 * Renders a full report to a PDF Uint8Array using the new WASM-powered engine.
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

// Refactored to use Web Worker for main-thread responsiveness
let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: Function; reject: Function }>();

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('./typst-worker.ts', import.meta.url));
  
  worker.onmessage = (e) => {
    const { type, id, payload } = e.data;
    const request = pendingRequests.get(id);
    if (!request) return;

    pendingRequests.delete(id);
    if (type === 'success') {
      request.resolve(payload);
    } else {
      request.reject(new Error(payload));
    }
  };

  worker.onerror = (e) => {
    console.error('Typst Worker Error:', e);
  };

  return worker;
}

function callWorker(type: string, payload: string): Promise<any> {
  const id = Math.random().toString(36).substring(7);
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    getWorker().postMessage({ type, id, payload });
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
  return callWorker('render-svg', mainContent);
}

/**
 * Renders Typst source code to a PDF Uint8Array using the Web Worker.
 */
export async function renderToPdf(mainContent: string): Promise<Uint8Array> {
  return callWorker('render-pdf', mainContent);
}


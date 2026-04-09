import init, { TypstBridge } from '../wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;

// Initialize the WASM module in the worker thread
async function initialize() {
  if (bridge) return;
  try {
    await init();
    bridge = new TypstBridge();
    self.postMessage({ type: 'READY' });
  } catch (_err) {
    self.postMessage({ type: 'ERROR', error: 'Failed to initialize WASM in worker' });
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  if (type === 'INIT') {
    await initialize();
    return;
  }

  if (!bridge) {
    self.postMessage({ id, type: 'ERROR', error: 'Bridge not initialized' });
    return;
  }

  try {
    switch (type) {
      case 'RENDER_SVG': {
        const svg = bridge.render_svg(payload);
        self.postMessage({ id, type: 'RENDER_SVG_RESULT', payload: svg });
        break;
      }
      case 'RENDER_PDF': {
        const pdf = bridge.render_pdf(payload);
        self.postMessage({ id, type: 'RENDER_PDF_RESULT', payload: pdf }, {
          transfer: [pdf.buffer],
        } as any);
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({ id, type: 'ERROR', error: err.message || 'Render failed' });
  }
};

// Start initialization immediately
initialize();

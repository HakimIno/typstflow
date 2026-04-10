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
    self.postMessage({ type: 'error', payload: `Failed to initialize WASM: ${err.message || err}` });
  }
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
        const svg = bridge.render_report_svg(JSON.stringify(schema), JSON.stringify(data));
        self.postMessage({ id, type: 'success', payload: svg });
        break;
      }
      case 'RENDER_REPORT_PDF': {
        const { schema, data } = payload;
        const pdf = bridge.render_report_pdf(JSON.stringify(schema), JSON.stringify(data));
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

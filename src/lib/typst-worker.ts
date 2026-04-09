import init, { TypstBridge } from './wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (bridge) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await init();
      bridge = new TypstBridge();
      console.log('Typst Worker: Engine Initialized');
    } catch (error) {
      console.error('Typst Worker: Failed to initialize:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data;

  try {
    await ensureInit();
    if (!bridge) throw new Error('Worker bridge not initialized');

    let result: any;
    if (type === 'render-svg') {
      result = bridge.render_svg(payload);
    } else if (type === 'render-pdf') {
      result = bridge.render_pdf(payload);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ type: 'success', id, payload: result });
  } catch (error: any) {
    self.postMessage({ type: 'error', id, payload: error.message || String(error) });
  }
};

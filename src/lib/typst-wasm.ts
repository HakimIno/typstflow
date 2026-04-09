import init, { TypstBridge } from './wasm-bridge/typst_bridge';

let bridge: TypstBridge | null = null;
let initPromise: Promise<void> | null = null;

export async function initTypst() {
  if (bridge) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Initialize the WASM module
      await init();
      // Instantiate the bridge class (which embeds fonts)
      bridge = new TypstBridge();
      console.log('Custom Typst WASM Bridge Initialized');
    } catch (error) {
      console.error('Failed to initialize Custom Typst WASM:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

export async function renderToSvg(mainContent: string): Promise<string> {
  await initTypst();
  if (!bridge) throw new Error('Typst bridge not initialized');
  
  try {
    return bridge.render_svg(mainContent);
  } catch (error) {
    console.error('Typst SVG render error:', error);
    throw error;
  }
}

export async function renderToPdf(mainContent: string): Promise<Uint8Array> {
  await initTypst();
  if (!bridge) throw new Error('Typst bridge not initialized');

  try {
    return bridge.render_pdf(mainContent);
  } catch (error) {
    console.error('Typst PDF render error:', error);
    throw error;
  }
}

import init, { LayoutEngine } from '../../src-wasm/pkg/typst_bridge';

/**
 * WASM Layout Engine wrapper.
 *
 * Used exclusively by DragMonitor for spatial snapping during drag operations.
 * Virtual scrolling is handled in pure TypeScript (see use-virtual-elements.ts).
 */
export class WasmLayoutEngine {
  private static instance: WasmLayoutEngine;
  private engine: LayoutEngine | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): WasmLayoutEngine {
    if (!WasmLayoutEngine.instance) {
      WasmLayoutEngine.instance = new WasmLayoutEngine();
    }
    return WasmLayoutEngine.instance;
  }

  public async initWasm() {
    if (this.initialized) return;
    try {
      await init();
      this.engine = new LayoutEngine();
      this.initialized = true;
    } catch (e) {
      console.error('[WasmLayoutEngine] Init failed', e);
    }
  }

  public clear() {
    if (this.engine) this.engine.clear();
  }

  public loadNodes(
    nodes: {
      id: string;
      zone: string;
      pageId?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[]
  ) {
    if (!this.engine) return;
    try {
      const mappedNodes = nodes.map((n) => ({
        id: n.id,
        zone: n.zone,
        page_id: n.pageId,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
      }));
      this.engine.insert_nodes_batch(mappedNodes);
    } catch (e) {
      console.warn('[WasmLayoutEngine] insert_nodes_batch failed', e);
    }
  }

  public findSnaps(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    threshold = 5,
    zoneFilter?: string
  ) {
    if (!this.engine) return null;
    try {
      return this.engine.find_snaps(id, x, y, width, height, threshold, zoneFilter);
    } catch {
      return null;
    }
  }
}

export const layoutEngine = WasmLayoutEngine.getInstance();

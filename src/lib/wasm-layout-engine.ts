import init, { LayoutEngine } from '../../src-wasm/pkg/typst_bridge';

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
      console.log('✅ WasmLayoutEngine initialized');
    } catch (e) {
      console.error('Failed to initialize WasmLayoutEngine', e);
    }
  }

  public clear() {
    if (this.engine) this.engine.clear();
  }

  public loadNodes(nodes: { id: string; zone: string; x: number; y: number; width: number; height: number }[]) {
    if (!this.engine) return;
    try {
      this.engine.insert_nodes_batch(nodes);
    } catch (e) {
      console.error('Failed to insert batch', e);
    }
  }

  public updateNode(id: string, zone: string, x: number, y: number, width: number, height: number) {
    if (!this.engine) return;
    try {
      this.engine.insert_node({ id, zone, x, y, width, height });
    } catch (e) {
      console.error('Failed to insert node', e);
    }
  }

  public removeNode(id: string) {
    if (!this.engine) return;
    try {
      this.engine.remove_node(id);
    } catch (e) {
      console.error('Failed to remove node', e);
    }
  }

  public findSnaps(id: string, x: number, y: number, width: number, height: number, threshold = 5, zoneFilter?: string) {
    if (!this.engine) return null;
    try {
      return this.engine.find_snaps(id, x, y, width, height, threshold, zoneFilter);
    } catch (e) {
      console.error('Failed to find snaps', e);
      return null;
    }
  }

  public queryRect(x: number, y: number, width: number, height: number, zoneFilter?: string) {
    if (!this.engine) return { ids: [] };
    try {
      return this.engine.query_rect(x, y, width, height, zoneFilter);
    } catch (e) {
      console.error('Failed to query rect', e);
      return { ids: [] };
    }
  }
}

export const layoutEngine = WasmLayoutEngine.getInstance();

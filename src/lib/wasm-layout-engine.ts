import init, { LayoutEngine } from './wasm-bridge/typst_bridge';

export interface WasmSpacingIndicator {
  side: 'left' | 'right' | 'top' | 'bottom';
  distance: number;
  line_start: number;
  line_end: number;
  cross_pos: number;
}

export interface WasmFullSnapResult {
  snapped_x: number;
  snapped_y: number;
  guides_x: number[];
  guides_y: number[];
  spacing_indicators: WasmSpacingIndicator[];
}

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

  /** Legacy snap: returns {dx, dy, guides}. Prefer calculateSnap for new callers. */
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

  /**
   * Comprehensive single-call snap. Combines:
   *  - Equal-spacing snap (higher priority, Figma-style)
   *  - Element edge/center snap via RTree
   *  - Spacing indicators to nearest neighbors
   *
   * Returns absolute snapped coordinates + guide positions + spacing indicators,
   * all in mm. Returns null if WASM is not ready.
   */
  public calculateSnap(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    threshold = 2,
    zoneFilter?: string
  ): WasmFullSnapResult | null {
    if (!this.engine) return null;
    try {
      return this.engine.calculate_snap(
        id,
        x,
        y,
        width,
        height,
        threshold,
        zoneFilter
      ) as WasmFullSnapResult | null;
    } catch {
      return null;
    }
  }
}

export const layoutEngine = WasmLayoutEngine.getInstance();

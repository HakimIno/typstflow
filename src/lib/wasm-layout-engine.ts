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

interface WasmNodeInput {
  id: string;
  zone: string;
  page_id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True for wasm-bindgen RefCell borrow panics (recursive / unsafe aliasing). */
function isBorrowError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes('recursive use') ||
    msg.includes('unsafe aliasing') ||
    msg.includes('already borrowed') ||
    msg.includes('already mutably borrowed')
  );
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
  /** Serialize async mutating WASM calls so they never interleave. */
  private mutQueue: Promise<void> = Promise.resolve();
  /**
   * Synchronous critical-section guard shared by EVERY WASM call (read + write).
   * Guarantees two borrows of the same engine are never active at once — exactly
   * the condition that triggers wasm-bindgen's "recursive use / unsafe aliasing" panic.
   */
  private busy = false;
  /** Last node set inserted — used to re-seed a freshly recreated engine after recovery. */
  private lastNodes: WasmNodeInput[] = [];

  private constructor() {}

  private enqueueMut<T>(fn: () => T): Promise<T> {
    const next = this.mutQueue.then(() => fn());
    this.mutQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  /**
   * Run a single WASM call inside the shared critical section with auto-recovery.
   * - If another WASM call is already executing (reentrancy), returns `fallback`
   *   instead of forcing a borrow that would panic.
   * - On a borrow/aliasing panic, recreates the engine, re-seeds nodes, returns `fallback`.
   */
  private run<T>(label: string, fn: (engine: LayoutEngine) => T, fallback: T): T {
    const engine = this.engine;
    if (!engine) return fallback;
    if (this.busy) return fallback;
    this.busy = true;
    try {
      return fn(engine);
    } catch (e) {
      if (isBorrowError(e)) {
        console.warn(`[WasmLayoutEngine] ${label} hit borrow error — recreating engine`, e);
        this.recover();
      } else {
        console.warn(`[WasmLayoutEngine] ${label} failed`, e);
      }
      return fallback;
    } finally {
      this.busy = false;
    }
  }

  /** Replace the engine with a fresh instance and re-seed the last known nodes. */
  private recover(): void {
    try {
      this.engine = new LayoutEngine();
      if (this.lastNodes.length > 0) {
        this.engine.insert_nodes_batch(this.lastNodes);
      }
    } catch (e) {
      console.error('[WasmLayoutEngine] recover failed', e);
      this.engine = null;
      this.initialized = false;
    }
  }

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
    this.lastNodes = [];
    this.run('clear', (engine) => engine.clear(), undefined);
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
  ): void {
    void this.loadNodesAsync(nodes);
  }

  public async loadNodesAsync(
    nodes: {
      id: string;
      zone: string;
      pageId?: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[]
  ): Promise<void> {
    if (!this.engine) return;
    return this.enqueueMut(() => {
      const mappedNodes: WasmNodeInput[] = nodes.map((n) => ({
        id: n.id,
        zone: n.zone,
        page_id: n.pageId,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
      }));
      this.lastNodes = mappedNodes;
      this.run('insert_nodes_batch', (engine) => engine.insert_nodes_batch(mappedNodes), undefined);
    });
  }

  public calculateZoneOffset(zoneKey: string, pageIndex: number): number {
    return this.run(
      'calculate_zone_offset',
      (engine) => engine.calculate_zone_offset(zoneKey, pageIndex),
      0
    );
  }

  public calculateBandOffset(groupId: string, groupType: string, pageIndex: number): number {
    return this.run(
      'calculate_band_offset',
      (engine) => engine.calculate_band_offset(groupId, groupType, pageIndex),
      0
    );
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
    return this.run(
      'find_snaps',
      (engine) => engine.find_snaps(id, x, y, width, height, threshold, zoneFilter),
      null
    );
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
    zoneFilter?: string,
    pageFilter?: string
  ): WasmFullSnapResult | null {
    return this.run(
      'calculate_snap',
      (engine) =>
        engine.calculate_snap(
          id,
          x,
          y,
          width,
          height,
          threshold,
          zoneFilter,
          pageFilter
        ) as WasmFullSnapResult | null,
      null
    );
  }
}

export const layoutEngine = WasmLayoutEngine.getInstance();

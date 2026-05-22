import type { LayoutSchema } from '@/types/schema';
import init, {
  SchemaStore,
  msgpack_decode_to_json,
  msgpack_encode_json,
} from './wasm-bridge/typst_bridge';

let initPromise: Promise<boolean> | null = null;

/** Initialize WASM module; returns false on failure without throwing. */
export async function ensureWasmInit(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!initPromise) {
    initPromise = init()
      .then(() => true)
      .catch((e) => {
        console.error('[ensureWasmInit] WASM load failed', e);
        initPromise = null;
        return false;
      });
  }

  return initPromise;
}

/**
 * Rust-backed schema history store (im::Vector structural sharing) + MessagePack helpers.
 */
class WasmSchemaStore {
  private static instance: WasmSchemaStore;
  private store: SchemaStore | null = null;
  private initialized = false;
  private mutQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  private enqueueMut<T>(fn: () => T): Promise<T> {
    const next = this.mutQueue.then(() => fn());
    this.mutQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  public static getInstance(): WasmSchemaStore {
    if (!WasmSchemaStore.instance) {
      WasmSchemaStore.instance = new WasmSchemaStore();
    }
    return WasmSchemaStore.instance;
  }

  public isReady(): boolean {
    return this.initialized && this.store !== null;
  }

  public async initWasm(): Promise<void> {
    if (this.initialized) return;
    const ok = await ensureWasmInit();
    if (!ok) return;
    try {
      this.store = new SchemaStore();
      this.initialized = true;
    } catch (e) {
      console.error('[WasmSchemaStore] Init failed', e);
    }
  }

  public async loadFromSchema(schema: LayoutSchema): Promise<void> {
    await this.initWasm();
    if (!this.store) return;
    return this.enqueueMut(() => {
      this.store?.load_from_json(JSON.stringify(schema));
    });
  }

  /** Fire-and-forget push — ordered via mutQueue when awaited through push(). */
  public pushSync(schema: LayoutSchema): void {
    if (!this.store) return;
    try {
      this.store.push_from_json(JSON.stringify(schema));
    } catch (e) {
      console.warn('[WasmSchemaStore] pushSync failed', e);
    }
  }

  public async push(schema: LayoutSchema): Promise<void> {
    await this.initWasm();
    if (!this.store) return;
    return this.enqueueMut(() => {
      this.store?.push_from_json(JSON.stringify(schema));
    });
  }

  public undo(): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.undo();
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      return null;
    }
  }

  public redo(): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.redo();
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      return null;
    }
  }

  public gotoIndex(index: number): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.goto_index(index);
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      return null;
    }
  }

  public canUndo(): boolean {
    return this.store?.can_undo() ?? false;
  }

  public canRedo(): boolean {
    return this.store?.can_redo() ?? false;
  }

  public historyLen(): number {
    return this.store?.history_len() ?? 0;
  }

  public historyIndex(): number {
    return this.store?.history_index() ?? 0;
  }
}

export function syncHistoryMeta(): { historyIndex: number; historyLength: number } {
  return {
    historyIndex: wasmSchemaStore.historyIndex(),
    historyLength: wasmSchemaStore.historyLen(),
  };
}

export const wasmSchemaStore = WasmSchemaStore.getInstance();

export async function initWasmSchemaStore(schema: LayoutSchema): Promise<void> {
  await wasmSchemaStore.loadFromSchema(schema);
}

/** Replace WASM undo stack after template load / import (does not push history). */
export function resetWasmSchemaStore(schema: LayoutSchema): void {
  void wasmSchemaStore.loadFromSchema(schema);
}

export { msgpack_decode_to_json, msgpack_encode_json };

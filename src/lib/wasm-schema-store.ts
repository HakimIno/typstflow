import type { LayoutSchema } from '@/types/schema';
import init, {
  initSync,
  SchemaStore,
  msgpack_decode_to_json,
  msgpack_encode_json,
  schema_msgpack_decode,
  schema_msgpack_encode,
} from './wasm-bridge/typst_bridge';

let initPromise: Promise<boolean> | null = null;

async function loadWasmModule(): Promise<void> {
  if (typeof window !== 'undefined') {
    await init();
    return;
  }

  // Node / Vitest — default wasm-pack init uses fetch(file://…) which Node rejects.
  const [{ readFileSync }, { fileURLToPath }, { dirname, join }] = await Promise.all([
    import('node:fs'),
    import('node:url'),
    import('node:path'),
  ]);
  const dir = dirname(fileURLToPath(import.meta.url));
  initSync(readFileSync(join(dir, 'wasm-bridge', 'typst_bridge_bg.wasm')));
}

/** Initialize WASM module; returns false on failure without throwing. */
export async function ensureWasmInit(): Promise<boolean> {
  if (typeof WebAssembly === 'undefined') return false;

  if (typeof window === 'undefined') {
    const isVitest = typeof process !== 'undefined' && process.env.VITEST === 'true';
    const isBunRuntime = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
    if (!isVitest && !isBunRuntime) return false;
  }

  if (!initPromise) {
    initPromise = loadWasmModule()
      .then(() => true)
      .catch((e) => {
        console.error('[ensureWasmInit] WASM load failed', e);
        initPromise = null;
        return false;
      });
  }

  return initPromise;
}

function decodeSchemaValue(value: unknown): LayoutSchema | null {
  if (value == null || value === undefined) return null;
  return value as LayoutSchema;
}

/**
 * Rust-backed schema history store (im::Vector structural sharing).
 * Uses serde_wasm_bindgen for zero JSON round-trip on push/undo.
 */
class WasmSchemaStore {
  private static instance: WasmSchemaStore;
  private store: SchemaStore | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): WasmSchemaStore {
    if (!WasmSchemaStore.instance) {
      WasmSchemaStore.instance = new WasmSchemaStore();
    }
    return WasmSchemaStore.instance;
  }

  public isReady(): boolean {
    return this.initialized && this.store !== null;
  }

  private async ensureReady(): Promise<boolean> {
    if (this.initialized && this.store) return true;
    const ok = await ensureWasmInit();
    if (!ok) return false;
    try {
      this.store = new SchemaStore();
      this.initialized = true;
      return true;
    } catch (e) {
      console.error('[WasmSchemaStore] Init failed', e);
      return false;
    }
  }

  private loadInner(schema: LayoutSchema): void {
    if (!this.store) return;
    try {
      this.store.load_from_value(schema);
    } catch {
      this.store.load_from_json(JSON.stringify(schema));
    }
  }

  private pushInner(schema: LayoutSchema): void {
    if (!this.store) return;
    try {
      this.store.push_from_value(schema);
    } catch {
      try {
        const bytes = schema_msgpack_encode(schema);
        this.store.push_from_msgpack(bytes);
      } catch {
        this.store.push_from_json(JSON.stringify(schema));
      }
    }
  }

  public async initWasm(): Promise<void> {
    await this.ensureReady();
  }

  public async loadFromSchema(schema: LayoutSchema): Promise<void> {
    await this.ensureReady();
    this.loadInner(schema);
  }

  /** Synchronous load when WASM is already initialized (avoids races with pushSync). */
  public loadFromSchemaSync(schema: LayoutSchema): void {
    if (!this.store) {
      void this.loadFromSchema(schema);
      return;
    }
    this.loadInner(schema);
  }

  /** Synchronous push — must not race with loadFromSchema (both sync after init). */
  public pushSync(schema: LayoutSchema): void {
    if (!this.store) {
      void this.push(schema);
      return;
    }
    this.pushInner(schema);
  }

  public async push(schema: LayoutSchema): Promise<void> {
    await this.ensureReady();
    this.pushInner(schema);
  }

  public undo(): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.undo();
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      try {
        const bytes = this.store.undo_msgpack();
        if (!bytes) return null;
        return decodeSchemaValue(schema_msgpack_decode(bytes));
      } catch {
        return decodeSchemaValue(this.store.undo_value());
      }
    }
  }

  public redo(): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.redo();
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      try {
        const bytes = this.store.redo_msgpack();
        if (!bytes) return null;
        return decodeSchemaValue(schema_msgpack_decode(bytes));
      } catch {
        return decodeSchemaValue(this.store.redo_value());
      }
    }
  }

  public gotoIndex(index: number): LayoutSchema | null {
    if (!this.store) return null;
    try {
      const json = this.store.goto_index(index);
      return json ? (JSON.parse(json) as LayoutSchema) : null;
    } catch {
      return decodeSchemaValue(this.store.goto_index_value(index));
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
  wasmSchemaStore.loadFromSchemaSync(schema);
}

export {
  msgpack_decode_to_json,
  msgpack_encode_json,
  schema_msgpack_decode,
  schema_msgpack_encode,
};

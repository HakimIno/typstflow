import { describe, expect, it } from 'vitest';
import { BLANK_SCHEMA } from '@/store/store-utils';
import { ensureWasmInit, initWasmSchemaStore, wasmSchemaStore } from '@/lib/wasm-schema-store';
import { pushHistory, buildComponentRegistry } from '@/store/store-utils';

const TFMP = new Uint8Array([0x54, 0x46, 0x4d, 0x50]);

describe('msgpack schema round-trip', () => {
  it('encodes and decodes persist payload with TFMP header', async () => {
    const { msgpack_encode_json, msgpack_decode_to_json } = await import(
      '@/lib/wasm-bridge/typst_bridge'
    );

    await ensureWasmInit();

    const payload = JSON.stringify({
      state: { schema: BLANK_SCHEMA, theme: 'dark' },
      version: 6,
    });

    const bytes = msgpack_encode_json(payload);
    expect(bytes.length).toBeGreaterThan(4);
    expect(bytes.slice(0, 4)).toEqual(TFMP);

    const decoded = msgpack_decode_to_json(bytes);
    expect(JSON.parse(decoded)).toEqual(JSON.parse(payload));
  });
});

describe('wasm SchemaStore undo/redo', () => {
  it('tracks history through push and undo', async () => {
    const { SchemaStore } = await import('@/lib/wasm-bridge/typst_bridge');

    await ensureWasmInit();

    const store = new SchemaStore();
    const a = { ...BLANK_SCHEMA, id: 'a' };
    const b = { ...BLANK_SCHEMA, id: 'b' };

    store.load_from_json(JSON.stringify(a));
    store.push_from_json(JSON.stringify(b));

    expect(store.can_undo()).toBe(true);
    expect(JSON.parse(store.undo()!).id).toBe('a');
    expect(JSON.parse(store.redo()!).id).toBe('b');
  });

  it('tracks history through push_from_value and undo_value', async () => {
    const { SchemaStore } = await import('@/lib/wasm-bridge/typst_bridge');

    await ensureWasmInit();

    const store = new SchemaStore();
    const a = { ...structuredClone(BLANK_SCHEMA), id: 'a' };
    const b = { ...structuredClone(BLANK_SCHEMA), id: 'b' };

    store.load_from_value(a);
    expect(store.history_len()).toBe(1);

    store.push_from_value(b);
    expect(store.history_len()).toBe(2);
    expect(store.can_undo()).toBe(true);

    const undone = store.undo_value();
    expect(undone.id).toBe('a');
  });

  it('wasmSchemaStore preserves component fields on undo_value', async () => {
    await ensureWasmInit();
    const schema = structuredClone(BLANK_SCHEMA);
    schema.pages[0].body.components = [
      {
        id: 'text-1',
        type: 'text',
        x: 10,
        y: 10,
        width: 80,
        height: 10,
        content: 'hello',
        style: { fontSize: 10 },
      },
    ];
    await initWasmSchemaStore(schema);

    const state = {
      schema,
      componentRegistry: buildComponentRegistry(schema),
      historyIndex: 0,
      historyLength: 1,
    };
    const nudged = {
      ...schema,
      pages: schema.pages.map((p) => ({
        ...p,
        body: {
          ...p.body,
          components: p.body.components.map((c) => ({ ...c, x: 20 })),
        },
      })),
    };
    pushHistory(state, nudged);

    const restored = wasmSchemaStore.undo();
    expect(restored?.pages[0].body.components[0].x).toBe(10);
  });
});

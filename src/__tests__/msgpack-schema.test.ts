import { describe, expect, it } from 'vitest';
import { BLANK_SCHEMA } from '@/store/store-utils';

const TFMP = new Uint8Array([0x54, 0x46, 0x4d, 0x50]);

describe('msgpack schema round-trip', () => {
  it('encodes and decodes persist payload with TFMP header', async () => {
    const init = (await import('@/lib/wasm-bridge/typst_bridge')).default;
    const { msgpack_encode_json, msgpack_decode_to_json } = await import(
      '@/lib/wasm-bridge/typst_bridge'
    );

    await init();

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
    const init = (await import('@/lib/wasm-bridge/typst_bridge')).default;
    const { SchemaStore } = await import('@/lib/wasm-bridge/typst_bridge');

    await init();

    const store = new SchemaStore();
    const a = { ...BLANK_SCHEMA, id: 'a' };
    const b = { ...BLANK_SCHEMA, id: 'b' };

    store.load_from_json(JSON.stringify(a));
    store.push_from_json(JSON.stringify(b));

    expect(store.can_undo()).toBe(true);
    expect(JSON.parse(store.undo()!).id).toBe('a');
    expect(JSON.parse(store.redo()!).id).toBe('b');
  });
});

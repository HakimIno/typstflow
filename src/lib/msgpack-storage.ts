/**
 * IndexedDB storage adapter for Zustand persist — stores state as MessagePack (TFMP header).
 * Falls back to legacy JSON objects written by earlier persist versions.
 */

import { ensureWasmInit, msgpack_decode_to_json, msgpack_encode_json } from '@/lib/wasm-schema-store';

const DB_NAME = 'typstflow-db';
const STORE_NAME = 'designer-state';
const DB_VERSION = 1;
const DEBOUNCE_MS = 1000;

const TFMP_MAGIC = [0x54, 0x46, 0x4d, 0x50] as const;

const memoryStorage: Record<string, unknown> = {};
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function isMsgpackBytes(value: unknown): value is Uint8Array {
  if (!(value instanceof Uint8Array) || value.length < 4) return false;
  return TFMP_MAGIC.every((b, i) => value[i] === b);
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRaw(name: string): Promise<unknown> {
  if (typeof indexedDB === 'undefined') {
    return memoryStorage[name] ?? null;
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(name);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeRaw(name: string, data: Uint8Array | Record<string, unknown>): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    memoryStorage[name] = data;
    return;
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function decodeToJsonString(raw: unknown): Promise<string | null> {
  if (raw == null) return null;

  if (isMsgpackBytes(raw)) {
    const ok = await ensureWasmInit();
    if (!ok) {
      console.warn('[msgpack-storage] WASM unavailable — cannot decode TFMP payload');
      return null;
    }
    return msgpack_decode_to_json(raw);
  }

  if (raw instanceof Uint8Array) {
    const ok = await ensureWasmInit();
    if (!ok) return null;
    try {
      return msgpack_decode_to_json(raw);
    } catch {
      return null;
    }
  }

  if (typeof raw === 'string') {
    return raw;
  }

  return JSON.stringify(raw);
}

export const msgpackIndexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const raw = await readRaw(name);
      return decodeToJsonString(raw);
    } catch (err) {
      console.error('[msgpack-storage] getItem failed', err);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      if (debounceTimer) clearTimeout(debounceTimer);

      debounceTimer = setTimeout(async () => {
        try {
          const ok = await ensureWasmInit();
          if (ok) {
            const bytes = msgpack_encode_json(value);
            await writeRaw(name, bytes);
          } else {
            await writeRaw(name, JSON.parse(value) as Record<string, unknown>);
          }
        } catch (err) {
          console.error('[msgpack-storage] setItem failed', err);
          try {
            await writeRaw(name, JSON.parse(value) as Record<string, unknown>);
          } catch {
            // ignore fallback failure
          }
        }
        resolve();
      }, DEBOUNCE_MS);
    });
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof indexedDB === 'undefined') {
      delete memoryStorage[name];
      return;
    }

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

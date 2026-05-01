/**
 * High-performance asynchronous storage engine using IndexedDB.
 * This is designed to be used with Zustand's persist middleware.
 *
 * Unlike localStorage, IndexedDB:
 * 1. Is asynchronous (doesn't block the main UI thread).
 * 2. Has virtually no size limits (localStorage is limited to ~5MB).
 * 3. Handles complex objects better without excessive JSON serialization overhead.
 */

const DB_NAME = 'typstflow-db';
const STORE_NAME = 'designer-state';
const DB_VERSION = 1;

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

// In-memory fallback for environments without IndexedDB (e.g., SSR, Node.js tests)
const memoryStorage: Record<string, any> = {};

export const indexedDBStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof indexedDB === 'undefined') {
      const value = memoryStorage[name];
      return value ? JSON.stringify(value) : null;
    }

    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(name);

      request.onsuccess = () => {
        const value = request.result;
        resolve(value ? JSON.stringify(value) : null);
      };
      request.onerror = () => reject(request.error);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof indexedDB === 'undefined') {
      memoryStorage[name] = JSON.parse(value);
      return;
    }

    const db = await getDB();
    const data = JSON.parse(value);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, name);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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

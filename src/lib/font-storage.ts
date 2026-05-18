'use client';

const DB_NAME = 'typstflow-fonts-db';
const STORE_NAME = 'fonts';
const DB_VERSION = 1;

export interface CachedFont {
  id: string; // key e.g. "myfont-400"
  family: string;
  weight: number;
  fileName: string;
  data: ArrayBuffer;
  updatedAt: number;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const fontStorage = {
  getFont: async (family: string, weight: number): Promise<ArrayBuffer | null> => {
    if (typeof indexedDB === 'undefined') return null;
    const id = `${family.toLowerCase()}-${weight}`;
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as CachedFont | undefined;
          resolve(result ? result.data : null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[FontStorage] Failed to retrieve font:', e);
      return null;
    }
  },

  saveFont: async (
    family: string,
    weight: number,
    fileName: string,
    data: ArrayBuffer
  ): Promise<void> => {
    if (typeof indexedDB === 'undefined') return;
    const id = `${family.toLowerCase()}-${weight}`;
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const record: CachedFont = {
          id,
          family,
          weight,
          fileName,
          data,
          updatedAt: Date.now(),
        };
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[FontStorage] Failed to save font:', e);
    }
  },

  deleteFont: async (family: string, weight: number): Promise<void> => {
    if (typeof indexedDB === 'undefined') return;
    const id = `${family.toLowerCase()}-${weight}`;
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[FontStorage] Failed to delete font:', e);
    }
  },

  clearAllFonts: async (): Promise<void> => {
    if (typeof indexedDB === 'undefined') return;
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[FontStorage] Failed to clear fonts:', e);
    }
  },
};

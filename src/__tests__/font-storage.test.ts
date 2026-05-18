import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fontStorage } from '../lib/font-storage';

describe('fontStorage IndexedDB Cache', () => {
  it('gracefully handles non-browser (undefined indexedDB) environment', async () => {
    const font = await fontStorage.getFont('CompanySans', 400);
    expect(font).toBeNull();

    await expect(
      fontStorage.saveFont('CompanySans', 400, 'filename.ttf', new ArrayBuffer(0))
    ).resolves.toBeUndefined();
    await expect(fontStorage.deleteFont('CompanySans', 400)).resolves.toBeUndefined();
  });

  describe('with Mocked IndexedDB', () => {
    let mockDB: any;
    let mockStore: any;
    let mockTransaction: any;
    let mockOpenRequest: any;

    beforeEach(() => {
      mockStore = {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      mockTransaction = {
        objectStore: vi.fn().mockReturnValue(mockStore),
      };

      mockDB = {
        objectStoreNames: {
          contains: vi.fn().mockReturnValue(true),
        },
        transaction: vi.fn().mockReturnValue(mockTransaction),
      };

      mockOpenRequest = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };

      const mockIndexedDB = {
        open: vi.fn().mockImplementation(() => {
          setTimeout(() => {
            if (mockOpenRequest.onsuccess) {
              mockOpenRequest.result = mockDB;
              mockOpenRequest.onsuccess();
            }
          }, 0);
          return mockOpenRequest;
        }),
      };

      (globalThis as any).indexedDB = mockIndexedDB;
    });

    afterEach(() => {
      (globalThis as any).indexedDB = undefined;
    });

    it('retrieves cached font correctly when exists', async () => {
      const fakeBuffer = new ArrayBuffer(10);
      mockStore.get.mockImplementation((id: string) => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          req.result = {
            id,
            family: 'CompanySans',
            weight: 400,
            fileName: 'filename.ttf',
            data: fakeBuffer,
          };
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      });

      const font = await fontStorage.getFont('CompanySans', 400);
      expect(font).toBe(fakeBuffer);
      expect(mockStore.get).toHaveBeenCalledWith('companysans-400');
    });

    it('returns null when font does not exist in store', async () => {
      mockStore.get.mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          req.result = undefined;
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      });

      const font = await fontStorage.getFont('CompanySans', 400);
      expect(font).toBeNull();
    });

    it('saves font to indexedDB successfully', async () => {
      const fakeBuffer = new ArrayBuffer(10);
      mockStore.put.mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      });

      await fontStorage.saveFont('CompanySans', 400, 'filename.ttf', fakeBuffer);
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'companysans-400',
          family: 'CompanySans',
          weight: 400,
          fileName: 'filename.ttf',
          data: fakeBuffer,
        })
      );
    });

    it('deletes font from indexedDB successfully', async () => {
      mockStore.delete.mockImplementation(() => {
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      });

      await fontStorage.deleteFont('CompanySans', 400);
      expect(mockStore.delete).toHaveBeenCalledWith('companysans-400');
    });
  });
});

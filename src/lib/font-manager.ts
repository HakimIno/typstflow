'use client';

import { FONT_CATALOG } from './font-catalog';
import { registerFontInWasm } from './typst-wasm';
import { fontStorage } from './font-storage';
import { useDesignerStore } from '@/store/designer-store';

const CACHE_NAME = 'typstflow-fonts-v1';

class FontManager {
  private readonly registeredInBrowser = new Set<string>(); // "family" or "family-weight"
  private readonly registeredInWasm = new Set<string>(); // "family" or "family-weight"
  private readonly inFlight = new Map<string, Promise<boolean>>();

  async installFont(family: string, onProgress?: (msg: string) => void): Promise<boolean> {
    if (family === 'Sarabun') return true;

    const existing = this.inFlight.get(family);
    if (existing) return existing;

    const promise = this._doInstall(family, onProgress);
    this.inFlight.set(family, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(family);
    }
  }

  private async _doInstall(family: string, onProgress?: (msg: string) => void): Promise<boolean> {
    const customFonts = useDesignerStore.getState().customFonts || [];
    const customEntries = customFonts.filter((f) => f.family === family);

    if (customEntries.length > 0) {
      let anySuccess = false;
      for (const entry of customEntries) {
        let buffer: ArrayBuffer | null = null;
        let cameFromCache = false;

        // 1. Try to load from IndexedDB Font Storage cache
        try {
          buffer = await fontStorage.getFont(family, entry.weight);
          if (buffer) {
            cameFromCache = true;
          }
        } catch (e) {
          console.warn(
            `[FontManager] IndexedDB retrieval failed for custom font ${family}-${entry.weight}:`,
            e
          );
        }

        // 3. Register in Browser (Try cache first)
        const styleSuffix = entry.style === 'italic' ? '-italic' : '';
        const browserKey = `${family}-${entry.weight}${styleSuffix}`;
        if (buffer && !this.registeredInBrowser.has(browserKey)) {
          try {
            const fontFace = new FontFace(family, buffer.slice(0), {
              weight: String(entry.weight),
              style: entry.style || 'normal',
            });
            await fontFace.load();
            document.fonts.add(fontFace);
            this.registeredInBrowser.add(browserKey);
          } catch (e) {
            console.warn(`[FontManager] Browser registration failed for cached custom ${browserKey}:`, e);
            if (cameFromCache) {
              console.log(`[FontManager] Corrupted cache detected for ${browserKey}. Evicting from IndexedDB and retrying from server...`);
              await fontStorage.deleteFont(family, entry.weight);
              buffer = null; // Trigger fresh download
            } else {
              continue;
            }
          }
        }

        // 2. If not cached (or evicted due to corruption), download from server
        if (!buffer) {
          onProgress?.(`Downloading ${family} ${entry.weight}…`);
          try {
            const res = await fetch(entry.url);
            if (!res.ok) {
              console.error(`[FontManager] Failed to download custom font from ${entry.url}`);
              continue;
            }
            buffer = await res.arrayBuffer();

            // Register fresh download in Browser
            try {
              const fontFace = new FontFace(family, buffer.slice(0), {
                weight: String(entry.weight),
                style: entry.style || 'normal',
              });
              await fontFace.load();
              document.fonts.add(fontFace);
              this.registeredInBrowser.add(browserKey);
            } catch (e) {
              console.error(`[FontManager] Freshly downloaded font registration failed for ${browserKey}:`, e);
              continue;
            }

            // Save to IndexedDB for future boots
            await fontStorage.saveFont(family, entry.weight, entry.fileName, buffer.slice(0));
          } catch (e) {
            console.error(
              `[FontManager] Error downloading custom font ${family}-${entry.weight}:`,
              e
            );
            continue;
          }
        }

        // 4. Register in WASM Compiler
        if (!this.registeredInWasm.has(browserKey)) {
          try {
            onProgress?.(`Registering custom ${family} in Typst…`);
            await registerFontInWasm(buffer);
            this.registeredInWasm.add(browserKey);
          } catch (e) {
            console.warn(`[FontManager] WASM registration skipped for custom ${browserKey}:`, e);
          }
        }

        anySuccess = true;
      }

      return anySuccess;
    }

    const entry = FONT_CATALOG.find((f) => f.family === family);
    if (!entry || !entry.githubUrls) return false;

    if (entry.variable) {
      // Variable font: fetch once, register as full weight range
      onProgress?.(`Loading ${family}…`);
      const buffer = await this._fetchFont(family, 400);
      if (!buffer) return false;

      if (!this.registeredInBrowser.has(family)) {
        try {
          const fontFace = new FontFace(family, buffer.slice(0), { weight: '100 900' });
          await fontFace.load();
          document.fonts.add(fontFace);
          this.registeredInBrowser.add(family);
        } catch (e) {
          console.warn(`[FontManager] Browser registration failed for ${family}:`, e);
          return false;
        }
      }

      if (!this.registeredInWasm.has(family)) {
        try {
          onProgress?.(`Registering ${family} in Typst…`);
          await registerFontInWasm(buffer);
          this.registeredInWasm.add(family);
        } catch (e) {
          console.warn(`[FontManager] WASM registration skipped for ${family}:`, e);
        }
      }

      return true;
    }

    // Static fonts: fetch Regular + Bold separately
    let anySuccess = false;
    const weights = Object.keys(entry.githubUrls).map(Number);

    for (const weight of weights) {
      onProgress?.(`Loading ${family} ${weight}…`);
      const buffer = await this._fetchFont(family, weight);
      if (!buffer) continue;

      const browserKey = `${family}-${weight}`;
      if (!this.registeredInBrowser.has(browserKey)) {
        try {
          const fontFace = new FontFace(family, buffer.slice(0), { weight: String(weight) });
          await fontFace.load();
          document.fonts.add(fontFace);
          this.registeredInBrowser.add(browserKey);
        } catch (e) {
          console.warn(`[FontManager] Browser registration failed for ${browserKey}:`, e);
          continue;
        }
      }

      const wasmKey = `${family}-${weight}`;
      if (!this.registeredInWasm.has(wasmKey)) {
        try {
          onProgress?.(`Registering ${family} in Typst…`);
          await registerFontInWasm(buffer);
          this.registeredInWasm.add(wasmKey);
        } catch (e) {
          console.warn(`[FontManager] WASM registration skipped for ${wasmKey}:`, e);
        }
      }

      anySuccess = true;
    }

    return anySuccess;
  }

  private async _fetchFont(family: string, weight: number): Promise<ArrayBuffer | null> {
    const cacheUrl = `/api/fonts?family=${encodeURIComponent(family)}&weight=${weight}`;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(cacheUrl);
      if (cached) {
        const buf = await cached.arrayBuffer();
        if (buf.byteLength > 4000) return buf;
        await cache.delete(cacheUrl);
      }
    } catch {
      // Cache API unavailable
    }

    const res = await fetch(cacheUrl);
    if (!res.ok) {
      console.error(`[FontManager] API ${res.status} for ${family}:${weight}`);
      return null;
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(cacheUrl, res.clone());
    } catch {
      /* non-fatal */
    }

    const buf = await res.arrayBuffer();
    return buf.byteLength > 4000 ? buf : null;
  }

  async rehydrate(families: string[]): Promise<void> {
    for (const family of families) {
      this.installFont(family).catch(() => { });
    }
  }

  isBrowserLoaded(family: string): boolean {
    if (this.registeredInBrowser.has(family)) return true;
    for (const key of this.registeredInBrowser) {
      if (key.startsWith(`${family}-`)) return true;
    }
    return false;
  }

  isWasmLoaded(family: string): boolean {
    if (this.registeredInWasm.has(family)) return true;
    for (const key of this.registeredInWasm) {
      if (key.startsWith(`${family}-`)) return true;
    }
    return false;
  }
}

export const fontManager = new FontManager();

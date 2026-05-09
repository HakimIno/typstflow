'use client';

import { fontManager } from '@/lib/font-manager';
import { useDesignerStore } from '@/store/designer-store';
import { useCallback, useEffect } from 'react';

/** Installs a font: fetches binary, registers in browser + WASM, updates store. */
export function useFontInstaller() {
  const markFontLoading = useDesignerStore((s) => s.markFontLoading);
  const markFontInstalled = useDesignerStore((s) => s.markFontInstalled);
  const markFontFailed = useDesignerStore((s) => s.markFontFailed);
  const installedFonts = useDesignerStore((s) => s.installedFonts);
  const loadingFonts = useDesignerStore((s) => s.loadingFonts);

  // Re-register persisted fonts into browser + WASM after page reload
  useEffect(() => {
    const families = installedFonts
      .filter((f) => f.family !== 'Sarabun' && !fontManager.isWasmLoaded(f.family))
      .map((f) => f.family);

    if (families.length === 0) return;

    // Re-install sequentially; each success calls markFontInstalled → fontLoadedAt → preview re-renders
    (async () => {
      for (const family of families) {
        markFontLoading(family);
        const success = await fontManager.installFont(family);
        if (success) markFontInstalled(family);
        else markFontFailed(family);
      }
    })();
  }, []); // run once on mount

  const installFont = useCallback(
    async (family: string): Promise<boolean> => {
      if (family === 'Sarabun') return true;
      markFontLoading(family);
      const success = await fontManager.installFont(family);
      if (success) {
        markFontInstalled(family);
      } else {
        markFontFailed(family);
      }
      return success;
    },
    [markFontLoading, markFontInstalled, markFontFailed]
  );

  return { installFont, installedFonts, loadingFonts };
}

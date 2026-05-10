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

  const _hasHydrated = useDesignerStore((s) => s._hasHydrated);

  // Re-register persisted fonts into browser + WASM after IndexedDB hydration completes.
  // Must depend on _hasHydrated — running before hydration means installedFonts is still the
  // default (Sarabun only) and nothing gets re-installed.
  useEffect(() => {
    if (!_hasHydrated) return;

    const families = installedFonts
      .filter((f) => f.family !== 'Sarabun' && !fontManager.isWasmLoaded(f.family))
      .map((f) => f.family);

    if (families.length === 0) return;

    (async () => {
      for (const family of families) {
        markFontLoading(family);
        const success = await fontManager.installFont(family);
        if (success) markFontInstalled(family);
        else markFontFailed(family);
      }
    })();
  }, [_hasHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

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

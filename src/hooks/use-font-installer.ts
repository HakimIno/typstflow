'use client';

import { fontManager } from '@/lib/font-manager';
import { useDesignerStore } from '@/store/designer-store';
import { useCallback, useEffect } from 'react';

/** Installs a font: fetches binary, registers in browser + WASM, updates store. */
export function useFontInstaller() {
  const markFontLoading = useDesignerStore((s) => s.markFontLoading);
  const markFontInstalled = useDesignerStore((s) => s.markFontInstalled);
  const markFontFailed = useDesignerStore((s) => s.markFontFailed);
  const markFontsLoadingBatch = useDesignerStore((s) => s.markFontsLoadingBatch);
  const markFontsInstalledBatch = useDesignerStore((s) => s.markFontsInstalledBatch);
  const installedFonts = useDesignerStore((s) => s.installedFonts);
  const loadingFonts = useDesignerStore((s) => s.loadingFonts);
  const customFonts = useDesignerStore((s) => s.customFonts);
  const setCustomFonts = useDesignerStore((s) => s.setCustomFonts);

  const _hasHydrated = useDesignerStore((s) => s._hasHydrated);

  // Re-register persisted fonts into browser + WASM after IndexedDB hydration completes.
  // Must depend on _hasHydrated — running before hydration means installedFonts is still the
  // default (Sarabun only) and nothing gets re-installed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run once on hydration
  useEffect(() => {
    if (!_hasHydrated) return;

    (async () => {
      // 1. Fetch dynamic corporate custom fonts first
      try {
        const res = await fetch('/api/fonts/custom');
        if (res.ok) {
          const data = await res.json();
          setCustomFonts(data);
        }
      } catch (e) {
        console.error('[useFontInstaller] Failed to fetch custom fonts registry:', e);
      }

      // 2. Install all persisted fonts in parallel — avoids serial N×latency and N Typst recompiles.
      const families = installedFonts
        .filter((f) => f.family !== 'Sarabun' && !fontManager.isWasmLoaded(f.family))
        .map((f) => f.family);

      if (families.length > 0) {
        markFontsLoadingBatch(families);
        const results = await Promise.allSettled(families.map((f) => fontManager.installFont(f)));
        const succeeded: string[] = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status === 'fulfilled' && r.value) succeeded.push(families[i]);
          else markFontFailed(families[i]);
        }
        markFontsInstalledBatch(succeeded);
      }
    })();
  }, [_hasHydrated]);

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

  return { installFont, installedFonts, loadingFonts, customFonts };
}

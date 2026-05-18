import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export interface InstalledFont {
  family: string;
  installedAt: number;
}

export interface CustomFontInfo {
  id: string;
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
  fileName: string;
  url: string;
  uploadedAt: number;
}

export interface FontSliceState {
  installedFonts: InstalledFont[];
  loadingFonts: string[];
  customFonts: CustomFontInfo[];
  /** Timestamp updated whenever a font is registered in WASM — PreviewPane watches this to re-trigger Typst render. */
  fontLoadedAt: number;
}

export interface FontSliceActions {
  markFontLoading: (family: string) => void;
  markFontInstalled: (family: string) => void;
  markFontFailed: (family: string) => void;
  /** Mark multiple fonts as loading in a single state update to avoid N re-renders. */
  markFontsLoadingBatch: (families: string[]) => void;
  /** Mark multiple fonts as installed and update fontLoadedAt exactly once — avoids N Typst recompiles. */
  markFontsInstalledBatch: (families: string[]) => void;
  uninstallFont: (family: string) => void;
  isFontInstalled: (family: string) => boolean;
  setCustomFonts: (fonts: CustomFontInfo[]) => void;
  addCustomFont: (font: CustomFontInfo) => void;
  removeCustomFontFromStore: (id: string) => void;
}

export type FontSlice = FontSliceState & FontSliceActions;

const BUILT_IN_FONTS: InstalledFont[] = [{ family: 'Sarabun', installedAt: 0 }];

export function createFontSlice(): StateCreator<DesignerState, [], [], FontSlice> {
  return (set, get) => ({
    installedFonts: BUILT_IN_FONTS,
    loadingFonts: [],
    customFonts: [],
    fontLoadedAt: 0,

    markFontLoading: (family) => {
      set((s) => ({
        loadingFonts: s.loadingFonts.includes(family)
          ? s.loadingFonts
          : [...s.loadingFonts, family],
      }));
    },

    markFontInstalled: (family) => {
      set((s) => ({
        loadingFonts: s.loadingFonts.filter((f) => f !== family),
        // Always refresh installedAt so per-font selectors detect the change on re-registration
        installedFonts: s.installedFonts.some((f) => f.family === family)
          ? s.installedFonts.map((f) =>
              f.family === family ? { ...f, installedAt: Date.now() } : f
            )
          : [...s.installedFonts, { family, installedAt: Date.now() }],
        fontLoadedAt: Date.now(),
      }));
    },

    markFontFailed: (family) => {
      set((s) => ({ loadingFonts: s.loadingFonts.filter((f) => f !== family) }));
    },

    markFontsLoadingBatch: (families) => {
      set((s) => {
        const toAdd = families.filter((f) => !s.loadingFonts.includes(f));
        if (toAdd.length === 0) return {};
        return { loadingFonts: [...s.loadingFonts, ...toAdd] };
      });
    },

    markFontsInstalledBatch: (families) => {
      if (families.length === 0) return;
      set((s) => {
        const now = Date.now();
        const familySet = new Set(families);
        const existingFamilies = new Set(s.installedFonts.map((f) => f.family));
        const updated = s.installedFonts.map((f) =>
          familySet.has(f.family) ? { ...f, installedAt: now } : f
        );
        for (const family of families) {
          if (!existingFamilies.has(family)) updated.push({ family, installedAt: now });
        }
        return {
          loadingFonts: s.loadingFonts.filter((f) => !familySet.has(f)),
          installedFonts: updated,
          fontLoadedAt: now,
        };
      });
    },

    uninstallFont: (family) => {
      if (family === 'Sarabun') return;
      set((s) => ({
        installedFonts: s.installedFonts.filter((f) => f.family !== family),
      }));
    },

    isFontInstalled: (family) => {
      return get().installedFonts.some((f) => f.family === family);
    },

    setCustomFonts: (fonts) => {
      set({ customFonts: fonts });
    },

    addCustomFont: (font) => {
      set((s) => {
        const filtered = s.customFonts.filter((f) => f.id !== font.id);
        return {
          customFonts: [...filtered, font],
        };
      });
    },

    removeCustomFontFromStore: (id) => {
      set((s) => {
        const font = s.customFonts.find((f) => f.id === id);
        return {
          customFonts: s.customFonts.filter((f) => f.id !== id),
          // Also uninstall it if it was loaded in installedFonts
          installedFonts: font
            ? s.installedFonts.filter((f) => f.family !== font.family)
            : s.installedFonts,
        };
      });
    },
  });
}

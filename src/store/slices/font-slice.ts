import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export interface InstalledFont {
  family: string;
  installedAt: number;
}

export interface FontSliceState {
  installedFonts: InstalledFont[];
  loadingFonts: string[];
  /** Timestamp updated whenever a font is registered in WASM — PreviewPane watches this to re-trigger Typst render. */
  fontLoadedAt: number;
}

export interface FontSliceActions {
  markFontLoading: (family: string) => void;
  markFontInstalled: (family: string) => void;
  markFontFailed: (family: string) => void;
  uninstallFont: (family: string) => void;
  isFontInstalled: (family: string) => boolean;
}

export type FontSlice = FontSliceState & FontSliceActions;

const BUILT_IN_FONTS: InstalledFont[] = [
  { family: 'Sarabun', installedAt: 0 },
];

export function createFontSlice(): StateCreator<DesignerState, [], [], FontSlice> {
  return (set, get) => ({
    installedFonts: BUILT_IN_FONTS,
    loadingFonts: [],
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
          ? s.installedFonts.map((f) => (f.family === family ? { ...f, installedAt: Date.now() } : f))
          : [...s.installedFonts, { family, installedAt: Date.now() }],
        fontLoadedAt: Date.now(),
      }));
    },

    markFontFailed: (family) => {
      set((s) => ({ loadingFonts: s.loadingFonts.filter((f) => f !== family) }));
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
  });
}

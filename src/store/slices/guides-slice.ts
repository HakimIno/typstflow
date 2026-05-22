import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export interface ManualGuides {
  vertical: number[];
  horizontal: number[];
}

export type GuidesSlice = Pick<
  DesignerState,
  | 'manualGuides'
  | 'addManualGuide'
  | 'removeManualGuide'
  | 'toggleManualGuide'
  | 'moveManualGuide'
  | 'clearManualGuides'
>;

const GUIDE_MERGE_THRESHOLD_MM = 0.5;

function mergeGuide(list: number[], value: number): number[] {
  const exists = list.some((v) => Math.abs(v - value) < GUIDE_MERGE_THRESHOLD_MM);
  if (exists) return list;
  return [...list, value].sort((a, b) => a - b);
}

export const createGuidesSlice: StateCreator<DesignerState, [], [], GuidesSlice> = (set) => ({
  manualGuides: { vertical: [], horizontal: [] },

  addManualGuide: (axis, valueMm) =>
    set((state) => {
      const guides = { ...state.manualGuides };
      if (axis === 'vertical') {
        guides.vertical = mergeGuide(guides.vertical, valueMm);
      } else {
        guides.horizontal = mergeGuide(guides.horizontal, valueMm);
      }
      return { manualGuides: guides };
    }),

  removeManualGuide: (axis, valueMm) =>
    set((state) => {
      const guides = { ...state.manualGuides };
      if (axis === 'vertical') {
        guides.vertical = guides.vertical.filter(
          (v) => Math.abs(v - valueMm) >= GUIDE_MERGE_THRESHOLD_MM
        );
      } else {
        guides.horizontal = guides.horizontal.filter(
          (v) => Math.abs(v - valueMm) >= GUIDE_MERGE_THRESHOLD_MM
        );
      }
      return { manualGuides: guides };
    }),

  toggleManualGuide: (axis, valueMm) =>
    set((state) => {
      const guides = { ...state.manualGuides };
      const list = axis === 'vertical' ? guides.vertical : guides.horizontal;
      const hit = list.find((v) => Math.abs(v - valueMm) < GUIDE_MERGE_THRESHOLD_MM);
      if (hit) {
        if (axis === 'vertical') {
          guides.vertical = list.filter((v) => Math.abs(v - hit) >= GUIDE_MERGE_THRESHOLD_MM);
        } else {
          guides.horizontal = list.filter((v) => Math.abs(v - hit) >= GUIDE_MERGE_THRESHOLD_MM);
        }
      } else if (axis === 'vertical') {
        guides.vertical = mergeGuide(guides.vertical, valueMm);
      } else {
        guides.horizontal = mergeGuide(guides.horizontal, valueMm);
      }
      return { manualGuides: guides };
    }),

  moveManualGuide: (axis, fromMm, toMm) =>
    set((state) => {
      const guides = { ...state.manualGuides };
      const list = axis === 'vertical' ? [...guides.vertical] : [...guides.horizontal];
      const idx = list.findIndex((v) => Math.abs(v - fromMm) < GUIDE_MERGE_THRESHOLD_MM);
      if (idx === -1) return state;
      const clamped = Math.max(0, Math.round(toMm * 10) / 10);
      list[idx] = clamped;
      const deduped = [...new Set(list)].sort((a, b) => a - b);
      if (axis === 'vertical') guides.vertical = deduped;
      else guides.horizontal = deduped;
      return { manualGuides: guides };
    }),

  clearManualGuides: () => set({ manualGuides: { vertical: [], horizontal: [] } }),
});

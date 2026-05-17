import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export type PreviewSlice = Pick<
  DesignerState,
  'sampleData' | 'previewPages' | 'previewStatus' | 'previewError' | 'setSampleData'
>;

export const createPreviewSlice: StateCreator<DesignerState, [], [], PreviewSlice> = (
  set,
  _get
) => ({
  sampleData: {},
  previewPages: [],
  previewStatus: 'idle' as DesignerState['previewStatus'],
  previewError: null,

  setSampleData: (data: Record<string, unknown>) => set({ sampleData: data }),
});

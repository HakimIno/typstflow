import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';

export type DialogSlice = Pick<DesignerState, 'dialog' | 'showDialog' | 'hideDialog'>;

export const createDialogSlice: StateCreator<DesignerState, [], [], DialogSlice> = (
  set,
  _get
) => ({
  dialog: {
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
  },

  showDialog: (options) =>
    set({
      dialog: {
        variant: 'info',
        ...options,
        isOpen: true,
      },
    }),

  hideDialog: () =>
    set((state) => ({
      dialog: {
        ...state.dialog,
        isOpen: false,
      },
    })),
});

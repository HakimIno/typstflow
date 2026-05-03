/**
 * Module-level singleton holding the latest snap result during a drag.
 *
 * DragMonitor writes synchronously (no RAF, no Zustand) so that drop handlers
 * can read the most recent snapped position without races. Falls back to
 * rawX/rawY when async snap calc hasn't completed yet.
 */

interface DragSnapState {
  rawX: number;
  rawY: number;
  snappedX: number;
  snappedY: number;
  activePageId: string | null;
  isActive: boolean;
}

const state: DragSnapState = {
  rawX: 0,
  rawY: 0,
  snappedX: 0,
  snappedY: 0,
  activePageId: null,
  isActive: false,
};

export const dragSnapState = {
  setRaw(x: number, y: number, pageId: string | null): void {
    state.rawX = x;
    state.rawY = y;
    state.snappedX = x;
    state.snappedY = y;
    state.activePageId = pageId;
    state.isActive = true;
  },
  setSnapped(x: number, y: number): void {
    state.snappedX = x;
    state.snappedY = y;
  },
  read(): Readonly<DragSnapState> {
    return state;
  },
  reset(): void {
    state.rawX = 0;
    state.rawY = 0;
    state.snappedX = 0;
    state.snappedY = 0;
    state.activePageId = null;
    state.isActive = false;
  },
};

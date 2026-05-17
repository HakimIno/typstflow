import type { StateCreator } from 'zustand';
import type { DesignerState } from '../store-types';
import { pushHistory } from '../store-utils';

export type PageSlice = Pick<
  DesignerState,
  'addPage' | 'removePage' | 'reorderPage' | 'setPageCount' | 'updatePageDataSource'
>;

export const createPageSlice: StateCreator<DesignerState, [], [], PageSlice> = (set, _get) => ({
  addPage: () =>
    set((state) => {
      const uniqueId = Math.random().toString(36).substring(2, 9);
      const newPageId = `page-${uniqueId}`;
      const newPage = {
        id: newPageId,
        name: `Page ${state.schema.pages.length + 1}`,
        body: { id: 'body', minHeight: '237mm', components: [] },
      };
      const newSchema = {
        ...state.schema,
        pages: [...state.schema.pages, newPage],
      };
      return { ...pushHistory(state, newSchema), activePageId: newPageId };
    }),

  removePage: (id: string) =>
    set((state) => {
      if (state.schema.pages.length <= 1) return state;
      const newPages = state.schema.pages.filter((p) => p.id !== id);
      const newSchema = { ...state.schema, pages: newPages };
      const newActiveId =
        state.activePageId === id ? newPages[newPages.length - 1].id : state.activePageId;
      return { ...pushHistory(state, newSchema), activePageId: newActiveId };
    }),

  reorderPage: (id: string, newIndex: number) =>
    set((state) => {
      const pages = [...state.schema.pages];
      const oldIndex = pages.findIndex((p) => p.id === id);
      if (oldIndex === -1) return state;
      const [page] = pages.splice(oldIndex, 1);
      pages.splice(newIndex, 0, page);
      return pushHistory(state, { ...state.schema, pages });
    }),

  setPageCount: (count: number) =>
    set((state) => {
      const targetCount = Math.max(1, count);
      const currentCount = state.schema.pages.length;
      if (targetCount === currentCount) return state;

      const newPages = [...state.schema.pages];
      if (targetCount > currentCount) {
        for (let i = currentCount; i < targetCount; i++) {
          const uniqueId = Math.random().toString(36).substring(2, 9);
          newPages.push({
            id: `page-${uniqueId}`,
            name: `Page ${i + 1}`,
            body: { id: 'body', minHeight: '237mm', components: [] },
          });
        }
      } else {
        newPages.splice(targetCount);
      }

      const newSchema = { ...state.schema, pages: newPages };
      const newActiveId = newPages.some((p) => p.id === state.activePageId)
        ? state.activePageId
        : newPages[newPages.length - 1]?.id || null;

      return { ...pushHistory(state, newSchema), activePageId: newActiveId };
    }),

  updatePageDataSource: (pageId, dataSource) => {
    set((state) => {
      const newSchema = { ...state.schema };
      newSchema.pages = newSchema.pages.map((p) => (p.id === pageId ? { ...p, dataSource } : p));
      return pushHistory(state, newSchema);
    });
  },
});

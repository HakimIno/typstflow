/**
 * Performance regression tests for Sprint 1 & 2 optimizations.
 *
 * These tests measure OBSERVABLE BEHAVIOR — state update counts, history
 * trimming, and memory-relevant sizes — so we can tell if the optimizations
 * are actually working, not just that the code compiles.
 */

import { createFontSlice } from '@/store/slices/font-slice';
import { buildComponentRegistry, getMaxHistory, pushHistory } from '@/store/store-utils';
import type { LayoutSchema, TableComponent, TextComponent } from '@/types/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { create } from 'zustand';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeText(id: string): TextComponent {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 80,
    height: 10,
    content: id,
    style: { fontSize: 10 },
  };
}

function makeTable(id: string): TableComponent {
  return {
    id,
    type: 'table',
    x: 0,
    y: 0,
    width: 120,
    height: 40,
    dataSource: '{{items}}',
    columns: [
      { id: 'col-1', header: 'Original', field: 'original', width: '60mm' },
      { id: 'col-2', header: 'Amount', field: 'amount', width: '60mm' },
    ],
    style: {},
    showHeader: true,
    repeatHeaderOnPage: true,
  };
}

function makeSchema(bodyComponentCount = 5, pageCount = 1): LayoutSchema {
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    id: `page-${i + 1}`,
    name: `Page ${i + 1}`,
    body: {
      id: `body-${i + 1}`,
      components: Array.from({ length: bodyComponentCount }, (_, j) =>
        makeText(`p${i + 1}-c${j + 1}`)
      ),
    },
  }));
  return {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    },
    fonts: [{ family: 'Sarabun', role: 'body', size: 10, embedded: true }],
    zones: { header: { id: 'header', components: [] }, footer: { id: 'footer', components: [] } },
    pages,
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'Test', createdAt: '', updatedAt: '', author: 'test' },
  };
}

// ─── Sprint 2: getMaxHistory adaptive limits ────────────────────────────────

describe('getMaxHistory — adaptive history limits', () => {
  it('returns 50 for small schemas (< 100 components)', () => {
    expect(getMaxHistory(makeSchema(10, 5))).toBe(50); // 50 components
    expect(getMaxHistory(makeSchema(1, 1))).toBe(50);
  });

  it('returns 30 for medium schemas (100–200 components)', () => {
    expect(getMaxHistory(makeSchema(15, 8))).toBe(30); // 120 components
    expect(getMaxHistory(makeSchema(20, 9))).toBe(30); // 180 components
  });

  it('returns 20 for large schemas (200–500 components)', () => {
    expect(getMaxHistory(makeSchema(25, 10))).toBe(20); // 250 components
    expect(getMaxHistory(makeSchema(50, 8))).toBe(20); // 400 components
  });

  it('returns 10 for very large schemas (> 500 components)', () => {
    expect(getMaxHistory(makeSchema(60, 10))).toBe(10); // 600 components
    expect(getMaxHistory(makeSchema(100, 10))).toBe(10); // 1000 components
  });

  it('counts header + footer + body + group components', () => {
    const schema = makeSchema(20, 5); // 100 body components
    // Add header/footer components to push it over the threshold
    schema.zones.header.components = Array.from({ length: 5 }, (_, i) => makeText(`h${i}`));
    schema.zones.footer.components = Array.from({ length: 5 }, (_, i) => makeText(`f${i}`));
    expect(getMaxHistory(schema)).toBe(30); // 110 total → 30
  });
});

// ─── Sprint 2: pushHistory uses constant MAX_HISTORY ──────────────────────

describe('pushHistory — constant MAX_HISTORY = 50 for reliable undo/redo', () => {
  it('always caps history at 50 regardless of schema size', () => {
    const largeSchema = makeSchema(60, 10); // 600 components
    let state = { history: [] as LayoutSchema[], historyIndex: -1, schema: largeSchema };

    for (let i = 0; i < 60; i++) {
      const next = { ...largeSchema, id: `step-${i}` };
      const result = pushHistory(state, next);
      state = { ...state, ...result };
    }

    expect(state.history.length).toBe(50);
    expect(state.historyIndex).toBe(49);
  });

  it('small schema also caps at 50', () => {
    const smallSchema = makeSchema(5, 3); // 15 components
    let state = { history: [] as LayoutSchema[], historyIndex: -1, schema: smallSchema };

    for (let i = 0; i < 55; i++) {
      const next = { ...smallSchema, id: `step-${i}` };
      const result = pushHistory(state, next);
      state = { ...state, ...result };
    }

    expect(state.history.length).toBe(50);
  });

  it('historyIndex points to the latest entry after 15 pushes', () => {
    const schema = makeSchema(5, 1);
    let state = { history: [] as LayoutSchema[], historyIndex: -1, schema };

    for (let i = 0; i < 15; i++) {
      const next = { ...schema, id: `step-${i}` };
      const result = pushHistory(state, next);
      state = { ...state, ...result };
    }

    expect(state.historyIndex).toBe(state.history.length - 1);
    expect(state.history[state.historyIndex].id).toBe('step-14');
  });

  it('does not share nested table column objects with live schema', () => {
    const schema = makeSchema(0, 1);
    const table = makeTable('table-1');
    schema.pages[0].body.components = [table];

    const result = pushHistory({ history: [], historyIndex: -1, schema }, schema);

    table.columns[0].header = 'Mutated after history push';

    const historyTable = result.history[0].pages[0].body.components[0] as TableComponent;
    expect(historyTable.columns[0].header).toBe('Original');
  });
});

// ─── Sprint 1: markFontsInstalledBatch fires fontLoadedAt exactly once ─────

describe('markFontsInstalledBatch — single fontLoadedAt update', () => {
  // Create a minimal Zustand store with just the font slice for isolated testing
  const createTestStore = () =>
    create<ReturnType<ReturnType<typeof createFontSlice>>>()(createFontSlice() as any);

  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it('serial markFontInstalled(N) triggers N state updates — the OLD behavior', () => {
    // Count total store updates (each set() call = 1 potential React re-render trigger)
    let stateUpdates = 0;
    const unsub = store.subscribe(() => stateUpdates++);

    const families = ['Noto Sans', 'Roboto', 'Inter', 'Kanit', 'Prompt'];
    for (const family of families) {
      store.getState().markFontInstalled(family);
    }
    unsub();

    // OLD behavior: 5 fonts = 5 separate set() calls = 5 PreviewPane re-renders
    expect(stateUpdates).toBe(5);
  });

  it('markFontsInstalledBatch(N) triggers exactly 1 state update — the NEW behavior', () => {
    let stateUpdates = 0;
    const unsub = store.subscribe(() => stateUpdates++);

    const families = ['Noto Sans', 'Roboto', 'Inter', 'Kanit', 'Prompt'];
    store.getState().markFontsInstalledBatch(families);
    unsub();

    // NEW behavior: 5 fonts = 1 set() call = 1 PreviewPane re-render
    expect(stateUpdates).toBe(1);
  });

  it('batch saves (N-1) Typst recompiles — concrete numbers', () => {
    const FONT_COUNT = 20;
    let serialUpdates = 0;
    let batchUpdates = 0;

    // Measure serial
    const serialStore = createTestStore();
    const unsub1 = serialStore.subscribe(() => serialUpdates++);
    for (let i = 0; i < FONT_COUNT; i++) serialStore.getState().markFontInstalled(`Font-${i}`);
    unsub1();

    // Measure batch
    const batchStore = createTestStore();
    const unsub2 = batchStore.subscribe(() => batchUpdates++);
    batchStore
      .getState()
      .markFontsInstalledBatch(Array.from({ length: FONT_COUNT }, (_, i) => `Font-${i}`));
    unsub2();

    expect(serialUpdates).toBe(20); // 20 state updates (old)
    expect(batchUpdates).toBe(1); // 1 state update  (new)
    expect(serialUpdates - batchUpdates).toBe(19); // 19 saved recompiles
  });

  it('batch installs all fonts correctly into installedFonts', () => {
    const families = ['Noto Sans', 'Roboto', 'Inter'];
    store.getState().markFontsInstalledBatch(families);

    const installed = store.getState().installedFonts.map((f) => f.family);
    for (const f of families) {
      expect(installed).toContain(f);
    }
  });

  it('batch clears all families from loadingFonts in one update', () => {
    const families = ['Noto Sans', 'Roboto', 'Inter'];
    store.getState().markFontsLoadingBatch(families);
    expect(store.getState().loadingFonts).toHaveLength(3);

    store.getState().markFontsInstalledBatch(families);
    expect(store.getState().loadingFonts).toHaveLength(0);
  });

  it('markFontsInstalledBatch([]) is a no-op — does not update fontLoadedAt', () => {
    const before = store.getState().fontLoadedAt;
    store.getState().markFontsInstalledBatch([]);
    expect(store.getState().fontLoadedAt).toBe(before);
  });
});

// ─── Sprint 2: buildComponentRegistry correctness ──────────────────────────

describe('buildComponentRegistry — per-component lookup correctness', () => {
  it('indexes all components by ID for O(1) lookup', () => {
    const schema = makeSchema(10, 3); // 30 body components
    const registry = buildComponentRegistry(schema);

    expect(Object.keys(registry)).toHaveLength(30);
    expect(registry['p1-c1']).toBeDefined();
    expect(registry['p3-c10']).toBeDefined();
  });

  it('changing one component does not affect other components references', () => {
    const schema = makeSchema(3, 1);
    const registry1 = buildComponentRegistry(schema);

    // Simulate updating component p1-c1 only
    const updatedSchema = {
      ...schema,
      pages: schema.pages.map((p) => ({
        ...p,
        body: {
          ...p.body,
          components: p.body.components.map((c) => (c.id === 'p1-c1' ? { ...c, x: 99 } : c)),
        },
      })),
    };
    const registry2 = buildComponentRegistry(updatedSchema);

    // p1-c1 should be a new reference (changed)
    expect(registry2['p1-c1']).not.toBe(registry1['p1-c1']);
    expect(registry2['p1-c1'].x).toBe(99);

    // p1-c2 and p1-c3 should be the SAME reference (unchanged → no re-render)
    expect(registry2['p1-c2']).toBe(registry1['p1-c2']);
    expect(registry2['p1-c3']).toBe(registry1['p1-c3']);
  });
});

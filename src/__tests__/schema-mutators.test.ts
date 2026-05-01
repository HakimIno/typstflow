import {
  findComponentInSchema,
  getZoneComponents,
  mapComponentInSchema,
  removeComponentFromSchema,
  removeComponentsFromSchema,
  reorderComponentInSchema,
} from '@/lib/utils/schema-mutators';
import type { ComponentNode, LayoutSchema, TextComponent } from '@/types/schema';
/**
 * @file schema-mutators.test.ts
 * Comprehensive unit tests for src/lib/utils/schema-mutators.ts
 *
 * Coverage:
 * - getZoneComponents: all zone keys, page fallback, missing page
 * - findComponentInSchema: header, footer, body, multi-page, not found
 * - mapComponentInSchema: transform in all zones, not found, immutability
 * - removeComponentFromSchema: remove from all zones, not found
 * - removeComponentsFromSchema: multi-remove, empty ids, cross-zone
 * - reorderComponentInSchema: bringToFront, sendToBack, moveUp, moveDown, boundary, null no-op
 */
import { beforeEach, describe, expect, it } from 'vitest';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeText(id: string, overrides: Partial<TextComponent> = {}): TextComponent {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 80,
    height: 10,
    content: `Content of ${id}`,
    style: { fontSize: 10 },
    ...overrides,
  };
}

function makeSchema(): LayoutSchema {
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
    zones: {
      header: { id: 'header', components: [makeText('h1'), makeText('h2')] },
      footer: { id: 'footer', components: [makeText('f1')] },
    },
    pages: [
      {
        id: 'page-1',
        name: 'Page 1',
        body: { id: 'body-1', components: [makeText('b1'), makeText('b2'), makeText('b3')] },
      },
      {
        id: 'page-2',
        name: 'Page 2',
        body: { id: 'body-2', components: [makeText('p2-b1'), makeText('p2-b2')] },
      },
    ],
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'Test Report', createdAt: '', updatedAt: '', author: 'test' },
  };
}

// ─── getZoneComponents ─────────────────────────────────────────────────────

describe('getZoneComponents', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('returns header components', () => {
    const comps = getZoneComponents(schema, 'header');
    expect(comps.map((c) => c.id)).toEqual(['h1', 'h2']);
  });

  it('returns footer components', () => {
    const comps = getZoneComponents(schema, 'footer');
    expect(comps.map((c) => c.id)).toEqual(['f1']);
  });

  it('returns body components for a specific pageId', () => {
    const comps = getZoneComponents(schema, 'body', 'page-2');
    expect(comps.map((c) => c.id)).toEqual(['p2-b1', 'p2-b2']);
  });

  it('falls back to first page when pageId is omitted', () => {
    const comps = getZoneComponents(schema, 'body');
    expect(comps.map((c) => c.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('returns empty array for unknown pageId', () => {
    const comps = getZoneComponents(schema, 'body', 'page-999');
    expect(comps).toEqual([]);
  });

  it('returns empty array for null pageId (falls back to first page)', () => {
    const comps = getZoneComponents(schema, 'body', null);
    expect(comps.map((c) => c.id)).toEqual(['b1', 'b2', 'b3']);
  });
});

// ─── findComponentInSchema ─────────────────────────────────────────────────

describe('findComponentInSchema', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('finds component in header', () => {
    expect(findComponentInSchema(schema, 'h1')?.id).toBe('h1');
    expect(findComponentInSchema(schema, 'h2')?.id).toBe('h2');
  });

  it('finds component in footer', () => {
    expect(findComponentInSchema(schema, 'f1')?.id).toBe('f1');
  });

  it('finds component in first page body', () => {
    expect(findComponentInSchema(schema, 'b1')?.id).toBe('b1');
    expect(findComponentInSchema(schema, 'b3')?.id).toBe('b3');
  });

  it('finds component in second page body', () => {
    expect(findComponentInSchema(schema, 'p2-b1')?.id).toBe('p2-b1');
  });

  it('returns null for unknown id', () => {
    expect(findComponentInSchema(schema, 'nonexistent')).toBeNull();
  });

  it('returns null for empty schema', () => {
    const empty: LayoutSchema = {
      ...schema,
      zones: { header: { id: 'h', components: [] }, footer: { id: 'f', components: [] } },
      pages: [{ id: 'page-1', name: 'Page 1', body: { id: 'b', components: [] } }],
    };
    expect(findComponentInSchema(empty, 'h1')).toBeNull();
  });
});

// ─── mapComponentInSchema ──────────────────────────────────────────────────

describe('mapComponentInSchema', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('transforms a component in the header zone', () => {
    const { schema: next, changed } = mapComponentInSchema(schema, 'h1', (c) => ({
      ...c,
      x: 99,
    }));
    expect(changed).toBe(true);
    expect(next.zones.header.components[0].x).toBe(99);
    // other header component unchanged
    expect(next.zones.header.components[1].x).toBe(0);
  });

  it('transforms a component in the footer zone', () => {
    const { schema: next, changed } = mapComponentInSchema(schema, 'f1', (c) => ({
      ...c,
      y: 42,
    }));
    expect(changed).toBe(true);
    expect(next.zones.footer.components[0].y).toBe(42);
  });

  it('transforms a component in page-1 body', () => {
    const { schema: next, changed } = mapComponentInSchema(schema, 'b2', (c) => ({
      ...c,
      width: 200,
    }));
    expect(changed).toBe(true);
    const bodyComps = next.pages[0].body.components;
    expect(bodyComps[1].width).toBe(200);
    expect(bodyComps[0].width).toBe(80); // unchanged
  });

  it('transforms a component in page-2 body', () => {
    const { schema: next, changed } = mapComponentInSchema(schema, 'p2-b1', (c) => ({
      ...c,
      height: 55,
    }));
    expect(changed).toBe(true);
    expect(next.pages[1].body.components[0].height).toBe(55);
    // page-1 unchanged
    expect(next.pages[0].body.components[0].height).toBe(10);
  });

  it('returns changed=false and same schema ref for unknown id', () => {
    const { schema: next, changed } = mapComponentInSchema(schema, 'unknown', (c) => c);
    expect(changed).toBe(false);
    expect(next).toBe(schema); // exact same reference
  });

  it('does NOT mutate the original schema (immutability)', () => {
    const originalHeaderComps = schema.zones.header.components;
    mapComponentInSchema(schema, 'h1', (c) => ({ ...c, x: 999 }));
    expect(schema.zones.header.components).toBe(originalHeaderComps);
    expect(schema.zones.header.components[0].x).toBe(0);
  });

  it('zones and pages NOT targeted remain same reference', () => {
    const { schema: next } = mapComponentInSchema(schema, 'h1', (c) => ({ ...c, x: 5 }));
    // footer zone is unchanged reference
    expect(next.zones.footer).toBe(schema.zones.footer);
    // pages are unchanged reference
    expect(next.pages).toBe(schema.pages);
  });

  it('only the modified page changes reference', () => {
    const { schema: next } = mapComponentInSchema(schema, 'b1', (c) => ({ ...c, x: 5 }));
    expect(next.pages[0]).not.toBe(schema.pages[0]); // page-1 changed
    expect(next.pages[1]).toBe(schema.pages[1]); // page-2 unchanged
  });
});

// ─── removeComponentFromSchema ────────────────────────────────────────────

describe('removeComponentFromSchema', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('removes a component from header', () => {
    const { schema: next, changed } = removeComponentFromSchema(schema, 'h1');
    expect(changed).toBe(true);
    expect(next.zones.header.components.map((c) => c.id)).toEqual(['h2']);
  });

  it('removes a component from footer', () => {
    const { schema: next, changed } = removeComponentFromSchema(schema, 'f1');
    expect(changed).toBe(true);
    expect(next.zones.footer.components).toHaveLength(0);
  });

  it('removes a component from page-1 body', () => {
    const { schema: next, changed } = removeComponentFromSchema(schema, 'b2');
    expect(changed).toBe(true);
    expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b1', 'b3']);
  });

  it('removes a component from page-2 body', () => {
    const { schema: next, changed } = removeComponentFromSchema(schema, 'p2-b2');
    expect(changed).toBe(true);
    expect(next.pages[1].body.components.map((c) => c.id)).toEqual(['p2-b1']);
  });

  it('returns changed=false and same ref for unknown id', () => {
    const { schema: next, changed } = removeComponentFromSchema(schema, 'ghost');
    expect(changed).toBe(false);
    expect(next).toBe(schema);
  });

  it('does NOT mutate original schema', () => {
    removeComponentFromSchema(schema, 'h1');
    expect(schema.zones.header.components).toHaveLength(2);
  });
});

// ─── removeComponentsFromSchema ───────────────────────────────────────────

describe('removeComponentsFromSchema', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('removes multiple components from the same zone', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, ['b1', 'b3']);
    expect(changed).toBe(true);
    expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b2']);
  });

  it('removes components across multiple zones in one pass', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, ['h1', 'f1', 'b1']);
    expect(changed).toBe(true);
    expect(next.zones.header.components.map((c) => c.id)).toEqual(['h2']);
    expect(next.zones.footer.components).toHaveLength(0);
    expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b2', 'b3']);
  });

  it('removes components from multiple pages', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, ['b1', 'p2-b2']);
    expect(changed).toBe(true);
    expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b2', 'b3']);
    expect(next.pages[1].body.components.map((c) => c.id)).toEqual(['p2-b1']);
  });

  it('returns changed=false for empty ids array', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, []);
    expect(changed).toBe(false);
    expect(next).toBe(schema);
  });

  it('returns changed=false when no ids match', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, ['x', 'y', 'z']);
    expect(changed).toBe(false);
    expect(next).toBe(schema);
  });

  it('handles partial matches (some ids found, some not)', () => {
    const { schema: next, changed } = removeComponentsFromSchema(schema, ['h1', 'nonexistent']);
    expect(changed).toBe(true);
    expect(next.zones.header.components.map((c) => c.id)).toEqual(['h2']);
  });

  it('does NOT mutate original schema', () => {
    removeComponentsFromSchema(schema, ['h1', 'f1', 'b1', 'b2', 'b3', 'p2-b1', 'p2-b2']);
    expect(schema.zones.header.components).toHaveLength(2);
    expect(schema.zones.footer.components).toHaveLength(1);
    expect(schema.pages[0].body.components).toHaveLength(3);
  });
});

// ─── reorderComponentInSchema ─────────────────────────────────────────────

describe('reorderComponentInSchema', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  // bringToFront helper
  const bringToFront = (comps: ComponentNode[], idx: number): ComponentNode[] => {
    const next = [...comps];
    const [comp] = next.splice(idx, 1);
    next.push(comp);
    return next;
  };

  // sendToBack helper
  const sendToBack = (comps: ComponentNode[], idx: number): ComponentNode[] => {
    const next = [...comps];
    const [comp] = next.splice(idx, 1);
    next.unshift(comp);
    return next;
  };

  // moveUp helper (higher index = rendered on top)
  const moveUp = (comps: ComponentNode[], idx: number): ComponentNode[] | null => {
    if (idx >= comps.length - 1) return null;
    const next = [...comps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    return next;
  };

  // moveDown helper
  const moveDown = (comps: ComponentNode[], idx: number): ComponentNode[] | null => {
    if (idx <= 0) return null;
    const next = [...comps];
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    return next;
  };

  describe('bringToFront', () => {
    it('moves component to end in header', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'h1', bringToFront);
      expect(changed).toBe(true);
      expect(next.zones.header.components.map((c) => c.id)).toEqual(['h2', 'h1']);
    });

    it('is a no-op for already-last component (still changed=true)', () => {
      // h2 is already last
      const { schema: next, changed } = reorderComponentInSchema(schema, 'h2', bringToFront);
      expect(changed).toBe(true);
      expect(next.zones.header.components.map((c) => c.id)).toEqual(['h1', 'h2']);
    });

    it('moves component to end in page body', () => {
      const { schema: next } = reorderComponentInSchema(schema, 'b1', bringToFront);
      expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b2', 'b3', 'b1']);
    });
  });

  describe('sendToBack', () => {
    it('moves component to front in header', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'h2', sendToBack);
      expect(changed).toBe(true);
      expect(next.zones.header.components.map((c) => c.id)).toEqual(['h2', 'h1']);
    });

    it('moves component to front in page body', () => {
      const { schema: next } = reorderComponentInSchema(schema, 'b3', sendToBack);
      expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b3', 'b1', 'b2']);
    });
  });

  describe('moveUp', () => {
    it('swaps component with next in body', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'b1', moveUp);
      expect(changed).toBe(true);
      expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b2', 'b1', 'b3']);
    });

    it('returns null (no change) when component is already at top', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'b3', moveUp);
      expect(changed).toBe(false);
      expect(next).toBe(schema); // same reference
    });

    it('does not change page-2 when modifying page-1', () => {
      const { schema: next } = reorderComponentInSchema(schema, 'b1', moveUp);
      expect(next.pages[1]).toBe(schema.pages[1]);
    });
  });

  describe('moveDown', () => {
    it('swaps component with previous in body', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'b3', moveDown);
      expect(changed).toBe(true);
      expect(next.pages[0].body.components.map((c) => c.id)).toEqual(['b1', 'b3', 'b2']);
    });

    it('returns null (no change) when component is already at bottom', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'b1', moveDown);
      expect(changed).toBe(false);
      expect(next).toBe(schema);
    });
  });

  describe('edge cases', () => {
    it('returns changed=false and same ref for unknown id', () => {
      const { schema: next, changed } = reorderComponentInSchema(schema, 'ghost', bringToFront);
      expect(changed).toBe(false);
      expect(next).toBe(schema);
    });

    it('does NOT mutate original schema', () => {
      const originalOrder = schema.zones.header.components.map((c) => c.id);
      reorderComponentInSchema(schema, 'h1', bringToFront);
      expect(schema.zones.header.components.map((c) => c.id)).toEqual(originalOrder);
    });

    it('only the modified zone/page changes reference', () => {
      const { schema: next } = reorderComponentInSchema(schema, 'b1', bringToFront);
      expect(next.zones.header).toBe(schema.zones.header); // unchanged
      expect(next.zones.footer).toBe(schema.zones.footer); // unchanged
      expect(next.pages[0]).not.toBe(schema.pages[0]); // changed
      expect(next.pages[1]).toBe(schema.pages[1]); // unchanged
    });

    it('works on footer zone', () => {
      // Add a second component to footer for ordering test
      const schemaWithFooter: LayoutSchema = {
        ...schema,
        zones: {
          ...schema.zones,
          footer: { id: 'footer', components: [makeText('f1'), makeText('f2')] },
        },
      };
      const { schema: next, changed } = reorderComponentInSchema(
        schemaWithFooter,
        'f1',
        bringToFront
      );
      expect(changed).toBe(true);
      expect(next.zones.footer.components.map((c) => c.id)).toEqual(['f2', 'f1']);
    });
  });
});

// ─── Integration: common store patterns ───────────────────────────────────

describe('Integration — simulating store action patterns', () => {
  let schema: LayoutSchema;
  beforeEach(() => {
    schema = makeSchema();
  });

  it('updateComponent pattern: partial update via mapComponentInSchema', () => {
    const updates: Partial<ComponentNode> = { x: 10, y: 20 };
    const { schema: next, changed } = mapComponentInSchema(
      schema,
      'b1',
      (c) => ({ ...c, ...updates }) as ComponentNode
    );
    expect(changed).toBe(true);
    const updated = next.pages[0].body.components[0];
    expect(updated.x).toBe(10);
    expect(updated.y).toBe(20);
    expect((updated as TextComponent).content).toBe('Content of b1'); // unchanged fields preserved
  });

  it('renameComponent pattern: name update via mapComponentInSchema', () => {
    const { schema: next } = mapComponentInSchema(schema, 'h1', (c) => ({ ...c, name: 'Logo' }));
    expect(next.zones.header.components[0].name).toBe('Logo');
  });

  it('removeComponents + re-select pattern', () => {
    const ids = ['b1', 'b3'];
    const { schema: next, changed } = removeComponentsFromSchema(schema, ids);
    expect(changed).toBe(true);
    // Simulates store clearing selectedComponentIds
    const selectedAfter: string[] = [];
    expect(selectedAfter).toHaveLength(0);
    expect(next.pages[0].body.components).toHaveLength(1);
  });
});

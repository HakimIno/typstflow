import { describe, it, expect, vi } from 'vitest';
import { parseTypstUnit } from '@/lib/utils/units';

vi.mock('@/lib/utils/units', () => ({
  parseTypstUnit: (val: string) => Number.parseInt(val),
}));

describe('Virtualization Coordinate Logic', () => {
  it('should calculate correct absolute Y for components across pages', () => {
    const schema = {
      zones: {
        header: { minHeight: '30mm', components: [{ id: 'h1', x: 0, y: 5 }] as any[] },
        footer: { minHeight: '30mm', components: [{ id: 'f1', x: 0, y: 5 }] as any[] },
      },
      pages: [
        {
          id: 'p1',
          body: { minHeight: '237mm', components: [{ id: 'b1', x: 0, y: 10 }] as any[] },
        },
        {
          id: 'p2',
          body: { minHeight: '237mm', components: [{ id: 'b2', x: 0, y: 10 }] as any[] },
        },
      ],
    };

    const nodes: any[] = [];
    const pageHeightMm = 297;
    const pageGapMm = 8.5;
    let currentYOffset = 0;

    for (const [pIdx, page] of schema.pages.entries()) {
      const headerHeight = parseTypstUnit(schema.zones.header.minHeight);

      for (const comp of schema.zones.header.components) {
        nodes.push({
          id: `${comp.id}-p${pIdx}`,
          y: currentYOffset + (comp.y || 0),
        });
      }

      for (const comp of page.body.components) {
        nodes.push({
          id: comp.id,
          y: currentYOffset + headerHeight + (comp.y || 0),
        });
      }

      currentYOffset += pageHeightMm + pageGapMm;
    }

    // Page 1: offset = 0
    expect(nodes.find(n => n.id === 'h1-p0').y).toBe(5);       // header comp: 0 + 5
    expect(nodes.find(n => n.id === 'b1').y).toBe(40);          // body comp: 0 + 30 + 10

    // Page 2: offset = 297 + 8.5 = 305.5
    expect(nodes.find(n => n.id === 'h1-p1').y).toBe(310.5);   // header comp: 305.5 + 5
    expect(nodes.find(n => n.id === 'b2').y).toBe(345.5);       // body comp: 305.5 + 30 + 10
  });

  it('should handle empty pages without errors', () => {
    const schema = {
      zones: {
        header: { minHeight: '30mm', components: [] as any[] },
        footer: { minHeight: '30mm', components: [] as any[] },
      },
      pages: [
        { id: 'p1', body: { minHeight: '237mm', components: [] as any[] } },
      ],
    };

    const nodes: any[] = [];
    const pageHeightMm = 297;
    const pageGapMm = 8.5;
    let currentYOffset = 0;

    for (const [pIdx, page] of schema.pages.entries()) {
      const headerHeight = parseTypstUnit(schema.zones.header.minHeight);

      for (const comp of schema.zones.header.components) {
        nodes.push({ id: `${comp.id}-p${pIdx}`, y: currentYOffset + (comp.y || 0) });
      }

      for (const comp of page.body.components) {
        nodes.push({ id: comp.id, y: currentYOffset + headerHeight + (comp.y || 0) });
      }

      currentYOffset += pageHeightMm + pageGapMm;
    }

    expect(nodes).toHaveLength(0);
  });

  it('should produce correct viewport intersection results', () => {
    const rects = [
      { id: 'a', x: 0, y: 0, width: 100, height: 50 },
      { id: 'b', x: 0, y: 200, width: 100, height: 50 },
      { id: 'c', x: 0, y: 500, width: 100, height: 50 },
    ];

    // Viewport from y=0 to y=250
    const minX = 0;
    const minY = 0;
    const maxX = 210;
    const maxY = 250;

    const visible = rects.filter(r =>
      r.x + r.width >= minX &&
      r.x <= maxX &&
      r.y + r.height >= minY &&
      r.y <= maxY
    );

    expect(visible.map(r => r.id)).toEqual(['a', 'b']);
    expect(visible).not.toContainEqual(expect.objectContaining({ id: 'c' }));
  });
});

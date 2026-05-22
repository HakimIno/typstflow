import { LayoutEngine } from '@/lib/engine/layout-engine';
import {
  buildZoneLayoutConfig,
  computeZoneOffset,
  getZoneLayoutCache,
  ZoneLayoutCache,
} from '@/lib/utils/zone-layout';
import { describe, expect, it } from 'vitest';

const schema = {
  page: { size: 'A4', orientation: 'portrait' },
  zones: {
    header: { minHeight: '25mm', repeatOnEveryPage: false, components: [] },
    footer: {
      minHeight: '20mm',
      repeatOnEveryPage: false,
      showOnLastPageOnly: false,
      components: [],
    },
  },
  pages: [{ id: 'page-1', body: { components: [] } }, { id: 'page-2', body: { components: [] } }],
  groups: [],
};

describe('ZoneLayoutCache', () => {
  it('O(1) page index lookup', () => {
    const cache = new ZoneLayoutCache(schema as any);
    expect(cache.getPageIndex('page-2')).toBe(1);
    expect(cache.getPageAbsOffsetMm('page-2')).toBe(297);
  });

  it('matches LayoutEngine.calculateZoneOffset', () => {
    const cache = getZoneLayoutCache(schema as any);
    expect(cache.getZoneOffset('body', 'page-1')).toBe(
      LayoutEngine.calculateZoneOffset('body', schema, 'page-1')
    );
    expect(cache.getZoneOffset('footer', 'page-2')).toBe(
      LayoutEngine.calculateZoneOffset('footer', schema, 'page-2')
    );
  });

  it('computeZoneOffset matches known values', () => {
    const config = buildZoneLayoutConfig(schema as any);
    expect(computeZoneOffset(config, 'body', 0)).toBe(25);
    expect(computeZoneOffset(config, 'body', 1)).toBe(0);
    expect(computeZoneOffset(config, 'footer', 0)).toBe(277);
  });
});

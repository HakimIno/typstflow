import { describe, expect, it } from 'vitest';
import { BLANK_SCHEMA } from '@/store/store-utils';
import { computeStalePageIndices } from '@/lib/utils/preview-diff';
import type { TextComponent } from '@/types/schema';

function makeText(id: string): TextComponent {
  return { id, type: 'text', x: 0, y: 0, width: 80, height: 10, content: id, style: { fontSize: 10 } };
}

function cloneSchema() {
  return structuredClone(BLANK_SCHEMA);
}

describe('computeStalePageIndices', () => {
  it('marks all pages stale on first render', () => {
    const next = cloneSchema();
    const result = computeStalePageIndices(undefined, next);
    expect(result.allPages).toBe(true);
    expect(result.indices).toHaveLength(next.pages.length);
  });

  it('detects a single changed page via structural sharing', () => {
    const prev = cloneSchema();
    const next = {
      ...prev,
      pages: [
        {
          ...prev.pages[0],
          body: {
            ...prev.pages[0].body,
            components: [makeText('changed')],
          },
        },
      ],
    };

    const result = computeStalePageIndices(prev, next);
    expect(result.allPages).toBe(false);
    expect(result.indices).toEqual([0]);
  });

  it('marks all pages stale when header zone changes', () => {
    const prev = cloneSchema();
    const next = cloneSchema();
    next.zones = {
      ...prev.zones,
      header: { ...prev.zones.header, minHeight: '40mm' },
    };

    const result = computeStalePageIndices(prev, next);
    expect(result.allPages).toBe(true);
  });

  it('includes active page even when unchanged', () => {
    const prev = cloneSchema();
    const next = cloneSchema();
    const result = computeStalePageIndices(prev, next, prev.pages[0].id);
    expect(result.indices).toEqual([0]);
  });
});

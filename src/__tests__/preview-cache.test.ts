import type { LayoutSchema } from '@/types/schema';
import { describe, expect, it, beforeEach } from 'vitest';
import { PREVIEW_INCREMENTAL_MAX_DIRTY } from '@/lib/preview/constants';
import { computePagePreviewHash, computeGlobalPreviewHash } from '@/lib/preview/page-hash';
import { getPreviewPageCache, resetPreviewPageCache } from '@/lib/preview/page-cache';
import { planPreviewRender } from '@/lib/preview/plan-preview-render';

function makeSchema(pageCount: number): LayoutSchema {
  return {
    id: 'test',
    name: 'Test',
    version: '1.0.0',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    },
    fonts: [],
    zones: {
      header: { id: 'h', components: [] },
      footer: { id: 'f', components: [] },
    },
    pages: Array.from({ length: pageCount }, (_, i) => ({
      id: `page-${i}`,
      name: `Page ${i + 1}`,
      body: {
        id: 'body',
        components: [
          {
            id: `text-${i}`,
            type: 'text' as const,
            x: 0,
            y: 0,
            width: 50,
            height: 10,
            content: `Page ${i + 1}`,
            style: {},
          },
        ],
      },
    })),
    groups: [],
    variables: [],
    dataSchema: [],
    metadata: { title: 'T', createdAt: '', updatedAt: '', author: '' },
  };
}

describe('PreviewPageCache', () => {
  beforeEach(() => resetPreviewPageCache());

  it('stores and retrieves by page id + hash', () => {
    const cache = getPreviewPageCache();
    cache.set('p1', 'hash-a', '<svg/>');
    expect(cache.isHit('p1', 'hash-a')).toBe(true);
    expect(cache.isHit('p1', 'hash-b')).toBe(false);
    expect(cache.snapshot(['p1'])).toEqual(['<svg/>']);
  });

  it('clears on global hash change', () => {
    const cache = getPreviewPageCache();
    cache.setGlobalHash('g1');
    cache.set('p1', 'h1', '<svg/>');
    cache.setGlobalHash('g2');
    expect(cache.isHit('p1', 'h1')).toBe(false);
  });
});

describe('planPreviewRender', () => {
  beforeEach(() => resetPreviewPageCache());

  it('returns incremental with no dirty pages when cache is warm', () => {
    const schema = makeSchema(3);
    const data = {};
    const globalHash = computeGlobalPreviewHash(schema, data);
    const cache = getPreviewPageCache();
    cache.setGlobalHash(globalHash);
    for (let i = 0; i < 3; i++) {
      cache.set(
        schema.pages[i].id,
        computePagePreviewHash(schema, data, i, globalHash),
        `<svg>${i}</svg>`
      );
    }

    const plan = planPreviewRender(schema, data);
    expect(plan.mode).toBe('incremental');
    if (plan.mode === 'incremental') {
      expect(plan.dirtyIndices).toEqual([]);
    }
  });

  it('marks only changed pages dirty', () => {
    const schema = makeSchema(5);
    const data = {};
    const globalHash = computeGlobalPreviewHash(schema, data);
    const cache = getPreviewPageCache();
    cache.setGlobalHash(globalHash);
    for (let i = 0; i < 5; i++) {
      cache.set(
        schema.pages[i].id,
        computePagePreviewHash(schema, data, i, globalHash),
        `<svg>${i}</svg>`
      );
    }

    const edited = structuredClone(schema);
    const comp = edited.pages[2].body.components[0];
    if (comp.type === 'text') comp.content = 'Edited page 3';

    const plan = planPreviewRender(edited, data);
    expect(plan.mode).toBe('incremental');
    if (plan.mode === 'incremental') {
      expect(plan.dirtyIndices).toEqual([2]);
    }
  });

  it('uses full-warm when too many dirty pages', () => {
    const schema = makeSchema(PREVIEW_INCREMENTAL_MAX_DIRTY + 10);
    const plan = planPreviewRender(schema, {});
    expect(plan.mode).toBe('full-warm');
  });
});

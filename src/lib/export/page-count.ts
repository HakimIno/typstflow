import type { LayoutSchema } from '@/types/schema';
import { SERVER_EXPORT_PAGE_THRESHOLD } from './constants';

function resolvePathSegments(path: string, data: Record<string, unknown>): unknown {
  const segments = path.replace(/^\{\{|\}\}$/g, '').trim().split('.');
  let current: unknown = data;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Estimates how many output pages a report will produce.
 * Used to decide browser WASM vs server Typst CLI export.
 */
export function getExportPageCount(schema: LayoutSchema, data: Record<string, unknown>): number {
  const basePages = schema.pages.length;

  if (schema.batchDataSource) {
    const raw = resolvePathSegments(schema.batchDataSource, data);
    const batchCount = Array.isArray(raw) ? raw.length : 1;
    return basePages * Math.max(1, batchCount);
  }

  return basePages;
}

export function shouldUseServerExport(
  schema: LayoutSchema,
  data: Record<string, unknown>,
  threshold = SERVER_EXPORT_PAGE_THRESHOLD
): boolean {
  return getExportPageCount(schema, data) > threshold;
}

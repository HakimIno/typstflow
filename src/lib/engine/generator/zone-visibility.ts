import type { Zone } from '@/types/schema';

export function shouldRenderZone(
  zone: Zone,
  pageIndex: number,
  totalPages: number,
  _type: 'header' | 'footer'
): boolean {
  if (zone.repeatOnEveryPage) return true;
  if (zone.showOnFirstPageOnly) return pageIndex === 0;
  if (zone.showOnLastPageOnly) return pageIndex === totalPages - 1;
  return pageIndex === 0;
}

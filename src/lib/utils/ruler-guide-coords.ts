import { LayoutEngine } from '@/lib/engine/layout-engine';

/** Map page-local mm to ruler tick position in px (accounts for scroll offset via caller). */
export function pageMmToRulerPx(valueMm: number, zoom: number): number {
  return valueMm * LayoutEngine.mmToPx(1) * zoom;
}

/** Double-click on horizontal ruler → vertical guide X (page-local mm). */
export function horizontalRulerClickToMm(
  clientX: number,
  rulerLeft: number,
  scrollPosX: number,
  zoom: number,
  pageWidthMm: number
): number | null {
  const pxPerMm = LayoutEngine.mmToPx(1) * zoom;
  const x = LayoutEngine.snap((clientX - rulerLeft + scrollPosX) / pxPerMm, 1);
  if (x < 0 || x > pageWidthMm) return null;
  return x;
}

/** Double-click on vertical ruler → horizontal guide Y (page-local mm). */
export function verticalRulerClickToMm(
  clientY: number,
  rulerTop: number,
  scrollPosY: number,
  zoom: number,
  pageHeightMm: number,
  pageGapMm: number
): number | null {
  const pxPerMm = LayoutEngine.mmToPx(1) * zoom;
  const clickMm = (clientY - rulerTop + scrollPosY) / pxPerMm;
  const bandMm = pageHeightMm + pageGapMm;
  const localY = LayoutEngine.snap(clickMm - Math.floor(clickMm / bandMm) * bandMm, 1);
  if (localY < 0 || localY > pageHeightMm) return null;
  return localY;
}

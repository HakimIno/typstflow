import {
  type BuildWasmSnapNodesOptions,
  buildWasmSnapNodes,
  getSnapPageRange,
} from '@/lib/utils/wasm-snap-nodes';
import type { WasmLayoutEngine, WasmSpacingIndicator } from '@/lib/wasm-layout-engine';
import type { SpacingIndicator } from '@/store/store-types';
import type { LayoutSchema } from '@/types/schema';

export const SNAP_THRESHOLD_MM = 2;
export const SNAP_PAGE_RADIUS = 2;

let wasmEngineCache: WasmLayoutEngine | null = null;

export async function getWasmLayoutEngine(): Promise<WasmLayoutEngine> {
  if (wasmEngineCache) return wasmEngineCache;
  const { layoutEngine } = await import('@/lib/wasm-layout-engine');
  wasmEngineCache = layoutEngine;
  return wasmEngineCache;
}

export interface ComponentSnapResult {
  snappedX: number;
  snappedY: number;
  activeGuidesX: number[];
  activeGuidesY: number[];
  spacingIndicators: WasmSpacingIndicator[];
}

export function calculateComponentSnap(
  engine: WasmLayoutEngine,
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  isAltKeyPressed: boolean
): ComponentSnapResult {
  if (isAltKeyPressed) {
    return {
      snappedX: x,
      snappedY: y,
      activeGuidesX: [],
      activeGuidesY: [],
      spacingIndicators: [],
    };
  }

  const fullSnap = engine.calculateSnap(id, x, y, width, height, SNAP_THRESHOLD_MM);
  if (!fullSnap) {
    return {
      snappedX: Math.round(x),
      snappedY: Math.round(y),
      activeGuidesX: [],
      activeGuidesY: [],
      spacingIndicators: [],
    };
  }

  return {
    snappedX: fullSnap.snapped_x,
    snappedY: fullSnap.snapped_y,
    activeGuidesX: fullSnap.guides_x,
    activeGuidesY: fullSnap.guides_y,
    spacingIndicators: fullSnap.spacing_indicators,
  };
}

export async function loadWasmSnapNodes(
  schema: LayoutSchema,
  options: BuildWasmSnapNodesOptions
): Promise<WasmLayoutEngine> {
  const engine = await getWasmLayoutEngine();
  await engine.initWasm();
  engine.loadNodes(buildWasmSnapNodes(schema, options));
  return engine;
}

export function reloadWasmSnapNodes(
  engine: WasmLayoutEngine,
  schema: LayoutSchema,
  options: BuildWasmSnapNodesOptions
): void {
  engine.loadNodes(buildWasmSnapNodes(schema, options));
}

/** Convert WASM spacing indicators to store/UI format (camelCase, page-local Y). */
export function toPageLocalSpacingIndicators(
  indicators: WasmSpacingIndicator[],
  pageAbsOffsetMm = 0
): SpacingIndicator[] {
  return indicators.map((ind) => {
    const isHorizontal = ind.side === 'left' || ind.side === 'right';
    if (isHorizontal) {
      return {
        side: ind.side,
        distance: ind.distance,
        lineStart: ind.line_start,
        lineEnd: ind.line_end,
        crossPos: ind.cross_pos - pageAbsOffsetMm,
      };
    }
    return {
      side: ind.side,
      distance: ind.distance,
      lineStart: ind.line_start - pageAbsOffsetMm,
      lineEnd: ind.line_end - pageAbsOffsetMm,
      crossPos: ind.cross_pos,
    };
  });
}

/** Convert document-absolute guide positions to page-local for SnapGuides overlay. */
export function toPageLocalGuides(
  guidesX: number[],
  guidesY: number[],
  pageAbsOffsetMm: number
): { vertical: number[]; horizontal: number[] } {
  return {
    vertical: guidesX,
    horizontal: guidesY.map((y) => y - pageAbsOffsetMm),
  };
}

export { buildWasmSnapNodes, getSnapPageRange };

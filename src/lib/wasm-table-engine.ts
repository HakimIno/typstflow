import type { TableComponent } from '@/types/schema';
import init, { TableEngine } from './wasm-bridge/typst_bridge';

export interface ResolvedCell {
  id: string;
  section: string; // 'header', 'data', 'footer'
  row_id: string;
  col_idx: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page_index: number;
  content: string;
  fill?: string;
  align: 'left' | 'center' | 'right';
  rowspan: number;
  colspan: number;
}

export interface TableResolutionResult {
  cells: ResolvedCell[];
  total_height: number;
  pages_used: number;
}

export class WasmTableEngine {
  private static instance: WasmTableEngine;
  private initialized = false;

  public static getInstance(): WasmTableEngine {
    if (!WasmTableEngine.instance) {
      WasmTableEngine.instance = new WasmTableEngine();
    }
    return WasmTableEngine.instance;
  }

  public async initWasm() {
    if (this.initialized) return;
    try {
      await init();
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize WasmTableEngine', e);
    }
  }

  public resolve(
    component: TableComponent,
    pageHeightMm: number,
    startYMm = 0
  ): TableResolutionResult | null {
    if (!this.initialized) return null;

    try {
      const componentJson = JSON.stringify(component);
      const result = TableEngine.resolve(componentJson, pageHeightMm, startYMm);
      return result as TableResolutionResult;
    } catch (e) {
      console.error('WasmTableEngine resolve error:', e);
      return null;
    }
  }
}

export const tableEngine = WasmTableEngine.getInstance();

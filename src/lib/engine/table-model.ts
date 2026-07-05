import { unifyTableRows } from '@/lib/utils/table-migrate';
import type { AnyTableComponent, TableRow } from '@/types/schema';

/**
 * Shared table body view-model (plan/table-system-redesign.md — Phase 2).
 *
 * Resolves a table's body rows into the exact ordered list of row *instances*
 * that should appear in the output: static rows once, contiguous runs of
 * `data` rows (repeat bands) once per data item, plus minRows padding, the
 * design-mode placeholder pass, and trailing rows (form-table fillers).
 *
 * Both the Typst generator and (Phase 3) the designer preview consume this
 * model so the two can never drift on row sequencing again. Pure computation —
 * data resolution against bindings stays with the caller.
 */

export type BodyRowOrigin = 'static' | 'band' | 'pad' | 'placeholder' | 'trailing';

export interface BodyRowInstance {
  row: TableRow;
  origin: BodyRowOrigin;
  /**
   * Index of the source row within the table's body rows — keeps `data:y:x`
   * cellStyles keys stable across repeat instances. -1 for trailing rows.
   */
  sourceIndex: number;
  /** Data item bound to this instance (band rows; `{}` for pad/placeholder). */
  item?: unknown;
  /** Repeat instance number within the band (band/pad/placeholder rows). */
  bandIndex?: number;
}

export interface TableBodyModelOptions {
  /** Resolved dataSource items ([ctx.local] for isStatic tables). */
  dataItems: unknown[];
  /** Static tables render each band exactly once — no padding or placeholders. */
  isStatic?: boolean;
  /** Pad each band with empty instances up to this many (form-table minRows). */
  minRows?: number;
  /** Rows appended after the body (form-table filler rows). */
  trailingRows?: TableRow[];
  /** Render one placeholder band instance when there is no data (design mode). */
  renderDesignPlaceholders?: boolean;
}

/** Body source rows (data + static) of the unified row list, in order. */
export function tableBodyRows(comp: AnyTableComponent): TableRow[] {
  return unifyTableRows(comp).filter(
    (r) => (r.type === 'data' && hasRenderableDataRowContent(r)) || r.type === 'static'
  );
}

function hasRenderableDataRowContent(row: TableRow): boolean {
  return row.cells.some((cell) => {
    if (cell.content.trim() !== '') return true;
    return !!(cell.fill || cell.stroke || cell.style);
  });
}

/**
 * Expands body source rows into ordered render instances.
 *
 * A band (contiguous `data` rows) repeats per data item; `static` rows render
 * once at their position. When a dynamic table has no data, each band renders
 * one placeholder instance (unless suppressed) so the design keeps its shape.
 */
export function buildTableBodyModel(
  comp: AnyTableComponent,
  options: TableBodyModelOptions
): BodyRowInstance[] {
  const isStatic = options.isStatic ?? false;
  const dataItems = options.dataItems;
  const padCount =
    !isStatic && options.minRows ? Math.max(0, options.minRows - dataItems.length) : 0;
  const renderPlaceholder =
    options.renderDesignPlaceholders !== false &&
    !isStatic &&
    dataItems.length === 0 &&
    padCount === 0;

  const source = tableBodyRows(comp);
  const instances: BodyRowInstance[] = [];
  const dataSourcePath = cleanDataSourcePath(comp.dataSource);

  const pushBand = (band: { row: TableRow; sourceIndex: number }[]) => {
    const emit = (item: unknown, bandIndex: number, origin: BodyRowOrigin) => {
      for (const { row, sourceIndex } of band) {
        instances.push({ row, origin, sourceIndex, item, bandIndex });
      }
    };
    dataItems.forEach((item, i) => emit(item, i, 'band'));
    if (renderPlaceholder) emit({}, 0, 'placeholder');
    for (let i = 0; i < padCount; i++) emit({}, dataItems.length + i, 'pad');
  };

  let band: { row: TableRow; sourceIndex: number }[] = [];
  source.forEach((row, sourceIndex) => {
    if (row.type === 'static' || (!isStatic && !rowRepeatsWithDataSource(row, dataSourcePath))) {
      if (band.length) {
        pushBand(band);
        band = [];
      }
      instances.push({ row, origin: 'static', sourceIndex });
    } else {
      band.push({ row, sourceIndex });
    }
  });
  if (band.length) pushBand(band);

  for (const row of options.trailingRows ?? []) {
    instances.push({ row, origin: 'trailing', sourceIndex: -1 });
  }

  return instances;
}

function cleanDataSourcePath(expr: string): string {
  return expr
    .replace(/\{\{|\}\}/g, '')
    .replace(/\[\*\]/g, '')
    .trim();
}

function rowRepeatsWithDataSource(row: TableRow, dataSourcePath: string): boolean {
  if (!dataSourcePath) return false;
  return row.cells.some((cell) =>
    cell.content.match(/\{\{(.+?)\}\}/g)?.some((binding) => {
      const path = binding.replace(/\{\{|\}\}/g, '').trim();
      if (!path || /^(SUM|COUNT|AVG|MIN|MAX)\(/i.test(path)) return false;
      if (path.includes('[*]')) {
        return path.replace(/\[\*\].*$/, '') === dataSourcePath;
      }
      if (path.startsWith(`${dataSourcePath}.`)) return true;
      return !path.includes('.');
    })
  );
}

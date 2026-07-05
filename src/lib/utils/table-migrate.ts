import type {
  AnyTableComponent,
  FormTableComponent,
  TableCell,
  TableColumn,
  TableRow,
} from '@/types/schema';

/**
 * Unified row model migration (plan/table-system-redesign.md — Phase 1).
 *
 * A table's rows historically live in up to four arrays (`headerRows`,
 * `detailRows`, `footerRows`, form-table `footerGridRows`) plus a legacy mode
 * where rows are synthesized from `columns[]` at render time. This module maps
 * between that split representation and the single ordered `rows` list:
 *
 * - {@link unifyTableRows} — derive the canonical ordered list (read side).
 * - {@link splitUnifiedRows} — write a unified list back to every representation
 *   so legacy readers (generator, TablePreview) stay correct until Phase 2/3
 *   flips them to the unified model.
 * - {@link normalizeTableComponent} — persist `rows` on a component (idempotent).
 *
 * All functions are pure; callers write results through store actions.
 */

/** Rows synthesized from legacy `columns[]` get deterministic ids so repeated
 * normalization never churns the schema. */
const SYNTH_HEADER_ROW = 'synth-header';
const SYNTH_DATA_ROW = 'synth-data';

function footerGridRowsOf(comp: AnyTableComponent): TableRow[] | undefined {
  return comp.type === 'form-table' ? comp.footerGridRows : undefined;
}

/** Coerce a row's type to match the section array it was stored in. */
function coerceType(row: TableRow, section: 'header' | 'body' | 'footer'): TableRow {
  if (section === 'header') return row.type === 'header' ? row : { ...row, type: 'header' };
  if (section === 'footer') return row.type === 'footer' ? row : { ...row, type: 'footer' };
  // Body rows keep the data/static distinction; anything else becomes 'data'.
  if (row.type === 'data' || row.type === 'static') return row;
  return { ...row, type: 'data' };
}

function synthHeaderCell(comp: AnyTableComponent, col: TableColumn): TableCell {
  return {
    id: `${comp.id}-${SYNTH_HEADER_ROW}-${col.id}`,
    content: col.header,
    // Legacy header rendering centers by default; explicit per-column values win.
    align: col.align ?? 'center',
    colspan: col.colspan,
    rowspan: col.rowspan,
    // Only explicit per-column fill is baked in — the headerBackground/#f1f5f9
    // default stays a renderer concern so later style edits keep propagating.
    fill: col.background,
    style: col.style,
  };
}

function synthDataCell(comp: AnyTableComponent, col: TableColumn): TableCell {
  return {
    id: `${comp.id}-${SYNTH_DATA_ROW}-${col.id}`,
    content: col.field ? `{{${col.field}}}` : '',
    align: col.align,
    colspan: col.colspan,
    rowspan: col.rowspan,
    format: col.format,
    fill: col.background,
    style: col.style,
  };
}

/** Columns hidden under a preceding colspan, mirroring the legacy render loops. */
function visibleColumns(columns: TableColumn[]): TableColumn[] {
  const out: TableColumn[] = [];
  const covered = new Set<number>();
  columns.forEach((col, x) => {
    if (covered.has(x)) return;
    out.push(col);
    for (let i = 1; i < (col.colspan ?? 1); i++) covered.add(x + i);
  });
  return out;
}

/** Structured rows synthesized from a legacy `columns[]`-only table. */
export function synthesizeRowsFromColumns(comp: AnyTableComponent): TableRow[] {
  const cols = visibleColumns(comp.columns);
  const rows: TableRow[] = [];
  if (comp.showHeader !== false) {
    rows.push({
      id: `${comp.id}-${SYNTH_HEADER_ROW}`,
      type: 'header',
      repeat: comp.repeatHeaderOnPage !== false,
      cells: cols.map((col) => synthHeaderCell(comp, col)),
    });
  }
  rows.push({
    id: `${comp.id}-${SYNTH_DATA_ROW}`,
    type: 'data',
    cells: cols.map((col) => synthDataCell(comp, col)),
  });
  return rows;
}

/**
 * Derives the canonical ordered row list for a table.
 *
 * Precedence: legacy section arrays (header → detail → footer → footerGridRows)
 * win over a persisted `rows` list — during the transition some writers still
 * edit only the section arrays, so they are the fresher source; `splitUnifiedRows`
 * re-syncs `rows` on the next unified write. A populated `rows` is used only when
 * every section array is empty (fully migrated table).
 *
 * Sections missing from a partly-structured table are synthesized from
 * `columns[]` per section, mirroring how the generator has always rendered them
 * (a table with only detailRows still gets a synthetic header from column
 * headers; a table with only headerRows still gets a `{{field}}` body row).
 */
export function unifyTableRows(comp: AnyTableComponent): TableRow[] {
  const grid = footerGridRowsOf(comp);
  const hasSectionRows = !!(
    comp.headerRows?.length ||
    comp.detailRows?.length ||
    comp.footerRows?.length ||
    grid?.length
  );
  if (!hasSectionRows) {
    if (comp.rows?.length) return comp.rows;
    return synthesizeRowsFromColumns(comp);
  }

  const synth = synthesizeRowsFromColumns(comp);
  const header = comp.headerRows?.length
    ? comp.headerRows.map((r) => coerceType(r, 'header'))
    : synth.filter((r) => r.type === 'header');
  const body = comp.detailRows?.length
    ? comp.detailRows.map((r) => coerceType(r, 'body'))
    : synth.filter((r) => r.type === 'data');
  const footer = [...(comp.footerRows ?? []), ...(grid ?? [])].map((r) => coerceType(r, 'footer'));
  return [...header, ...body, ...footer];
}

/**
 * Splits a unified row list back into every stored representation.
 *
 * Returns a partial component update containing `rows` plus the legacy section
 * arrays kept in sync. Body rows keep their `static`/`data` type inside
 * `detailRows` (legacy readers treat both as data until Phase 2 understands
 * `static`). For form-tables, footer rows return to the array they came from
 * (matched by id); brand-new footer rows follow the bucket of the footer row
 * preceding them, defaulting to `footerRows`.
 */
export function splitUnifiedRows(
  comp: AnyTableComponent,
  rows: TableRow[]
): Partial<FormTableComponent> {
  const headerRows: TableRow[] = [];
  const detailRows: TableRow[] = [];
  const footerRows: TableRow[] = [];
  const footerGridRows: TableRow[] = [];

  const oldGridIds = new Set((footerGridRowsOf(comp) ?? []).map((r) => r.id));
  const oldFooterIds = new Set((comp.footerRows ?? []).map((r) => r.id));
  let lastFooterBucket: TableRow[] = footerRows;

  for (const row of rows) {
    switch (row.type) {
      case 'header':
        headerRows.push(row);
        break;
      case 'footer': {
        const bucket = oldGridIds.has(row.id)
          ? footerGridRows
          : oldFooterIds.has(row.id)
            ? footerRows
            : lastFooterBucket;
        bucket.push(row);
        lastFooterBucket = bucket;
        break;
      }
      // group-header/group-footer rows are render-time only and never stored.
      case 'group-header':
      case 'group-footer':
        break;
      default:
        detailRows.push(row);
        break;
    }
  }

  const updates: Partial<FormTableComponent> = { rows, headerRows, detailRows, footerRows };
  if (comp.type === 'form-table' && (comp.footerGridRows !== undefined || footerGridRows.length)) {
    updates.footerGridRows = footerGridRows;
  }
  return updates;
}

/**
 * Returns the component with `rows` populated and the legacy arrays in sync.
 * Idempotent — normalizing an already-normalized component returns the same
 * object so schema hydration never causes needless history churn.
 */
export function normalizeTableComponent<T extends AnyTableComponent>(comp: T): T {
  const unified = unifyTableRows(comp);
  const existing = comp.rows;
  const unchanged =
    !!existing &&
    existing.length === unified.length &&
    unified.every((row, i) => existing[i] === row);
  if (unchanged) return comp;
  return { ...comp, ...splitUnifiedRows(comp, unified) };
}

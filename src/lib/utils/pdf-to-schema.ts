/**
 * Deterministic PDF → components builder ("Case 1" precise import).
 *
 * Turns a {@link PdfTextExtraction} into positioned designer components without
 * any LLM in the loop: standalone lines become `text` components, detected
 * table regions become static `table` components, all at their exact mm
 * coordinates. This is what guarantees faithful placement — the geometry, not a
 * model's guess, drives the layout.
 *
 * Coordinate contract: the Typst generator renders at page margin 0 with the
 * body zone offset by the header height. So the caller must import these into
 * the body zone of a page with an empty header and margin 0 — then the PDF's
 * page-absolute coordinates map 1:1. See the panel wiring in AiPanel.
 */

import type {
  ComponentNode,
  PageConfig,
  TableCell,
  TableComponent,
  TableRow,
  TextComponent,
} from '@/types/schema';
import {
  type GridCell,
  type LatticeTable,
  type RuleSegment,
  reconstructLattice,
} from './pdf-lattice';
import {
  type PdfTextExtraction,
  type TableDetectOptions,
  type TableRegion,
  type TextLine,
  detectTables,
  ptToMm,
} from './pdf-to-text-blocks';

export interface ImportedLayout {
  page: Pick<PageConfig, 'size' | 'orientation' | 'margin'>;
  components: ComponentNode[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function textFromLine(line: TextLine): TextComponent {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x: round1(line.xMm),
    y: round1(line.yMm),
    width: round1(Math.max(line.wMm, 2)),
    height: round1(Math.max(line.hMm * 1.3, ptToMm(line.fontSizePt) * 1.3, 3)),
    content: line.text,
    align: 'left',
    style: {
      fontSize: line.fontSizePt,
      fontWeight: line.bold ? 'bold' : 'regular',
      color: '#000000',
    },
  };
}

function tableFromRegion(region: TableRegion): TableComponent {
  const headerRow = region.hasHeader ? region.rows[0] : null;
  const dataRows = region.hasHeader ? region.rows.slice(1) : region.rows;

  const columns = region.columns.map((col, i) => ({
    id: crypto.randomUUID(),
    header: headerRow?.cells[i] ?? '',
    field: '',
    width: `${round1(col.wMm)}mm`,
    align: 'left' as const,
  }));

  const detailRows: TableRow[] = dataRows.map((r) => ({
    id: crypto.randomUUID(),
    type: 'data',
    cells: r.cells.map((content) => ({ id: crypto.randomUUID(), content })),
  }));

  return {
    id: crypto.randomUUID(),
    type: 'table',
    x: round1(region.xMm),
    y: round1(region.yMm),
    width: round1(region.wMm),
    height: round1(region.hMm),
    dataSource: '',
    isStatic: true,
    showHeader: region.hasHeader,
    repeatHeaderOnPage: false,
    columns,
    detailRows,
    style: {
      fontSize: 10,
      headerBackground: '#f5f5f5',
      borderColor: '#e0e0e0',
      borderWidth: '0.5pt',
      cellPadding: '4pt',
    },
  };
}

/** Map a reconstructed lattice (with merges) to a static table component. */
function latticeToTable(t: LatticeTable): TableComponent {
  const columns = Array.from({ length: t.nCols }, (_, c) => ({
    id: crypto.randomUUID(),
    header: '',
    field: '',
    width: `${round1(t.colEdges[c + 1] - t.colEdges[c])}mm`,
    align: 'left' as const,
  }));

  const byRow = new Map<number, GridCell[]>();
  for (const cell of t.cells) {
    const arr = byRow.get(cell.row);
    if (arr) arr.push(cell);
    else byRow.set(cell.row, [cell]);
  }

  // One row per physical row; only owner cells (colspan/rowspan) are emitted —
  // buildLogicalGrid fills covered positions from the spans.
  const detailRows: TableRow[] = [];
  for (let r = 0; r < t.nRows; r++) {
    const rowCells = (byRow.get(r) ?? []).sort((a, b) => a.col - b.col);
    detailRows.push({
      id: crypto.randomUUID(),
      type: 'data',
      cells: rowCells.map(
        (cell): TableCell => ({
          id: crypto.randomUUID(),
          content: cell.text,
          ...(cell.colspan > 1 ? { colspan: cell.colspan } : {}),
          ...(cell.rowspan > 1 ? { rowspan: cell.rowspan } : {}),
          ...(cell.bold ? { style: { fontWeight: 'bold' as const } } : {}),
        })
      ),
    });
  }

  return {
    id: crypto.randomUUID(),
    type: 'table',
    x: round1(t.xMm),
    y: round1(t.yMm),
    width: round1(t.wMm),
    height: round1(t.hMm),
    dataSource: '',
    isStatic: true,
    showHeader: false,
    repeatHeaderOnPage: false,
    columns,
    detailRows,
    style: {
      fontSize: 10,
      headerBackground: '#f5f5f5',
      borderColor: '#333333',
      borderWidth: '0.5pt',
      cellPadding: '4pt',
    },
  };
}

/** True when a text line's center falls inside the lattice table's box. */
function lineInsideLattice(line: TextLine, t: LatticeTable): boolean {
  const cx = line.xMm + line.wMm / 2;
  const cy = line.yMm + line.hMm / 2;
  return cx >= t.xMm && cx <= t.xMm + t.wMm && cy >= t.yMm && cy <= t.yMm + t.hMm;
}

/**
 * Build page config + components from an extracted PDF page.
 *
 * Order: bordered tables from ruling lines first (they capture merged cells),
 * then text-alignment tables and free text for whatever falls outside them.
 * Margins are zeroed so page-absolute coordinates map straight through.
 */
export function buildImportedComponents(
  extraction: PdfTextExtraction,
  rules: RuleSegment[] = [],
  opts?: TableDetectOptions
): ImportedLayout {
  const components: ComponentNode[] = [];
  let remainingLines = extraction.lines;

  if (rules.length > 0) {
    const allBlocks = extraction.lines.flatMap((l) => l.blocks);
    const lattice = reconstructLattice(rules, allBlocks);
    if (lattice) {
      components.push(latticeToTable(lattice));
      remainingLines = extraction.lines.filter((l) => !lineInsideLattice(l, lattice));
    }
  }

  const { tables, textLines } = detectTables(remainingLines, opts);
  components.push(...textLines.map(textFromLine), ...tables.map(tableFromRegion));

  return {
    page: {
      size: extraction.paperSize,
      orientation: extraction.orientation,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    },
    components,
  };
}

// ─── AI-driven import (serialize precise structure for the design agent) ───────

function describeLatticeTable(t: LatticeTable, n: number): string {
  const widths = t.colEdges
    .slice(1)
    .map((e, i) => round1(e - t.colEdges[i]))
    .join(' | ');

  const byRow = new Map<number, GridCell[]>();
  for (const cell of t.cells) {
    const arr = byRow.get(cell.row);
    if (arr) arr.push(cell);
    else byRow.set(cell.row, [cell]);
  }

  const rows: string[] = [];
  for (let r = 0; r < t.nRows; r++) {
    const parts = (byRow.get(r) ?? [])
      .sort((a, b) => a.col - b.col)
      .map((c) => {
        const tags = [
          c.bold ? 'b' : '',
          c.colspan > 1 ? `cs${c.colspan}` : '',
          c.rowspan > 1 ? `rs${c.rowspan}` : '',
        ]
          .filter(Boolean)
          .join(',');
        return `"${c.text}"${tags ? `[${tags}]` : ''}`;
      });
    rows.push(`row${r + 1}: ${parts.join(' | ')}`);
  }

  return [
    `TABLE ${n} — add_static_table zone=body x=${round1(t.xMm)} y=${round1(t.yMm)} width=${round1(t.wMm)} height=${round1(t.hMm)}`,
    `columns width(mm): ${widths}`,
    'rows (list only owner cells; [b]=bold, [csN]=colspan, [rsN]=rowspan cover neighbours — do not repeat them):',
    rows.join('\n'),
  ].join('\n');
}

function describeRegionTable(region: TableRegion, n: number): string {
  const widths = region.columns.map((c) => round1(c.wMm)).join(' | ');
  const rows = region.rows.map((row, i) => {
    const parts = row.cells.map((text) => `"${text}"${region.hasHeader && i === 0 ? '[b]' : ''}`);
    return `row${i + 1}: ${parts.join(' | ')}`;
  });
  return [
    `TABLE ${n} — add_static_table zone=body x=${round1(region.xMm)} y=${round1(region.yMm)} width=${round1(region.wMm)} height=${round1(region.hMm)}`,
    `columns width(mm): ${widths}`,
    'rows:',
    rows.join('\n'),
  ].join('\n');
}

/**
 * Serialize the precise extraction into a faithful-reproduction brief for the
 * design agent: exact text lines + fully-resolved tables (including merged
 * cells from the lattice) that the AI transcribes via add_text/add_static_table.
 * The heavy geometry is pre-computed here so the model only has to organize it.
 */
export function serializeImportForPrompt(
  extraction: PdfTextExtraction,
  rules: RuleSegment[] = [],
  opts?: TableDetectOptions
): string {
  let remainingLines = extraction.lines;
  const tableDescs: string[] = [];
  let n = 0;

  if (rules.length > 0) {
    const allBlocks = extraction.lines.flatMap((l) => l.blocks);
    const lattice = reconstructLattice(rules, allBlocks);
    if (lattice) {
      n += 1;
      tableDescs.push(describeLatticeTable(lattice, n));
      remainingLines = extraction.lines.filter((l) => !lineInsideLattice(l, lattice));
    }
  }

  const { tables, textLines } = detectTables(remainingLines, opts);
  for (const t of tables) {
    n += 1;
    tableDescs.push(describeRegionTable(t, n));
  }

  const textDesc =
    textLines.length > 0
      ? `TEXT (${textLines.length} lines):\n${textLines
          .map(
            (l) =>
              `- add_text x=${round1(l.xMm)} y=${round1(l.yMm)} w=${round1(l.wMm)} h=${round1(
                l.hMm
              )} fontSize=${round1(l.fontSizePt)}${l.bold ? ' bold' : ''} "${l.text}"`
          )
          .join('\n')}`
      : 'TEXT: none';

  const header = `Reproduce this PDF page 1:1 in the BODY zone. The page is already set (${extraction.paperSize} ${extraction.orientation}, margins 0) — do NOT change the page or reposition anything. Coordinates are in mm from the top-left corner; use them exactly. Use add_text for text lines and add_static_table for tables (with colspan/rowspan for merged cells). Keep all text verbatim.`;

  return [header, textDesc, ...tableDescs].join('\n\n');
}

'use client';

/**
 * PDF text-layer extractor ("Case 1" — precise structured import).
 *
 * Unlike raster/vision-based import, this module reads the PDF's real text layer
 * via pdf.js and returns
 * every text run with its exact position/size in millimetres. That structured
 * data is fed to the design agent as a *semantic* task ("group these into
 * headings / tables / paragraphs") instead of asking a model to OCR pixels —
 * so the input text is 100% correct and only the grouping is inferred.
 *
 * The pdf.js I/O ({@link extractTextBlocks}) is browser-only and must never be
 * imported from server code. Everything else is pure and unit-tested.
 */

import type { PageConfig } from '@/types/schema';

// ─── Units ──────────────────────────────────────────────────────────────────

/** PDF user space is in points (1/72 in); the designer works in millimetres. */
export const PT_TO_MM = 25.4 / 72;

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM;
}

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A raw text run as returned by pdf.js `getTextContent().items` (the fields we
 * consume). `transform` is the text-space → user-space matrix `[a,b,c,d,e,f]`
 * where `e,f` is the baseline origin and the scale factors encode font height.
 */
export interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

/** One text run, positioned top-left in millimetres from the page corner. */
export interface TextBlock {
  text: string;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  fontSizePt: number;
  bold: boolean;
}

/** Adjacent {@link TextBlock}s merged into a single visual line. */
export interface TextLine extends TextBlock {
  blocks: TextBlock[];
}

/** Full result of reading one PDF page's text layer. */
export interface PdfTextExtraction {
  pageWidthMm: number;
  pageHeightMm: number;
  paperSize: PageConfig['size'];
  orientation: PageConfig['orientation'];
  /** Clustered lines, ordered top-to-bottom then left-to-right (reading order). */
  lines: TextLine[];
  /** False for scanned/image-only PDFs — caller should fall back to vision. */
  hasTextLayer: boolean;
}

// ─── Font heuristics ──────────────────────────────────────────────────────────

/** Best-effort bold detection from the embedded font's PostScript name. */
export function isBoldFont(fontName?: string): boolean {
  return /bold|black|heavy|semibold/i.test(fontName ?? '');
}

// ─── Coordinate mapping ───────────────────────────────────────────────────────

/**
 * Convert one pdf.js text item into a top-left mm {@link TextBlock}.
 * PDF's origin is the *bottom-left* corner with `transform[5]` on the baseline,
 * so we flip Y against the page height and lift the box by the font height.
 */
export function rawItemToBlock(item: RawTextItem, pageHeightPt: number): TextBlock {
  const t = item.transform;
  // Font height from the transform scale; fall back to reported height.
  const fontHeightPt = Math.hypot(t[1] ?? 0, t[3] ?? 0) || Math.abs(t[3] ?? 0) || item.height || 0;
  const xPt = t[4] ?? 0;
  const baselinePt = t[5] ?? 0;
  const topPt = pageHeightPt - (baselinePt + fontHeightPt);
  return {
    text: item.str,
    xMm: ptToMm(xPt),
    yMm: ptToMm(topPt),
    wMm: ptToMm(item.width),
    hMm: ptToMm(fontHeightPt),
    fontSizePt: Math.round(fontHeightPt * 10) / 10,
    bold: isBoldFont(item.fontName),
  };
}

// ─── Paper size detection ─────────────────────────────────────────────────────

const PAPER_DIMS_MM: Record<PageConfig['size'], { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

/** Nearest standard paper size (portrait-normalised) plus the real orientation. */
export function detectPaperSize(
  pageWidthMm: number,
  pageHeightMm: number
): { paperSize: PageConfig['size']; orientation: PageConfig['orientation'] } {
  const orientation: PageConfig['orientation'] =
    pageWidthMm > pageHeightMm ? 'landscape' : 'portrait';
  const [w, h] =
    orientation === 'landscape' ? [pageHeightMm, pageWidthMm] : [pageWidthMm, pageHeightMm];

  let paperSize: PageConfig['size'] = 'A4';
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const size of Object.keys(PAPER_DIMS_MM) as Array<PageConfig['size']>) {
    const dims = PAPER_DIMS_MM[size];
    const diff = Math.abs(dims.w - w) + Math.abs(dims.h - h);
    if (diff < bestDiff) {
      bestDiff = diff;
      paperSize = size;
    }
  }
  return { paperSize, orientation };
}

// ─── Line clustering ──────────────────────────────────────────────────────────

export interface ClusterOptions {
  /** Vertical gap (× line font height in mm) kept on the same line. Default 0.5. */
  lineToleranceRatio?: number;
  /** Horizontal gap (× font height in mm) that inserts a space. Default 0.25. */
  spaceGapRatio?: number;
}

function finalizeLine(blocks: TextBlock[], spaceGapRatio: number): TextLine {
  const ordered = [...blocks].sort((a, b) => a.xMm - b.xMm);
  const fontSizePt = Math.max(...ordered.map((b) => b.fontSizePt));
  const fontMm = ptToMm(fontSizePt);

  let text = '';
  let prevRight: number | null = null;
  for (const b of ordered) {
    if (prevRight !== null && b.xMm - prevRight > fontMm * spaceGapRatio) {
      text += ' ';
    }
    text += b.text;
    prevRight = b.xMm + b.wMm;
  }

  const xMm = Math.min(...ordered.map((b) => b.xMm));
  const right = Math.max(...ordered.map((b) => b.xMm + b.wMm));
  const yMm = Math.min(...ordered.map((b) => b.yMm));
  const bottom = Math.max(...ordered.map((b) => b.yMm + b.hMm));
  const boldCount = ordered.filter((b) => b.bold).length;

  return {
    text: text.replace(/\s+/g, ' ').trim(),
    xMm,
    yMm,
    wMm: right - xMm,
    hMm: bottom - yMm,
    fontSizePt,
    bold: boldCount * 2 >= ordered.length,
    blocks: ordered,
  };
}

/**
 * Merge text runs into visual lines and return them in reading order.
 * pdf.js splits a single line into many fragments; we group by vertical
 * proximity (tolerance scales with font size), then order fragments left→right
 * and rebuild spacing from horizontal gaps.
 */
export function clusterIntoLines(blocks: TextBlock[], opts: ClusterOptions = {}): TextLine[] {
  const lineTol = opts.lineToleranceRatio ?? 0.5;
  const spaceGap = opts.spaceGapRatio ?? 0.25;

  const usable = blocks.filter((b) => b.text.trim() !== '');
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);

  const lines: TextLine[] = [];
  let current: TextBlock[] = [];
  let anchorY = sorted[0].yMm;
  let anchorFontMm = ptToMm(sorted[0].fontSizePt);

  for (const b of sorted) {
    const tol = Math.max(anchorFontMm * lineTol, 0.6);
    if (current.length > 0 && Math.abs(b.yMm - anchorY) > tol) {
      lines.push(finalizeLine(current, spaceGap));
      current = [];
    }
    if (current.length === 0) {
      anchorY = b.yMm;
      anchorFontMm = ptToMm(b.fontSizePt);
    }
    current.push(b);
  }
  if (current.length > 0) lines.push(finalizeLine(current, spaceGap));

  return lines;
}

// ─── Table detection ──────────────────────────────────────────────────────────

/** One horizontal segment of a line — a candidate table cell. */
interface CellSpan {
  text: string;
  xMm: number;
  rightMm: number;
}

/** A detected column: left edge and width in mm. */
export interface TableColumnRegion {
  xMm: number;
  wMm: number;
}

/** One detected table row: a value per column plus its vertical position. */
export interface TableRowData {
  cells: string[];
  bold: boolean;
  yMm: number;
  hMm: number;
}

/** A contiguous run of aligned rows recognised as a table. */
export interface TableRegion {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  columns: TableColumnRegion[];
  rows: TableRowData[];
  /** True when the first row looks like a header (bold). */
  hasHeader: boolean;
}

export interface StructuredExtraction {
  tables: TableRegion[];
  /** Lines that are not part of any table, in reading order. */
  textLines: TextLine[];
}

export interface TableDetectOptions {
  /** Horizontal gap (mm) that separates one cell from the next. Default 6. */
  columnGapMm?: number;
  /** Tolerance (mm) for treating cell starts as the same column. Default 8. */
  columnAlignMm?: number;
  /** Minimum rows for a run to count as a table. Default 2. */
  minRows?: number;
}

/** Split a line's fragments into cells wherever a wide horizontal gap appears. */
export function segmentCells(blocks: TextBlock[], columnGapMm: number): CellSpan[] {
  const ordered = blocks.filter((b) => b.text.trim() !== '').sort((a, b) => a.xMm - b.xMm);
  const cells: CellSpan[] = [];
  for (const b of ordered) {
    const last = cells[cells.length - 1];
    if (last && b.xMm - last.rightMm <= columnGapMm) {
      const space = b.xMm - last.rightMm > ptToMm(b.fontSizePt) * 0.25 ? ' ' : '';
      last.text = `${last.text}${space}${b.text}`;
      last.rightMm = Math.max(last.rightMm, b.xMm + b.wMm);
    } else {
      cells.push({ text: b.text, xMm: b.xMm, rightMm: b.xMm + b.wMm });
    }
  }
  return cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() }));
}

/** Cluster sorted x-values into column anchors (each anchor bounded to `tol` wide). */
function clusterAnchors(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const anchors: number[] = [];
  for (const v of sorted) {
    const last = anchors[anchors.length - 1];
    if (last === undefined || v - last > tol) anchors.push(v);
  }
  return anchors;
}

function nearestAnchorIndex(x: number, anchors: number[]): number {
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < anchors.length; i++) {
    const d = Math.abs(anchors[i] - x);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Split clustered lines into tables and free text.
 *
 * A table is a run of ≥`minRows` consecutive, vertically-contiguous lines that
 * each break into ≥2 cells at consistent x-positions. Columns come from
 * clustering every cell's left edge; each cell is assigned to its nearest
 * column. Everything else stays as standalone {@link TextLine}s.
 */
export function detectTables(
  lines: TextLine[],
  opts: TableDetectOptions = {}
): StructuredExtraction {
  const columnGapMm = opts.columnGapMm ?? 6;
  const columnAlignMm = opts.columnAlignMm ?? 8;
  const minRows = opts.minRows ?? 2;

  const perLine = lines.map((line) => ({ line, cells: segmentCells(line.blocks, columnGapMm) }));

  // Group consecutive multi-cell, vertically-contiguous lines into runs.
  type RowInfo = { line: TextLine; cells: CellSpan[] };
  const runs: RowInfo[][] = [];
  let current: RowInfo[] = [];
  for (const info of perLine) {
    if (info.cells.length < 2) {
      if (current.length) runs.push(current);
      current = [];
      continue;
    }
    const prev = current[current.length - 1];
    if (prev) {
      const gap = info.line.yMm - (prev.line.yMm + prev.line.hMm);
      if (gap > 2.5 * Math.max(info.line.hMm, 1)) {
        runs.push(current);
        current = [];
      }
    }
    current.push(info);
  }
  if (current.length) runs.push(current);

  const tables: TableRegion[] = [];
  const usedLines = new Set<TextLine>();

  for (const run of runs) {
    if (run.length < minRows) continue;

    const anchors = clusterAnchors(
      run.flatMap((r) => r.cells.map((c) => c.xMm)),
      columnAlignMm
    );
    if (anchors.length < 2) continue;

    const runRight = Math.max(...run.flatMap((r) => r.cells.map((c) => c.rightMm)));
    const columns: TableColumnRegion[] = anchors.map((x, i) => ({
      xMm: x,
      wMm: (i < anchors.length - 1 ? anchors[i + 1] : runRight) - x,
    }));

    const rows: TableRowData[] = run.map((r) => {
      const cells = new Array<string>(anchors.length).fill('');
      for (const c of r.cells) {
        const idx = nearestAnchorIndex(c.xMm, anchors);
        cells[idx] = cells[idx] ? `${cells[idx]} ${c.text}` : c.text;
      }
      return { cells, bold: r.line.bold, yMm: r.line.yMm, hMm: r.line.hMm };
    });

    const top = run[0].line.yMm;
    const bottom = Math.max(...run.map((r) => r.line.yMm + r.line.hMm));
    tables.push({
      xMm: columns[0].xMm,
      yMm: top,
      wMm: runRight - columns[0].xMm,
      hMm: bottom - top,
      columns,
      rows,
      hasHeader: run[0].line.bold,
    });
    for (const r of run) usedLines.add(r.line);
  }

  return { tables, textLines: lines.filter((l) => !usedLines.has(l)) };
}

// ─── Prompt serialization ─────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Render an extraction as a compact, token-efficient block for the design agent.
 * Mirrors the canvas summary style in the chat route (`@(x,y) w×h fs.. "text"`),
 * so the agent can place each line with the existing `add_*` tools. Text is
 * verbatim — the agent must reuse it, not re-type or guess it.
 */
export function serializeForPrompt(extraction: PdfTextExtraction): string {
  const { paperSize, orientation, pageWidthMm, pageHeightMm, lines } = extraction;
  const head = [
    'Source PDF text layer — extracted verbatim (text is 100% correct; infer only structure).',
    `Page: ${paperSize} ${orientation}, ${round1(pageWidthMm)}×${round1(pageHeightMm)}mm. Coordinates in mm from the top-left corner.`,
    `${lines.length} lines in reading order:`,
  ].join('\n');
  const body = lines
    .map((l, i) => {
      const pos = `@(${round1(l.xMm)},${round1(l.yMm)})`;
      const size = `${round1(l.wMm)}×${round1(l.hMm)}mm`;
      const style = `fs${round1(l.fontSizePt)}${l.bold ? ' bold' : ''}`;
      return `${i + 1}. ${pos} ${size} ${style} "${l.text}"`;
    })
    .join('\n');
  return `${head}\n${body}`;
}

// ─── pdf.js I/O (browser only) ────────────────────────────────────────────────

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

// Keep this loader local so this module stays self-contained.
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
      );
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** Minimal pdf.js page surface consumed by {@link buildExtractionFromPage}. */
export interface PdfTextPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}

/**
 * Build a {@link PdfTextExtraction} from an already-opened pdf.js page.
 * Split out so a caller can open the document once and read text + graphics
 * (see pdf-lattice `extractPdfImport`) without opening the PDF twice.
 */
export async function buildExtractionFromPage(page: PdfTextPage): Promise<PdfTextExtraction> {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidthPt = viewport.width;
  const pageHeightPt = viewport.height;

  const content = await page.getTextContent();
  // Skip marked-content markers (no `str`) that pdf.js interleaves.
  const rawItems = content.items.filter(
    (it) => typeof (it as { str?: unknown }).str === 'string'
  ) as unknown as RawTextItem[];
  const blocks = rawItems
    .filter((it) => it.str.trim() !== '')
    .map((it) => rawItemToBlock(it, pageHeightPt));

  const lines = clusterIntoLines(blocks);
  const pageWidthMm = ptToMm(pageWidthPt);
  const pageHeightMm = ptToMm(pageHeightPt);
  const { paperSize, orientation } = detectPaperSize(pageWidthMm, pageHeightMm);

  return {
    pageWidthMm,
    pageHeightMm,
    paperSize,
    orientation,
    lines,
    hasTextLayer: blocks.length > 0,
  };
}

/**
 * Read the text layer of one PDF page into structured, positioned lines.
 * @param file    PDF file from a file input.
 * @param pageNum 1-based page index (default 1).
 */
export async function extractTextBlocks(file: File, pageNum = 1): Promise<PdfTextExtraction> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNum);
    return await buildExtractionFromPage(page as unknown as PdfTextPage);
  } finally {
    void loadingTask.destroy();
  }
}

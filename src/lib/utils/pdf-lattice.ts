'use client';

/**
 * Lattice table reconstruction ("Case 1" precise import, bordered tables).
 *
 * Text extraction alone cannot recover a table's merged cells — colspan/rowspan
 * live in the PDF's *ruling lines*, not its text. This module reads those lines
 * from the page's vector graphics (`getOperatorList`), rebuilds the true grid,
 * drops each text run into its cell, and infers spans from which internal
 * borders are absent (the "lattice" method, like Camelot).
 *
 * The pure reconstruction ({@link reconstructLattice}) is unit-tested; the pdf.js
 * graphics walk ({@link extractPdfImport}) is browser-only and needs a real PDF
 * to verify.
 */

import {
  type PdfTextExtraction,
  type TextBlock,
  buildExtractionFromPage,
  ptToMm,
} from './pdf-to-text-blocks';

// ─── Types ──────────────────────────────────────────────────────────────────

/** An axis-aligned rule segment in top-left mm coordinates. */
export interface RuleSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One reconstructed cell (an owner — covered positions are not emitted). */
export interface GridCell {
  /** Zero-based base-grid row/column of the cell's top-left. */
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  text: string;
  bold: boolean;
}

export interface LatticeTable {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  nRows: number;
  nCols: number;
  /** Column separator x-positions (length nCols + 1). */
  colEdges: number[];
  /** Row separator y-positions (length nRows + 1). */
  rowEdges: number[];
  cells: GridCell[];
}

export interface LatticeOptions {
  /** Orientation tolerance + edge-cluster width in mm. Default 1.5. */
  snapMm?: number;
  /** Segments shorter than this (mm) are ignored as noise. Default 4. */
  minLineMm?: number;
}

// ─── Pure reconstruction ──────────────────────────────────────────────────────

function cluster1d(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket: number[] = [];
  for (const v of sorted) {
    if (bucket.length > 0 && v - bucket[0] > tol) {
      out.push(bucket.reduce((s, x) => s + x, 0) / bucket.length);
      bucket = [];
    }
    bucket.push(v);
  }
  if (bucket.length > 0) out.push(bucket.reduce((s, x) => s + x, 0) / bucket.length);
  return out;
}

/**
 * Reconstruct a merged-cell table from ruling lines and text runs.
 * Returns null when the segments do not form a grid (< 2 columns or rows).
 */
export function reconstructLattice(
  segments: RuleSegment[],
  blocks: TextBlock[],
  opts: LatticeOptions = {}
): LatticeTable | null {
  const snap = opts.snapMm ?? 1.5;
  const minLine = opts.minLineMm ?? 4;

  const vs: Array<{ x: number; yTop: number; yBot: number }> = [];
  const hs: Array<{ y: number; xL: number; xR: number }> = [];
  for (const s of segments) {
    const dx = Math.abs(s.x2 - s.x1);
    const dy = Math.abs(s.y2 - s.y1);
    if (dx <= snap && dy >= minLine) {
      vs.push({ x: (s.x1 + s.x2) / 2, yTop: Math.min(s.y1, s.y2), yBot: Math.max(s.y1, s.y2) });
    } else if (dy <= snap && dx >= minLine) {
      hs.push({ y: (s.y1 + s.y2) / 2, xL: Math.min(s.x1, s.x2), xR: Math.max(s.x1, s.x2) });
    }
  }
  if (vs.length < 2 || hs.length < 2) return null;

  const colEdges = cluster1d(
    vs.map((v) => v.x),
    snap
  );
  const rowEdges = cluster1d(
    hs.map((h) => h.y),
    snap
  );
  if (colEdges.length < 2 || rowEdges.length < 2) return null;

  const nCols = colEdges.length - 1;
  const nRows = rowEdges.length - 1;
  const midX = (c: number) => (colEdges[c] + colEdges[c + 1]) / 2;
  const midY = (r: number) => (rowEdges[r] + rowEdges[r + 1]) / 2;

  // Is there a vertical rule at column boundary `e`, spanning row `r`'s band?
  const hasV = (r: number, e: number) =>
    vs.some((v) => Math.abs(v.x - colEdges[e]) <= snap && v.yTop <= midY(r) && v.yBot >= midY(r));
  // Is there a horizontal rule at row boundary `e`, spanning column `c`'s band?
  const hasH = (c: number, e: number) =>
    hs.some((h) => Math.abs(h.y - rowEdges[e]) <= snap && h.xL <= midX(c) && h.xR >= midX(c));

  const consumed = Array.from({ length: nRows }, () => new Array<boolean>(nCols).fill(false));
  const cells: GridCell[] = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if (consumed[r][c]) continue;
      // Grow right while the next interior vertical edge is absent.
      let colspan = 1;
      while (c + colspan < nCols && !hasV(r, c + colspan)) colspan++;
      // Grow down while no horizontal edge crosses any spanned column.
      let rowspan = 1;
      while (r + rowspan < nRows) {
        let blocked = false;
        for (let cc = c; cc < c + colspan; cc++) {
          if (hasH(cc, r + rowspan)) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
        rowspan++;
      }
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) consumed[r + dr][c + dc] = true;
      }
      cells.push({
        row: r,
        col: c,
        rowspan,
        colspan,
        xMm: colEdges[c],
        yMm: rowEdges[r],
        wMm: colEdges[c + colspan] - colEdges[c],
        hMm: rowEdges[r + rowspan] - rowEdges[r],
        text: '',
        bold: false,
      });
    }
  }

  // Drop each text run into the cell that contains its center.
  const boldCount = new Map<GridCell, number>();
  const totalCount = new Map<GridCell, number>();
  const ordered = blocks
    .filter((b) => b.text.trim() !== '')
    .sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);
  for (const b of ordered) {
    const cx = b.xMm + b.wMm / 2;
    const cy = b.yMm + b.hMm / 2;
    const cell = cells.find(
      (cl) =>
        cx >= cl.xMm - snap &&
        cx < cl.xMm + cl.wMm + snap &&
        cy >= cl.yMm - snap &&
        cy < cl.yMm + cl.hMm + snap
    );
    if (!cell) continue;
    cell.text = cell.text ? `${cell.text} ${b.text}` : b.text;
    totalCount.set(cell, (totalCount.get(cell) ?? 0) + 1);
    if (b.bold) boldCount.set(cell, (boldCount.get(cell) ?? 0) + 1);
  }
  for (const cell of cells) {
    cell.text = cell.text.replace(/\s+/g, ' ').trim();
    const t = totalCount.get(cell) ?? 0;
    const bd = boldCount.get(cell) ?? 0;
    cell.bold = t > 0 && bd * 2 >= t;
  }

  return {
    xMm: colEdges[0],
    yMm: rowEdges[0],
    wMm: colEdges[nCols] - colEdges[0],
    hMm: rowEdges[nRows] - rowEdges[0],
    nRows,
    nCols,
    colEdges,
    rowEdges,
    cells,
  };
}

// ─── pdf.js graphics walk (browser only) ──────────────────────────────────────

type Matrix = number[];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// pdf.js `Util.transform` — compose m1 ∘ m2.
function compose(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

interface OperatorList {
  fnArray: number[];
  argsArray: unknown[];
}
interface PdfGraphicsPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  getOperatorList(): Promise<OperatorList>;
}
type Ops = Record<string, number>;

/** Walk a page's operator list and collect axis-aligned rule segments (mm). */
async function collectRuleSegments(
  page: PdfGraphicsPage,
  OPS: Ops,
  pageHeightPt: number
): Promise<RuleSegment[]> {
  let opList: OperatorList;
  try {
    opList = await page.getOperatorList();
  } catch {
    return [];
  }

  const rules: RuleSegment[] = [];
  let ctm: Matrix = IDENTITY.slice();
  const stack: Matrix[] = [];

  const project = (x: number, y: number): { x: number; y: number } => {
    const X = ctm[0] * x + ctm[2] * y + ctm[4];
    const Y = ctm[1] * x + ctm[3] * y + ctm[5];
    return { x: ptToMm(X), y: ptToMm(pageHeightPt - Y) };
  };
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    const a = project(x1, y1);
    const b = project(x2, y2);
    rules.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    seg(x, y, x + w, y);
    seg(x + w, y, x + w, y + h);
    seg(x + w, y + h, x, y + h);
    seg(x, y + h, x, y);
  };

  // pdf.js v6 constructPath args = [paintOp, [pathBuffer], minMax]. The path is a
  // single Float32Array interleaving DrawOPS codes with coordinates (see the
  // worker's QueueOptimizer). DrawOPS: moveTo=0, lineTo=1, curveTo=2 (cubic, 6
  // coords), quadraticCurveTo=3 (4 coords), closePath=4.
  const parsePath = (args: unknown) => {
    const argList = args as unknown[];
    if (!Array.isArray(argList) || argList.length < 2) return;
    const wrap = argList[1];
    const buffer = Array.isArray(wrap) ? (wrap[0] as ArrayLike<number> | null) : null;
    if (!buffer || typeof buffer.length !== 'number') return;
    let k = 0;
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    while (k < buffer.length) {
      const drawOp = buffer[k++];
      if (drawOp === 0) {
        // moveTo
        cx = buffer[k++];
        cy = buffer[k++];
        sx = cx;
        sy = cy;
      } else if (drawOp === 1) {
        // lineTo
        const nx = buffer[k++];
        const ny = buffer[k++];
        seg(cx, cy, nx, ny);
        cx = nx;
        cy = ny;
      } else if (drawOp === 2) {
        // curveTo (cubic): 2 control points + end point
        k += 4;
        cx = buffer[k++];
        cy = buffer[k++];
      } else if (drawOp === 3) {
        // quadraticCurveTo: 1 control point + end point
        k += 2;
        cx = buffer[k++];
        cy = buffer[k++];
      } else if (drawOp === 4) {
        // closePath
        seg(cx, cy, sx, sy);
        cx = sx;
        cy = sy;
      } else {
        break; // unknown code — stop to avoid desync
      }
    }
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.save) {
      stack.push(ctm.slice());
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? IDENTITY.slice();
    } else if (fn === OPS.transform) {
      ctm = compose(ctm, args as Matrix);
    } else if (fn === OPS.constructPath) {
      parsePath(args);
    } else if (OPS.rectangle !== undefined && fn === OPS.rectangle) {
      const [x, y, w, h] = args as number[];
      rect(x, y, w, h);
    }
  }
  return rules;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

// Mirrors the loader in ./pdf-to-image so this module stays self-contained.
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

export interface PdfImportData {
  extraction: PdfTextExtraction;
  rules: RuleSegment[];
}

/**
 * Open a PDF once and read both its text layer and its ruling lines.
 * @param file    PDF file from a file input.
 * @param pageNum 1-based page index (default 1).
 */
export async function extractPdfImport(file: File, pageNum = 1): Promise<PdfImportData> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNum);
    const extraction = await buildExtractionFromPage(
      page as unknown as Parameters<typeof buildExtractionFromPage>[0]
    );
    const pageHeightPt = page.getViewport({ scale: 1 }).height;
    const OPS = (pdfjs as unknown as { OPS: Ops }).OPS;
    const rules = await collectRuleSegments(page as unknown as PdfGraphicsPage, OPS, pageHeightPt);
    return { extraction, rules };
  } finally {
    void loadingTask.destroy();
  }
}

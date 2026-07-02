import {
  type PdfTextExtraction,
  type RawTextItem,
  type TextBlock,
  type TextLine,
  clusterIntoLines,
  detectPaperSize,
  detectTables,
  isBoldFont,
  ptToMm,
  rawItemToBlock,
  segmentCells,
  serializeForPrompt,
} from '@/lib/utils/pdf-to-text-blocks';
import { describe, expect, it } from 'vitest';

/** Build a TextLine from `[text, xMm, wMm?]` fragments at a given yMm. */
function tline(yMm: number, frags: Array<[string, number, number?]>, bold = false): TextLine {
  const blocks: TextBlock[] = frags.map(([text, xMm, wMm]) => ({
    text,
    xMm,
    yMm,
    wMm: wMm ?? 10,
    hMm: 3.5,
    fontSizePt: 10,
    bold,
  }));
  const starts = blocks.map((b) => b.xMm);
  const rights = blocks.map((b) => b.xMm + b.wMm);
  return {
    text: frags.map((f) => f[0]).join(' '),
    xMm: Math.min(...starts),
    yMm,
    wMm: Math.max(...rights) - Math.min(...starts),
    hMm: 3.5,
    fontSizePt: 10,
    bold,
    blocks,
  };
}

/** Build a pdf.js-shaped text item at a baseline (xPt, yPt) with font size `sizePt`. */
function makeItem(
  str: string,
  xPt: number,
  yPt: number,
  sizePt: number,
  opts: { width?: number; fontName?: string } = {}
): RawTextItem {
  return {
    str,
    transform: [sizePt, 0, 0, sizePt, xPt, yPt],
    width: opts.width ?? str.length * sizePt * 0.5,
    height: sizePt,
    fontName: opts.fontName,
  };
}

describe('ptToMm', () => {
  it('converts 72pt (1in) to 25.4mm', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 5);
  });
});

describe('isBoldFont', () => {
  it('detects common bold name variants', () => {
    expect(isBoldFont('Sarabun-Bold')).toBe(true);
    expect(isBoldFont('Helvetica-Black')).toBe(true);
    expect(isBoldFont('NotoSans-SemiBold')).toBe(true);
  });

  it('is false for regular fonts and missing names', () => {
    expect(isBoldFont('Sarabun-Regular')).toBe(false);
    expect(isBoldFont(undefined)).toBe(false);
  });
});

describe('rawItemToBlock', () => {
  const PAGE_H = 842; // ~A4 height in pt

  it('flips the Y axis so a high baseline maps near the page top', () => {
    const block = rawItemToBlock(makeItem('Header', 72, 800, 12), PAGE_H);
    // top = 842 - (800 + 12) = 30pt
    expect(block.xMm).toBeCloseTo(ptToMm(72), 3);
    expect(block.yMm).toBeCloseTo(ptToMm(30), 3);
    expect(block.fontSizePt).toBe(12);
    expect(block.hMm).toBeCloseTo(ptToMm(12), 3);
  });

  it('places a low baseline near the page bottom', () => {
    const top = rawItemToBlock(makeItem('Top', 0, 800, 10), PAGE_H);
    const bottom = rawItemToBlock(makeItem('Bottom', 0, 40, 10), PAGE_H);
    expect(bottom.yMm).toBeGreaterThan(top.yMm);
  });

  it('carries bold through from the font name', () => {
    const block = rawItemToBlock(makeItem('T', 0, 0, 10, { fontName: 'Foo-Bold' }), PAGE_H);
    expect(block.bold).toBe(true);
  });
});

describe('detectPaperSize', () => {
  it('recognises A4 portrait', () => {
    expect(detectPaperSize(210, 297)).toEqual({ paperSize: 'A4', orientation: 'portrait' });
  });

  it('recognises A4 landscape from swapped dimensions', () => {
    expect(detectPaperSize(297, 210)).toEqual({ paperSize: 'A4', orientation: 'landscape' });
  });

  it('recognises US Letter', () => {
    expect(detectPaperSize(215.9, 279.4)).toEqual({ paperSize: 'Letter', orientation: 'portrait' });
  });

  it('snaps a slightly-off size to the nearest standard', () => {
    expect(detectPaperSize(209, 296).paperSize).toBe('A4');
  });
});

describe('clusterIntoLines', () => {
  const PAGE_H = 842;
  const block = (str: string, xPt: number, yPt: number, size = 10, fontName?: string) =>
    rawItemToBlock(makeItem(str, xPt, yPt, size, { fontName }), PAGE_H);

  it('merges fragments on the same baseline into one line', () => {
    const lines = clusterIntoLines([block('Hello', 72, 700), block('World', 200, 700)]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello World');
  });

  it('splits fragments on different baselines into separate lines', () => {
    const lines = clusterIntoLines([block('Line A', 72, 700), block('Line B', 72, 660)]);
    expect(lines).toHaveLength(2);
  });

  it('returns lines in top-to-bottom reading order', () => {
    // Feed bottom-first; higher yPt (700) is visually above lower yPt (600).
    const lines = clusterIntoLines([block('Lower', 72, 600), block('Upper', 72, 700)]);
    expect(lines.map((l) => l.text)).toEqual(['Upper', 'Lower']);
  });

  it('orders fragments left-to-right within a line regardless of input order', () => {
    const lines = clusterIntoLines([block('Right', 300, 700), block('Left', 72, 700)]);
    expect(lines[0].text).toBe('Left Right');
  });

  it('marks a line bold when the majority of its fragments are bold', () => {
    const lines = clusterIntoLines([
      block('TOTAL', 72, 700, 10, 'Sarabun-Bold'),
      block('999', 300, 700, 10, 'Sarabun-Bold'),
    ]);
    expect(lines[0].bold).toBe(true);
  });

  it('ignores whitespace-only fragments', () => {
    expect(clusterIntoLines([block('   ', 72, 700)])).toHaveLength(0);
  });
});

describe('serializeForPrompt', () => {
  const extraction: PdfTextExtraction = {
    pageWidthMm: 210,
    pageHeightMm: 297,
    paperSize: 'A4',
    orientation: 'portrait',
    hasTextLayer: true,
    lines: [
      {
        text: 'INVOICE',
        xMm: 20,
        yMm: 12,
        wMm: 40,
        hMm: 6,
        fontSizePt: 18,
        bold: true,
        blocks: [],
      },
      {
        text: 'Bill To',
        xMm: 20,
        yMm: 25,
        wMm: 30,
        hMm: 4,
        fontSizePt: 11,
        bold: false,
        blocks: [],
      },
    ],
  };

  it('includes page metadata and the line count', () => {
    const out = serializeForPrompt(extraction);
    expect(out).toContain('A4 portrait, 210×297mm');
    expect(out).toContain('2 lines in reading order');
  });

  it('renders each line with position, size, style and verbatim text', () => {
    const out = serializeForPrompt(extraction);
    expect(out).toContain('1. @(20,12) 40×6mm fs18 bold "INVOICE"');
    expect(out).toContain('2. @(20,25) 30×4mm fs11 "Bill To"');
  });

  it('handles an empty extraction', () => {
    const out = serializeForPrompt({ ...extraction, lines: [] });
    expect(out).toContain('0 lines in reading order');
  });
});

describe('segmentCells', () => {
  it('splits fragments separated by a wide gap into separate cells', () => {
    const line = tline(100, [
      ['Item', 20],
      ['Qty', 90],
      ['Price', 140],
    ]);
    const cells = segmentCells(line.blocks, 6);
    expect(cells.map((c) => c.text)).toEqual(['Item', 'Qty', 'Price']);
  });

  it('merges fragments within the gap threshold into one cell', () => {
    // Two fragments 2mm apart → same cell.
    const line = tline(100, [
      ['Hello', 20, 10],
      ['World', 32, 10],
    ]);
    const cells = segmentCells(line.blocks, 6);
    expect(cells).toHaveLength(1);
    expect(cells[0].text).toBe('Hello World');
  });
});

describe('detectTables', () => {
  it('recognises a 3-column, 3-row table', () => {
    const lines = [
      tline(
        100,
        [
          ['Item', 20],
          ['Qty', 90],
          ['Price', 140],
        ],
        true
      ),
      tline(105, [
        ['Apple', 20],
        ['2', 90],
        ['100', 140],
      ]),
      tline(110, [
        ['Banana', 20],
        ['5', 90],
        ['250', 140],
      ]),
    ];
    const { tables, textLines } = detectTables(lines);
    expect(tables).toHaveLength(1);
    expect(textLines).toHaveLength(0);
    expect(tables[0].columns).toHaveLength(3);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].hasHeader).toBe(true);
    expect(tables[0].rows[1].cells).toEqual(['Apple', '2', '100']);
  });

  it('leaves single-column lines as free text', () => {
    const lines = [
      tline(50, [['INVOICE', 20]]),
      tline(100, [
        ['Item', 20],
        ['Price', 140],
      ]),
      tline(105, [
        ['Apple', 20],
        ['100', 140],
      ]),
    ];
    const { tables, textLines } = detectTables(lines);
    expect(tables).toHaveLength(1);
    expect(textLines.map((l) => l.text)).toEqual(['INVOICE']);
  });

  it('splits vertically distant runs into separate tables', () => {
    const lines = [
      tline(100, [
        ['A', 20],
        ['1', 90],
      ]),
      tline(105, [
        ['B', 20],
        ['2', 90],
      ]),
      tline(200, [
        ['C', 20],
        ['3', 90],
      ]),
      tline(205, [
        ['D', 20],
        ['4', 90],
      ]),
    ];
    const { tables } = detectTables(lines);
    expect(tables).toHaveLength(2);
  });

  it('ignores a run shorter than minRows', () => {
    const lines = [
      tline(100, [
        ['Only', 20],
        ['One', 90],
      ]),
    ];
    const { tables, textLines } = detectTables(lines);
    expect(tables).toHaveLength(0);
    expect(textLines).toHaveLength(1);
  });
});

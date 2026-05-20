import { parseTypstUnit } from './units';

export interface TableWidthColumn {
  width: string;
}

type ParsedWidth = { type: 'fixed'; mm: number } | { type: 'fractional'; value: number };

const ABSOLUTE_UNIT_RE = /^-?[\d.]+(?:mm|pt|cm|in)$/;

function parseColumnWidth(width: string, totalMm: number): ParsedWidth {
  const value = width.trim();

  if (ABSOLUTE_UNIT_RE.test(value)) {
    return { type: 'fixed', mm: Math.max(0, parseTypstUnit(value)) };
  }

  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value);
    return {
      type: 'fixed',
      mm: Number.isFinite(percent) ? Math.max(0, (percent / 100) * totalMm) : 0,
    };
  }

  if (value === '*' || value === 'auto') {
    return { type: 'fractional', value: 1 };
  }

  if (value.endsWith('fr')) {
    const fraction = Number.parseFloat(value);
    return { type: 'fractional', value: Number.isFinite(fraction) ? Math.max(fraction, 0) : 1 };
  }

  const numeric = Number.parseFloat(value);
  return {
    type: 'fractional',
    value: Number.isFinite(numeric) ? Math.max(numeric, 0) : 1,
  };
}

/**
 * Resolves table column widths exactly like the designer should render them:
 * every column becomes a millimeter value and the final sum equals the component width.
 */
export function resolveTableColumnWidths(
  columns: readonly TableWidthColumn[],
  componentWidthMm: number
): number[] {
  if (columns.length === 0) return [];

  const totalMm = componentWidthMm > 0 ? componentWidthMm : 180;
  const parsed = columns.map((col) => parseColumnWidth(col.width, totalMm));
  const fixedSum = parsed.reduce((sum, col) => sum + (col.type === 'fixed' ? col.mm : 0), 0);
  const fractionSum = parsed.reduce(
    (sum, col) => sum + (col.type === 'fractional' ? col.value : 0),
    0
  );

  if (fixedSum > 0 && fractionSum === 0) {
    const scale = totalMm / fixedSum;
    return parsed.map((col) => (col.type === 'fixed' ? col.mm * scale : 0));
  }

  if (fixedSum >= totalMm) {
    const scale = totalMm / fixedSum;
    return parsed.map((col) => (col.type === 'fixed' ? col.mm * scale : 0));
  }

  const remaining = totalMm - fixedSum;
  return parsed.map((col) => {
    if (col.type === 'fixed') return col.mm;
    if (fractionSum <= 0) return remaining / columns.length;
    return (col.value / fractionSum) * remaining;
  });
}

export function resolveTableColumnPercentages(
  columns: readonly TableWidthColumn[],
  componentWidthMm: number
): string[] {
  const totalMm = componentWidthMm > 0 ? componentWidthMm : 180;
  return resolveTableColumnWidths(columns, totalMm).map((widthMm) => {
    const percent = (widthMm / totalMm) * 100;
    return `${percent}%`;
  });
}

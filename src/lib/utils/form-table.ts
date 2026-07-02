import type {
  FormTableComponent,
  FormTableFooterSummaryRow,
  TableCell,
  TableComponent,
  TableRow,
} from '@/types/schema';

export function buildFormTableFooterRows(comp: FormTableComponent): TableRow[] {
  return [
    ...(comp.footerRows ?? []),
    ...(comp.footerGridRows ?? []),
    ...buildFormTableSummaryRows(comp),
  ];
}

/** Rows synthesized from `footerSummary` — read-only in the canvas (edited via properties). */
export function buildFormTableSummaryRows(comp: FormTableComponent): TableRow[] {
  return summaryToFooterRows(comp.footerSummary ?? [], comp.columns.length);
}

export function buildFormTableFillerRows(comp: FormTableComponent): TableRow[] {
  if (comp.footerMode !== 'bottom' || !comp.bodyMinHeight) return [];

  return [
    {
      id: `${comp.id}-body-filler`,
      type: 'data',
      height: comp.bodyMinHeight,
      cells: comp.columns.map((col, idx) => ({
        id: `${comp.id}-body-filler-${idx}`,
        content: '',
        align: col.align ?? 'left',
        stroke: { top: 'none', bottom: 'none' },
      })),
    },
  ];
}

export function asRenderableFormTable(comp: FormTableComponent): TableComponent {
  return {
    ...comp,
    type: 'table',
    footerRows: buildFormTableFooterRows(comp),
  };
}

function summaryToFooterRows(rows: FormTableFooterSummaryRow[], colCount: number): TableRow[] {
  return rows.map((row) => ({
    id: row.id,
    type: 'footer',
    repeat: row.repeat ?? false,
    height: row.height,
    cells: buildSummaryCells(row, colCount),
  }));
}

function buildSummaryCells(row: FormTableFooterSummaryRow, colCount: number): TableCell[] {
  const valueCol = clampColumn(row.valueColumn ?? colCount - 1, colCount);
  const labelCol = clampColumn(row.labelColumn ?? 0, colCount);
  const labelSpan = Math.max(1, row.labelColspan ?? Math.max(1, valueCol - labelCol));
  const valueSpan = Math.max(1, row.valueColspan ?? colCount - valueCol);
  const cells: TableCell[] = [];
  let cursor = 0;

  const pushBlank = (span: number) => {
    if (span <= 0) return;
    cells.push({
      id: `${row.id}-blank-${cursor}`,
      content: '',
      colspan: span > 1 ? span : undefined,
      stroke: row.blankStroke,
    });
    cursor += span;
  };

  pushBlank(labelCol);

  cells.push({
    id: `${row.id}-label`,
    content: row.label,
    colspan: labelSpan > 1 ? labelSpan : undefined,
    align: row.align ?? 'right',
    style: row.labelStyle ?? row.style,
    stroke: row.labelStroke,
  });
  cursor += labelSpan;

  pushBlank(valueCol - cursor);

  cells.push({
    id: `${row.id}-value`,
    content: row.value,
    colspan: valueSpan > 1 ? valueSpan : undefined,
    align: row.valueAlign ?? 'right',
    format: row.format,
    style: row.style,
    stroke: row.valueStroke,
  });
  cursor += valueSpan;

  pushBlank(colCount - cursor);

  return cells;
}

function clampColumn(value: number, colCount: number): number {
  return Math.min(Math.max(0, value), Math.max(0, colCount - 1));
}

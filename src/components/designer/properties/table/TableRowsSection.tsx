import { ColorPicker } from '@/components/shared/ColorPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDesignerStore } from '@/store/designer-store';
import type { AnyTableComponent, TableCell, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, Italic, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { PANEL_SELECT_TRIGGER } from '../Shared';
import {
  AddRowButton,
  AlignToggleGroup,
  MiniInput,
  SettingToggle,
  TABLE_FIELD_STACK,
} from './TableShared';

interface Props {
  component: AnyTableComponent;
  type: 'header' | 'detail' | 'footer';
}

export const TableRowsSection = ({ component, type }: Props) => {
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);
  const updateComponent = useDesignerStore((state) => state.updateComponent);

  const rows =
    type === 'header'
      ? component.headerRows
      : type === 'detail'
        ? component.detailRows
        : component.footerRows;
  const rowKey = type === 'header' ? 'headerRows' : type === 'detail' ? 'detailRows' : 'footerRows';

  const updateRows = (newRows: TableRow[]) => {
    updateComponent(component.id, { [rowKey]: newRows } as any);
  };

  const updateCell = (
    rowIdx: number,
    cellIdx: number,
    updater: Partial<TableCell> | ((cell: TableCell) => TableCell)
  ) => {
    const currentRows = rows || [];
    const row = currentRows[rowIdx];
    const cell = row?.cells[cellIdx];
    if (!row || !cell) return;

    const nextCell = typeof updater === 'function' ? updater(cell) : { ...cell, ...updater };
    const nextCells = row.cells.map((c, idx) => (idx === cellIdx ? nextCell : c));
    const nextRows = currentRows.map((r, idx) => (idx === rowIdx ? { ...r, cells: nextCells } : r));
    updateRows(nextRows);
  };

  const getDefaultCellContent = (colIdx: number) => {
    const column = component.columns[colIdx];
    if (!column) return '';
    if (type === 'header') return column.header || '';
    if (type === 'detail') return column.field ? `{{${column.field}}}` : '';
    return '';
  };

  const addRow = () => {
    const newRow: TableRow = {
      id: crypto.randomUUID(),
      type: type === 'detail' ? 'data' : (type as 'header' | 'footer'),
      cells: Array(component.columns.length)
        .fill(null)
        .map((_, colIdx) => ({
          id: crypto.randomUUID(),
          content: getDefaultCellContent(colIdx),
          align: component.columns[colIdx]?.align || 'left',
        })),
    };
    const currentRows = rows || [];
    updateRows([...currentRows, newRow]);
    setExpandedRowIndex(currentRows.length);
  };

  if (!rows || rows.length === 0) {
    return (
      <div className={TABLE_FIELD_STACK}>
        <p className="text-[8px] text-[var(--text-muted)]">No custom rows.</p>
        <AddRowButton label="Add row" onClick={addRow} />
      </div>
    );
  }

  const isRepeatEnabled = rows[0]?.repeat !== false;

  return (
    <div className="space-y-1 min-w-0">
      {type === 'footer' && (
        <SettingToggle
          label="Repeat on every page"
          value={isRepeatEnabled}
          onChange={() => {
            updateRows(rows.map((r) => ({ ...r, repeat: !isRepeatEnabled })));
          }}
        />
      )}
      {rows.map((row, rIdx) => {
        const isActiveRow = expandedRowIndex === rIdx;
        return (
          <div
            key={row.id}
            className="border border-[var(--border-default)] rounded-[3px] overflow-hidden"
          >
            <div
              className={clsx(
                'flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-white/[0.03] transition-colors',
                isActiveRow && 'bg-white/[0.02] border-b border-[var(--border-default)]'
              )}
              onClick={() => setExpandedRowIndex(isActiveRow ? null : rIdx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedRowIndex(isActiveRow ? null : rIdx);
                }
              }}
            >
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase">
                  Row {rIdx + 1}
                </span>
                <div className="flex-1 flex gap-0.5 overflow-hidden">
                  {row.cells.map((cell) => (
                    <div
                      key={cell.id}
                      className="h-3 flex-1 bg-white/[0.04] rounded-sm border border-white/5 text-[6px] flex items-center justify-center truncate px-0.5 text-[var(--text-muted)]"
                    >
                      {cell.content || '-'}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newRows = rows.filter((_, i) => i !== rIdx);
                    updateRows(newRows);
                  }}
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                {isActiveRow ? (
                  <ChevronDown className="w-3 h-3 text-[var(--accent)]" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
                )}
              </div>
            </div>

            {isActiveRow && (
              <div className="px-2 py-1.5 space-y-2 border-t border-[var(--border-default)]/60">
                {row.cells.map((cell, cIdx) => (
                  <div
                    key={cell.id}
                    className="py-1.5 space-y-1.5 border-b border-[var(--border-default)]/40 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-[var(--accent)]">
                          Cell {cIdx + 1}
                        </span>
                        <span className="text-[8px] text-[var(--text-muted)] truncate max-w-[120px]">
                          Col: {component.columns[cIdx]?.header || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Content / Binding
                          </span>
                          <MiniInput
                            value={cell.content || ''}
                            onChange={(v) => updateCell(rIdx, cIdx, { content: v })}
                            placeholder="e.g. Total or {{sum(items, 'val')}}"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Data Format
                          </span>
                          <Select
                            value={cell.format || 'text'}
                            onValueChange={(val) => updateCell(rIdx, cIdx, { format: val as any })}
                          >
                            <SelectTrigger className={PANEL_SELECT_TRIGGER}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="currency-thb">Currency (฿)</SelectItem>
                              <SelectItem value="currency-usd">Currency ($)</SelectItem>
                              <SelectItem value="date-th">Date (TH)</SelectItem>
                              <SelectItem value="date-en">Date (EN)</SelectItem>
                              <SelectItem value="percent">Percent (%)</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Font Weight
                          </span>
                          <FontWeightSelect
                            value={cell.style?.fontWeight}
                            onChange={(v) =>
                              updateCell(rIdx, cIdx, (currentCell) => ({
                                ...currentCell,
                                style: {
                                  ...currentCell.style,
                                  fontWeight: v as any,
                                },
                              }))
                            }
                            className="w-full h-7 text-[10px] px-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-white outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Colspan
                          </span>
                          <MiniInput
                            type="number"
                            value={String(cell.colspan || 1)}
                            onChange={(v) =>
                              updateCell(rIdx, cIdx, { colspan: Number.parseInt(v) || 1 })
                            }
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Rowspan
                          </span>
                          <MiniInput
                            type="number"
                            value={String(cell.rowspan || 1)}
                            onChange={(v) =>
                              updateCell(rIdx, cIdx, { rowspan: Number.parseInt(v) || 1 })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Font Size
                          </span>
                          <MiniInput
                            type="number"
                            value={String(cell.style?.fontSize || 10)}
                            onChange={(v) =>
                              updateCell(rIdx, cIdx, (currentCell) => ({
                                ...currentCell,
                                style: {
                                  ...currentCell.style,
                                  fontSize: Number.parseFloat(v) || 10,
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Line Height
                          </span>
                          <MiniInput
                            type="number"
                            step="0.1"
                            value={String(cell.style?.lineHeight || 1.4)}
                            onChange={(v) =>
                              updateCell(rIdx, cIdx, (currentCell) => ({
                                ...currentCell,
                                style: {
                                  ...currentCell.style,
                                  lineHeight: Number.parseFloat(v) || 1.4,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Text Color
                          </span>
                          <ColorPicker
                            color={cell.style?.color || '#000000'}
                            onChange={(c) =>
                              updateCell(rIdx, cIdx, (currentCell) => ({
                                ...currentCell,
                                style: { ...currentCell.style, color: c },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Background
                          </span>
                          <ColorPicker
                            color={cell.fill || 'transparent'}
                            onChange={(c) => updateCell(rIdx, cIdx, { fill: c })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          title="Italic"
                          onClick={() =>
                            updateCell(rIdx, cIdx, (currentCell) => ({
                              ...currentCell,
                              style: {
                                ...currentCell.style,
                                italic: !currentCell.style?.italic,
                              },
                            }))
                          }
                          className={clsx(
                            'h-5 w-7 flex items-center justify-center rounded-[3px] border transition-all',
                            cell.style?.italic
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)]'
                          )}
                        >
                          <Italic className="w-2.5 h-2.5" />
                        </button>
                        <AlignToggleGroup
                          value={cell.align || 'left'}
                          onChange={(align) => updateCell(rIdx, cIdx, { align })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <AddRowButton label="Add row" onClick={addRow} />
    </div>
  );
};

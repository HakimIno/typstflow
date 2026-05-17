import { ColorPicker } from '@/components/shared/ColorPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useDesignerStore } from '@/store/designer-store';
import type { TableComponent, TableRow } from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronRight,
  Italic,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { FontWeightSelect } from '../../ui/FontWeightSelect';
import { MiniInput } from './TableShared';

interface Props {
  component: TableComponent;
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

  const addRow = () => {
    const newRow: TableRow = {
      id: crypto.randomUUID(),
      type: type === 'detail' ? 'data' : (type as 'header' | 'footer'),
      cells: Array(component.columns.length)
        .fill(null)
        .map(() => ({
          id: crypto.randomUUID(),
          content: '',
        })),
    };
    const currentRows = rows || [];
    updateRows([...currentRows, newRow]);
    setExpandedRowIndex(currentRows.length);
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="p-4 text-center space-y-3">
        <p className="text-[10px] text-[var(--text-muted)]">No custom {type} rows defined.</p>
        <button
          type="button"
          onClick={addRow}
          className="px-4 py-1.5 bg-[var(--accent)] text-white text-[10px] font-bold rounded shadow-sm hover:bg-[var(--accent)]/90 transition-all"
        >
          Initialize {type} Rows
        </button>
      </div>
    );
  }

  const isRepeatEnabled = rows[0]?.repeat !== false;

  return (
    <div className="p-0 space-y-1 bg-[var(--bg-widget)]">
      {type === 'footer' && rows.length > 0 && (
        <div className="flex items-center justify-between p-2 mb-2 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
          <span className="text-[10px] font-medium text-[var(--text-primary)]">
            Repeat on every page
          </span>
          <button
            onClick={() => {
              const newRows = rows.map((r) => ({ ...r, repeat: !isRepeatEnabled }));
              updateRows(newRows);
            }}
            className={clsx(
              'w-7 h-4 rounded-full transition-colors relative',
              isRepeatEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)]'
            )}
          >
            <div
              className={clsx(
                'w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform',
                isRepeatEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
      )}
      {rows.map((row, rIdx) => {
        const isActiveRow = expandedRowIndex === rIdx;
        return (
          <div
            key={row.id}
            className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded overflow-hidden"
          >
            <div
              className={clsx(
                'flex items-center gap-2 p-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors',
                isActiveRow && 'bg-white/[0.03] border-b border-[var(--border-default)]'
              )}
              onClick={() => setExpandedRowIndex(isActiveRow ? null : rIdx)}
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
              <div className="p-2 space-y-4 bg-black/10">
                {row.cells.map((cell, cIdx) => (
                  <div
                    key={cell.id}
                    className="p-2 rounded border border-white/5 bg-white/[0.02] space-y-2"
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
                            onChange={(v) => {
                              const newRows = [...rows];
                              newRows[rIdx].cells[cIdx].content = v;
                              updateRows(newRows);
                            }}
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
                            onValueChange={(val) => {
                              const newRows = [...rows];
                              newRows[rIdx].cells[cIdx].format = val as any;
                              updateRows(newRows);
                            }}
                          >
                            <SelectTrigger className="w-full h-7 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
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
                            onChange={(v) => {
                              const newRows = [...rows];
                              const current = newRows[rIdx].cells[cIdx].style || {};
                              newRows[rIdx].cells[cIdx].style = {
                                ...current,
                                fontWeight: v as any,
                              };
                              updateRows(newRows);
                            }}
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
                            onChange={(v) => {
                              const newRows = [...rows];
                              newRows[rIdx].cells[cIdx].colspan = Number.parseInt(v) || 1;
                              updateRows(newRows);
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Rowspan
                          </span>
                          <MiniInput
                            type="number"
                            value={String(cell.rowspan || 1)}
                            onChange={(v) => {
                              const newRows = [...rows];
                              newRows[rIdx].cells[cIdx].rowspan = Number.parseInt(v) || 1;
                              updateRows(newRows);
                            }}
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
                            onChange={(v) => {
                              const newRows = [...rows];
                              const current = newRows[rIdx].cells[cIdx].style || {};
                              newRows[rIdx].cells[cIdx].style = {
                                ...current,
                                fontSize: Number.parseFloat(v) || 10,
                              };
                              updateRows(newRows);
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Line Height
                          </span>
                          <MiniInput
                            type="number"
                            step="0.1"
                            value={String(cell.style?.lineHeight || 1.2)}
                            onChange={(v) => {
                              const newRows = [...rows];
                              const current = newRows[rIdx].cells[cIdx].style || {};
                              newRows[rIdx].cells[cIdx].style = {
                                ...current,
                                lineHeight: Number.parseFloat(v) || 1.2,
                              };
                              updateRows(newRows);
                            }}
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
                            onChange={(c) => {
                              const newRows = [...rows];
                              const current = newRows[rIdx].cells[cIdx].style || {};
                              newRows[rIdx].cells[cIdx].style = { ...current, color: c };
                              updateRows(newRows);
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-[7px] uppercase text-[var(--text-muted)] mb-0.5 block">
                            Background
                          </span>
                          <ColorPicker
                            color={cell.fill || 'transparent'}
                            onChange={(c) => {
                              const newRows = [...rows];
                              newRows[rIdx].cells[cIdx].fill = c;
                              updateRows(newRows);
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const newRows = [...rows];
                              const current = newRows[rIdx].cells[cIdx].style || {};
                              newRows[rIdx].cells[cIdx].style = {
                                ...current,
                                italic: !current.italic,
                              };
                              updateRows(newRows);
                            }}
                            className={clsx(
                              'p-1.5 rounded border transition-all',
                              cell.style?.italic
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-white/5 border-white/10 text-[var(--text-muted)] hover:bg-white/10'
                            )}
                          >
                            <Italic className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded border border-white/10">
                          {(
                            [
                              { id: 'left', icon: AlignLeft },
                              { id: 'center', icon: AlignCenter },
                              { id: 'right', icon: AlignRight },
                            ] as const
                          ).map((a) => (
                            <button
                              key={a.id}
                              onClick={() => {
                                const newRows = [...rows];
                                newRows[rIdx].cells[cIdx].align = a.id;
                                updateRows(newRows);
                              }}
                              className={clsx(
                                'p-1 rounded transition-all',
                                (cell.align || 'left') === a.id
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'text-[var(--text-muted)] hover:bg-white/10'
                              )}
                            >
                              <a.icon className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRow}
        className="w-full mt-2 flex items-center justify-center gap-1.5 p-1.5 bg-white/[0.02] border border-dashed border-[var(--border-default)] text-[var(--text-muted)] text-[9px] font-bold rounded hover:bg-white/[0.04] transition-all"
      >
        <Plus className="w-3 h-3" />
        Add Row
      </button>
    </div>
  );
};

'use client';

import { useDesignerStore } from '@/store/designer-store';
import type {
  FillPattern,
  HLineConfig,
  TableComponent,
  TableRow,
  VLineConfig,
} from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ChevronRight,
  Columns3,
  Database,
  Grid3X3,
  Minus,
  Paintbrush,
  Plus,
  Rows3,
  Trash2,
  BoxSelect,
  Merge,
  Split,
  Wand2,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

type TableTab = 'columns' | 'rows' | 'style' | 'lines' | 'data' | 'cell';

const TAB_CONFIG: { id: TableTab; label: string; icon: React.ElementType }[] = [
  { id: 'columns', label: 'Col', icon: Columns3 },
  { id: 'rows', label: 'Row', icon: Rows3 },
  { id: 'style', label: 'Style', icon: Paintbrush },
  { id: 'lines', label: 'Lines', icon: Grid3X3 },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'cell', label: 'Cell', icon: BoxSelect },
];

const FILL_PATTERNS: { id: FillPattern; label: string; preview: string }[] = [
  { id: 'none', label: 'No Fill', preview: '⬜⬜⬜' },
  { id: 'header-only', label: 'Header Only', preview: '🟦⬜⬜' },
  { id: 'striped-rows', label: 'Striped Rows', preview: '🟦⬜🟦' },
  { id: 'striped-cols', label: 'Striped Cols', preview: '🟦⬜🟦' },
  { id: 'checkerboard', label: 'Checkerboard', preview: '🟦⬜🟦' },
];

interface Props {
  component: TableComponent;
}

// Shared UI primitives
const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
    <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 border-r border-slate-100 flex items-center shrink-0">
      {label}
    </div>
    <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">{children}</div>
  </div>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 py-1.5 bg-slate-200 border-b border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
    {label}
  </div>
);

const MiniInput = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  mono = false,
  ...rest
}: {
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  [key: string]: any;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onClick={(e) => e.stopPropagation()}
    className={clsx(
      'text-[10px] bg-white border border-slate-200 rounded px-1.5 h-5 focus:border-blue-300 outline-none',
      mono && 'font-mono',
      className
    )}
    placeholder={placeholder}
    {...rest}
  />
);

export function TablePropertiesPanel({ component }: Props) {
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const selectedCell = useDesignerStore((state) => state.selectedCell);
  const setSelectedCell = useDesignerStore((state) => state.setSelectedCell);
  const [activeTab, setActiveTab] = useState<TableTab>('columns');
  const [expandedColIndex, setExpandedColIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedCell && selectedCell.tableId === component.id) {
      setActiveTab('cell');
    }
  }, [selectedCell, component.id]);

  const handleStyleUpdate = (updates: Record<string, any>) => {
    const currentStyle = component.style || {};
    updateComponent(component.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  const updateColumn = (idx: number, updates: Record<string, any>) => {
    const newCols = [...component.columns];
    newCols[idx] = { ...newCols[idx], ...updates };
    updateComponent(component.id, { columns: newCols } as any);
  };

  // ---- TAB 1: COLUMNS ----
  const renderColumnsTab = () => (
    <div className="p-2 space-y-1 bg-slate-50/50">
      {component.columns.map((col, idx) => (
        <div key={col.id} className="flex flex-col bg-white border border-slate-200 rounded shadow-sm group/col overflow-hidden">
          {/* Compact row */}
          <div
            className={clsx(
              'flex items-center gap-2 p-1.5 cursor-pointer transition-colors',
              expandedColIndex === idx ? 'bg-blue-50' : 'hover:bg-slate-50'
            )}
            onClick={() => setExpandedColIndex(expandedColIndex === idx ? null : idx)}
          >
            <span className="w-4 h-4 flex items-center justify-center bg-slate-200 text-[8px] font-bold text-slate-500 rounded-full shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[10px] font-bold text-slate-700 truncate">{col.header || 'Untitled'}</span>
              <span className="text-[8px] text-slate-400 font-mono truncate">{col.field ? `{${col.field}}` : 'unbound'}</span>
            </div>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
              {col.width}
            </span>
            {((col.colspan && col.colspan > 1) || (col.rowspan && col.rowspan > 1)) && (
              <div className="flex gap-0.5">
                {col.colspan && col.colspan > 1 ? <span className="text-[8px] bg-purple-100 text-purple-600 px-1 py-0.5 rounded font-bold">C{col.colspan}</span> : null}
                {col.rowspan && col.rowspan > 1 ? <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">R{col.rowspan}</span> : null}
              </div>
            )}
            {expandedColIndex === idx ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
            <button
              className="p-1 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded opacity-0 group-hover/col:opacity-100 transition-all shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                const newCols = component.columns.filter((_, i) => i !== idx);
                updateComponent(component.id, { columns: newCols } as any);
              }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Expanded */}
          {expandedColIndex === idx && (
            <div className="p-2 bg-slate-50 border-t border-slate-200 space-y-2">
              {/* Header & Field */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Header</span>
                  <MiniInput value={col.header || ''} onChange={(v) => updateColumn(idx, { header: v })} placeholder="Column Header" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Field Binding</span>
                  <MiniInput value={col.field || ''} onChange={(v) => updateColumn(idx, { field: v })} placeholder="e.g. qty" mono />
                </div>
              </div>
              {/* Width, Colspan, Rowspan, Align */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-0.5 min-w-[60px]">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Width</span>
                  <MiniInput value={col.width} onChange={(v) => updateColumn(idx, { width: v })} className="w-full" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Colspan</span>
                  <MiniInput
                    type="number"
                    value={col.colspan || 1}
                    onChange={(v) => updateColumn(idx, { colspan: Math.max(1, parseInt(v) || 1) })}
                    className="w-10 text-center"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Rowspan</span>
                  <MiniInput
                    type="number"
                    value={col.rowspan || 1}
                    onChange={(v) => updateColumn(idx, { rowspan: Math.max(1, parseInt(v) || 1) })}
                    className="w-10 text-center"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Align</span>
                  <div className="flex border border-slate-200 rounded overflow-hidden">
                    {[
                      { id: 'left', Icon: AlignLeft },
                      { id: 'center', Icon: AlignCenter },
                      { id: 'right', Icon: AlignRight },
                    ].map(({ id, Icon }) => (
                      <button
                        key={id}
                        onClick={(e) => { e.stopPropagation(); updateColumn(idx, { align: id }); }}
                        className={clsx(
                          'p-0.5 transition-all',
                          (col.align || 'left') === id ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-slate-600'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Per-column cell style overrides */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Cell BG</span>
                  <input
                    type="color"
                    value={col.background || '#ffffff'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateColumn(idx, { background: e.target.value })}
                    className="w-full h-5 rounded-sm cursor-pointer border border-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Border</span>
                  <MiniInput
                    value={col.borderWidth || ''}
                    onChange={(v) => updateColumn(idx, { borderWidth: v })}
                    placeholder="0.5pt"
                    mono
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        className="w-full py-1.5 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all mt-2 flex items-center justify-center gap-1"
        onClick={() => {
          const newCols = [...component.columns, {
            id: Math.random().toString(36).substring(7),
            header: 'New Column',
            field: '',
            width: '1fr',
          }];
          updateComponent(component.id, { columns: newCols } as any);
        }}
      >
        <Plus className="w-3 h-3" /> Add Column
      </button>
    </div>
  );

  // ---- TAB 2: ROWS ----
  const renderRowsTab = () => {
    const headerRows = component.headerRows || [];
    const footerRows = component.footerRows || [];

    const addHeaderRow = () => {
      const newRow: TableRow = {
        id: `hr-${Math.random().toString(36).substring(7)}`,
        type: 'header',
        cells: component.columns.map((col) => ({
          id: `hc-${Math.random().toString(36).substring(7)}`,
          content: col.header || '',
        })),
        repeat: true,
      };
      updateComponent(component.id, { headerRows: [...headerRows, newRow] } as any);
    };

    const addFooterRow = () => {
      const newRow: TableRow = {
        id: `fr-${Math.random().toString(36).substring(7)}`,
        type: 'footer',
        cells: component.columns.map(() => ({
          id: `fc-${Math.random().toString(36).substring(7)}`,
          content: '',
        })),
        repeat: true,
      };
      updateComponent(component.id, { footerRows: [...footerRows, newRow] } as any);
    };

    const removeRow = (type: 'header' | 'footer', rowId: string) => {
      if (type === 'header') {
        updateComponent(component.id, { headerRows: headerRows.filter((r) => r.id !== rowId) } as any);
      } else {
        updateComponent(component.id, { footerRows: footerRows.filter((r) => r.id !== rowId) } as any);
      }
    };

    const updateRowCell = (type: 'header' | 'footer', rowId: string, cellIdx: number, content: string) => {
      const rows = type === 'header' ? [...headerRows] : [...footerRows];
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;
      const newCells = [...rows[rowIndex].cells];
      newCells[cellIdx] = { ...newCells[cellIdx], content };
      rows[rowIndex] = { ...rows[rowIndex], cells: newCells };
      updateComponent(component.id, { [type === 'header' ? 'headerRows' : 'footerRows']: rows } as any);
    };

    return (
      <div className="space-y-0">
        {/* Header Rows */}
        <SectionHeader label="Header Rows" />
        <div className="p-2 space-y-1 bg-slate-50/50">
          <PropertyRow label="Repeat Header">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={component.repeatHeaderOnPage ?? false}
                onChange={(e) => updateComponent(component.id, { repeatHeaderOnPage: e.target.checked } as any)}
                className="w-3 h-3 rounded border-slate-300"
              />
              <span className="text-[10px] text-slate-600">On every page</span>
            </label>
          </PropertyRow>
          {headerRows.map((row, rowIdx) => (
            <div key={row.id} className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-blue-600 uppercase">Header Row {rowIdx + 1}</span>
                <button onClick={() => removeRow('header', row.id)} className="p-0.5 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.cells.length}, 1fr)` }}>
                {row.cells.map((cell, cellIdx) => (
                  <MiniInput
                    key={cell.id}
                    value={cell.content}
                    onChange={(v) => updateRowCell('header', row.id, cellIdx, v)}
                    placeholder={component.columns[cellIdx]?.header || `Col ${cellIdx + 1}`}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          ))}
          <button
            className="w-full py-1 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
            onClick={addHeaderRow}
          >
            <Plus className="w-3 h-3" /> Add Header Row
          </button>
        </div>

        {/* Footer Rows */}
        <SectionHeader label="Footer Rows" />
        <div className="p-2 space-y-1 bg-slate-50/50">
          {footerRows.map((row, rowIdx) => (
            <div key={row.id} className="bg-white border border-slate-200 rounded p-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-green-600 uppercase">Footer Row {rowIdx + 1}</span>
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.repeat ?? true}
                      onChange={(e) => {
                        const rows = [...footerRows];
                        rows[rowIdx] = { ...rows[rowIdx], repeat: e.target.checked };
                        updateComponent(component.id, { footerRows: rows } as any);
                      }}
                      className="w-3 h-3 rounded border-slate-300"
                    />
                    <span className="text-[8px] text-slate-500">Repeat</span>
                  </label>
                  <button onClick={() => removeRow('footer', row.id)} className="p-0.5 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${row.cells.length}, 1fr)` }}>
                {row.cells.map((cell, cellIdx) => (
                  <MiniInput
                    key={cell.id}
                    value={cell.content}
                    onChange={(v) => updateRowCell('footer', row.id, cellIdx, v)}
                    placeholder={`Footer ${cellIdx + 1}`}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button
              className="flex-1 py-1.5 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-green-400 hover:text-green-500 rounded transition-all flex items-center justify-center gap-1"
              onClick={addFooterRow}
            >
              <Plus className="w-3 h-3" /> Add Standard Row
            </button>
            <button
              className="flex-1 py-1.5 border border-purple-200 text-[9px] font-bold uppercase text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-all flex items-center justify-center gap-1 shadow-sm"
              onClick={() => {
                const colCount = component.columns.length;
                const cells = [];
                if (colCount > 1) {
                  cells.push({
                    id: `fc-${Math.random().toString(36).substring(7)}`,
                    content: 'Total Value:',
                    colspan: colCount - 1,
                    align: 'right',
                    fill: '#c084fc', // professional purple
                  });
                  cells.push({
                    id: `fc-${Math.random().toString(36).substring(7)}`,
                    content: '0.00',
                    colspan: 1,
                    align: 'right',
                    fill: '#c084fc',
                  });
                } else {
                  cells.push({
                    id: `fc-${Math.random().toString(36).substring(7)}`,
                    content: 'Total',
                    colspan: 1,
                    align: 'center',
                    fill: '#c084fc',
                  });
                }
                const newRow = {
                  id: `fr-${Math.random().toString(36).substring(7)}`,
                  type: 'footer',
                  cells,
                  repeat: true,
                };
                updateComponent(component.id, { footerRows: [...footerRows, newRow] } as any);
              }}
            >
              <Wand2 className="w-3 h-3" /> Smart Summary
            </button>
          </div>
        </div>

        {/* Row Heights */}
        <SectionHeader label="Row Settings" />
        <PropertyRow label="Row Heights">
          <MiniInput
            value={(component.style?.rowHeights || []).join(', ')}
            onChange={(v) => handleStyleUpdate({ rowHeights: v.split(',').map((s) => s.trim()).filter(Boolean) })}
            placeholder="auto, 30pt, auto..."
            mono
            className="w-full"
          />
        </PropertyRow>
      </div>
    );
  };

  // ---- TAB 3: STYLE ----
  const renderStyleTab = () => (
    <div className="space-y-0">
      {/* Fill Pattern */}
      <SectionHeader label="Fill Pattern" />
      <div className="p-2">
        <div className="grid grid-cols-3 gap-1">
          {FILL_PATTERNS.map((pattern) => (
            <button
              key={pattern.id}
              onClick={() => handleStyleUpdate({ fillPattern: pattern.id })}
              className={clsx(
                'flex flex-col items-center p-1.5 rounded border transition-all text-[8px]',
                (component.style?.fillPattern || 'header-only') === pattern.id
                  ? 'border-blue-400 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              )}
            >
              <span className="text-sm leading-none mb-0.5">{pattern.preview}</span>
              {pattern.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fill Colors */}
      <SectionHeader label="Fill Colors" />
      <PropertyRow label="Header BG">
        <input
          type="color"
          value={component.style?.headerBackground || '#e2e8f0'}
          onChange={(e) => handleStyleUpdate({ headerBackground: e.target.value })}
          className="w-full h-6 rounded-sm cursor-pointer"
        />
      </PropertyRow>
      <PropertyRow label="Stripe Color 1">
        <input
          type="color"
          value={component.style?.stripedColor1 || '#f8fafc'}
          onChange={(e) => handleStyleUpdate({ stripedColor1: e.target.value })}
          className="w-full h-6 rounded-sm cursor-pointer"
        />
      </PropertyRow>
      <PropertyRow label="Stripe Color 2">
        <input
          type="color"
          value={component.style?.stripedColor2 || '#ffffff'}
          onChange={(e) => handleStyleUpdate({ stripedColor2: e.target.value })}
          className="w-full h-6 rounded-sm cursor-pointer"
        />
      </PropertyRow>

      {/* Typography */}
      <SectionHeader label="Typography" />
      <PropertyRow label="Font Size">
        <MiniInput
          type="number"
          value={component.style?.fontSize || 10}
          onChange={(v) => handleStyleUpdate({ fontSize: parseInt(v) || 10 })}
          className="w-full"
        />
      </PropertyRow>
      <PropertyRow label="Weight">
        <select
          value={component.style?.fontWeight || 'regular'}
          onChange={(e) => handleStyleUpdate({ fontWeight: e.target.value })}
          className="pro-input h-6 px-1 w-full bg-white text-[11px]"
        >
          <option value="regular">Regular</option>
          <option value="medium">Medium</option>
          <option value="bold">Bold</option>
        </select>
      </PropertyRow>
      <PropertyRow label="Line Height">
        <MiniInput
          type="number"
          value={component.style?.lineHeight || 1.2}
          onChange={(v) => handleStyleUpdate({ lineHeight: parseFloat(v) || 1.2 })}
          className="w-full"
          step="0.1"
        />
      </PropertyRow>

      {/* Spacing */}
      <SectionHeader label="Spacing" />
      <PropertyRow label="Cell Inset">
        <MiniInput
          value={component.style?.inset || '7pt'}
          onChange={(v) => handleStyleUpdate({ inset: v })}
          placeholder="7pt"
          mono
          className="w-full"
        />
      </PropertyRow>
      <PropertyRow label="Col Gutter">
        <MiniInput
          value={component.style?.columnGutter || ''}
          onChange={(v) => handleStyleUpdate({ columnGutter: v })}
          placeholder="0pt"
          mono
          className="w-full"
        />
      </PropertyRow>
      <PropertyRow label="Row Gutter">
        <MiniInput
          value={component.style?.rowGutter || ''}
          onChange={(v) => handleStyleUpdate({ rowGutter: v })}
          placeholder="0pt"
          mono
          className="w-full"
        />
      </PropertyRow>
    </div>
  );

  // ---- TAB 4: LINES / BORDERS ----
  const renderLinesTab = () => {
    const hlines = component.hlines || [];
    const vlines = component.vlines || [];

    const addHLine = () => {
      const newLine: HLineConfig = {
        id: `hl-${Math.random().toString(36).substring(7)}`,
        y: 1,
        stroke: '1pt + black',
      };
      updateComponent(component.id, { hlines: [...hlines, newLine] } as any);
    };

    const addVLine = () => {
      const newLine: VLineConfig = {
        id: `vl-${Math.random().toString(36).substring(7)}`,
        x: 1,
        stroke: '1pt + black',
      };
      updateComponent(component.id, { vlines: [...vlines, newLine] } as any);
    };

    return (
      <div className="space-y-0">
        {/* Global Stroke */}
        <SectionHeader label="Global Border" />
        <PropertyRow label="Stroke">
          <MiniInput
            value={component.style?.borderWidth || '0.5pt'}
            onChange={(v) => handleStyleUpdate({ borderWidth: v })}
            placeholder="0.5pt"
            mono
            className="w-16 mr-1"
          />
          <input
            type="color"
            value={component.style?.borderColor || '#cbd5e1'}
            onChange={(e) => handleStyleUpdate({ borderColor: e.target.value })}
            className="w-8 h-5 rounded-sm cursor-pointer border border-slate-200"
          />
        </PropertyRow>

        {/* Horizontal Lines */}
        <SectionHeader label="Horizontal Lines (HLine)" />
        <div className="p-2 space-y-1 bg-slate-50/50">
          {hlines.map((line, idx) => (
            <div key={line.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1.5">
              <span className="text-[8px] font-bold text-slate-400 w-6 shrink-0">#{idx + 1}</span>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-slate-400">Y:</span>
                  <MiniInput
                    type="number"
                    value={line.y}
                    onChange={(v) => {
                      const newLines = [...hlines];
                      newLines[idx] = { ...line, y: parseInt(v) || 0 };
                      updateComponent(component.id, { hlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                  <span className="text-[8px] text-slate-400">Start:</span>
                  <MiniInput
                    type="number"
                    value={line.start ?? 0}
                    onChange={(v) => {
                      const newLines = [...hlines];
                      newLines[idx] = { ...line, start: parseInt(v) || 0 };
                      updateComponent(component.id, { hlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                  <span className="text-[8px] text-slate-400">End:</span>
                  <MiniInput
                    type="number"
                    value={line.end ?? component.columns.length}
                    onChange={(v) => {
                      const newLines = [...hlines];
                      newLines[idx] = { ...line, end: parseInt(v) || undefined };
                      updateComponent(component.id, { hlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-slate-400">Stroke:</span>
                  <MiniInput
                    value={line.stroke || '1pt + black'}
                    onChange={(v) => {
                      const newLines = [...hlines];
                      newLines[idx] = { ...line, stroke: v };
                      updateComponent(component.id, { hlines: newLines } as any);
                    }}
                    className="flex-1"
                    mono
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  updateComponent(component.id, { hlines: hlines.filter((_, i) => i !== idx) } as any);
                }}
                className="p-0.5 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            className="w-full py-1 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
            onClick={addHLine}
          >
            <Plus className="w-3 h-3" /> Add HLine
          </button>
        </div>

        {/* Vertical Lines */}
        <SectionHeader label="Vertical Lines (VLine)" />
        <div className="p-2 space-y-1 bg-slate-50/50">
          {vlines.map((line, idx) => (
            <div key={line.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1.5">
              <span className="text-[8px] font-bold text-slate-400 w-6 shrink-0">#{idx + 1}</span>
              <div className="flex flex-col gap-0.5 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-slate-400">X:</span>
                  <MiniInput
                    type="number"
                    value={line.x}
                    onChange={(v) => {
                      const newLines = [...vlines];
                      newLines[idx] = { ...line, x: parseInt(v) || 0 };
                      updateComponent(component.id, { vlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                  <span className="text-[8px] text-slate-400">Start:</span>
                  <MiniInput
                    type="number"
                    value={line.start ?? 0}
                    onChange={(v) => {
                      const newLines = [...vlines];
                      newLines[idx] = { ...line, start: parseInt(v) || 0 };
                      updateComponent(component.id, { vlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                  <span className="text-[8px] text-slate-400">End:</span>
                  <MiniInput
                    type="number"
                    value={line.end ?? ''}
                    onChange={(v) => {
                      const newLines = [...vlines];
                      newLines[idx] = { ...line, end: parseInt(v) || undefined };
                      updateComponent(component.id, { vlines: newLines } as any);
                    }}
                    className="w-8 text-center"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-slate-400">Stroke:</span>
                  <MiniInput
                    value={line.stroke || '1pt + black'}
                    onChange={(v) => {
                      const newLines = [...vlines];
                      newLines[idx] = { ...line, stroke: v };
                      updateComponent(component.id, { vlines: newLines } as any);
                    }}
                    className="flex-1"
                    mono
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  updateComponent(component.id, { vlines: vlines.filter((_, i) => i !== idx) } as any);
                }}
                className="p-0.5 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded shrink-0"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            className="w-full py-1 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
            onClick={addVLine}
          >
            <Plus className="w-3 h-3" /> Add VLine
          </button>
        </div>
      </div>
    );
  };

  // ---- TAB 5: DATA BINDING ----
  const renderDataTab = () => (
    <div className="space-y-0">
      <SectionHeader label="Table Behavior" />
      <PropertyRow label="Table Mode">
        <div className="flex gap-1 w-full">
          <button
            onClick={() => updateComponent(component.id, { isStatic: false } as any)}
            className={clsx(
              "flex-1 py-1 text-[9px] font-bold rounded uppercase border transition-all",
              !component.isStatic
                ? "bg-blue-50 border-blue-400 text-blue-700"
                : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
            )}
          >
            Data Loop
          </button>
          <button
            onClick={() => updateComponent(component.id, { isStatic: true } as any)}
            className={clsx(
              "flex-1 py-1 text-[9px] font-bold rounded uppercase border transition-all",
              component.isStatic
                ? "bg-purple-50 border-purple-400 text-purple-700"
                : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
            )}
          >
            Static Grid
          </button>
        </div>
      </PropertyRow>
      {!component.isStatic && (
        <>
          <SectionHeader label="Data Source" />
          <PropertyRow label="Data Binding">
            <MiniInput
              value={component.dataSource || ''}
              onChange={(v) => updateComponent(component.id, { dataSource: v } as any)}
              placeholder="{{items}}"
              mono
              className="w-full"
            />
          </PropertyRow>
        </>
      )}
      <PropertyRow label="Header Rows">
        <MiniInput
          type="number"
          value={component.style?.headerRows ?? 1}
          onChange={(v) => handleStyleUpdate({ headerRows: parseInt(v) || 0 })}
          className="w-full"
          min="0"
          max="5"
        />
      </PropertyRow>

      {/* Field Mapping Overview */}
      <SectionHeader label="Column ↔ Field Mapping" />
      <div className="p-2 space-y-1 bg-slate-50/50">
        {component.columns.map((col, idx) => (
          <div key={col.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1.5">
            <span className="text-[9px] font-bold text-slate-600 w-16 truncate">{col.header || `Col ${idx + 1}`}</span>
            <span className="text-[9px] text-slate-300">→</span>
            <MiniInput
              value={col.field || ''}
              onChange={(v) => updateColumn(idx, { field: v })}
              placeholder="field.path"
              mono
              className="flex-1"
            />
            <select
              value={col.format || 'text'}
              onChange={(e) => updateColumn(idx, { format: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="text-[9px] bg-white border border-slate-200 rounded px-0.5 h-5 outline-none cursor-pointer"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="currency-thb">฿ THB</option>
              <option value="currency-usd">$ USD</option>
              <option value="percent">%</option>
              <option value="date-th">Date TH</option>
              <option value="date-en">Date EN</option>
            </select>
          </div>
        ))}
      </div>

      {/* Summary Rows */}
      <SectionHeader label="Summary Rows" />
      <div className="p-2 space-y-1 bg-slate-50/50">
        {(component.summaryRows || []).map((row, idx) => (
          <div key={idx} className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1.5">
            <MiniInput
              value={row.label}
              onChange={(v) => {
                const rows = [...(component.summaryRows || [])];
                rows[idx] = { ...rows[idx], label: v };
                updateComponent(component.id, { summaryRows: rows } as any);
              }}
              placeholder="Label"
              className="w-20"
            />
            <span className="text-[9px] text-slate-300">:</span>
            <MiniInput
              value={row.value}
              onChange={(v) => {
                const rows = [...(component.summaryRows || [])];
                rows[idx] = { ...rows[idx], value: v };
                updateComponent(component.id, { summaryRows: rows } as any);
              }}
              placeholder="{{total}}"
              mono
              className="flex-1"
            />
            <button
              onClick={() => {
                const rows = (component.summaryRows || []).filter((_, i) => i !== idx);
                updateComponent(component.id, { summaryRows: rows } as any);
              }}
              className="p-0.5 hover:bg-red-100 text-slate-300 hover:text-red-500 rounded"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          className="w-full py-1 border border-dashed border-slate-300 text-[9px] font-bold uppercase text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
          onClick={() => {
            const rows = [...(component.summaryRows || []), { label: '', value: '', separator: false }];
            updateComponent(component.id, { summaryRows: rows } as any);
          }}
        >
          <Plus className="w-3 h-3" /> Add Summary Row
        </button>
      </div>
    </div>
  );

  // ---- TAB 6: CELL ----
  const renderCellTab = () => {
    if (!selectedCell || selectedCell.tableId !== component.id) {
      return (
        <div className="p-4 flex flex-col items-center justify-center text-slate-400 gap-2 h-40">
          <BoxSelect className="w-8 h-8 opacity-20" />
          <p className="text-[10px] text-center">Select a cell in the header<br/>or footer to edit its properties.</p>
        </div>
      );
    }

    const { section, rowId, cellIdx } = selectedCell;
    const isHeader = section === 'header';
    const rows = isHeader ? component.headerRows || [] : component.footerRows || [];
    const rowIndex = rows.findIndex((r) => r.id === rowId);

    if (rowIndex === -1 || !rows[rowIndex].cells[cellIdx]) {
      return null;
    }

    const cell = rows[rowIndex].cells[cellIdx];

    const updateCurrentCell = (updates: any) => {
      const newRows = [...rows];
      const newCells = [...newRows[rowIndex].cells];
      newCells[cellIdx] = { ...newCells[cellIdx], ...updates };
      newRows[rowIndex] = { ...newRows[rowIndex], cells: newCells };
      
      updateComponent(component.id, {
        [isHeader ? 'headerRows' : 'footerRows']: newRows,
      } as any);
    };

    return (
      <div className="space-y-0">
        <SectionHeader label={`Selected Cell (${section == 'header' ? 'Header' : 'Footer'} R${rowIndex + 1} C${cellIdx + 1})`} />
        
        <div className="p-2 space-y-2 bg-slate-50/50 border-b border-slate-200">
           {/* Header & Field */}
           <div className="flex flex-col gap-0.5">
             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Content</span>
             <MiniInput value={cell.content || ''} onChange={(v) => updateCurrentCell({ content: v })} className="w-full" />
           </div>
        </div>

        <SectionHeader label="Smart Merge" />
        <div className="flex gap-2 p-2 border-b border-slate-200 bg-slate-50/50">
          <button
            title="Merge Right"
            disabled={cellIdx >= rows[rowIndex].cells.length - 1} // Can't merge if it's the last cell
            onClick={() => {
              if (cellIdx >= rows[rowIndex].cells.length - 1) return;
              const nextCell = rows[rowIndex].cells[cellIdx + 1];
              const currentColspan = cell.colspan || 1;
              const nextColspan = nextCell.colspan || 1;
              
              const newCols = [...rows[rowIndex].cells];
              // Remove the adjacent cell from array to prevent table explosion
              newCols.splice(cellIdx + 1, 1);
              // Absorb its colspan
              newCols[cellIdx] = { ...cell, colspan: currentColspan + nextColspan };
              
              const newRows = [...rows];
              newRows[rowIndex] = { ...newRows[rowIndex], cells: newCols };
              updateComponent(component.id, { [isHeader ? 'headerRows' : 'footerRows']: newRows } as any);
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold text-slate-600 bg-white border border-slate-300 rounded shadow-sm hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Merge className="w-3.5 h-3.5" /> Merge Right
          </button>
          
          <button
            title="Split Cell"
            disabled={!cell.colspan || cell.colspan <= 1} // Can't split a basic cell
            onClick={() => {
              const currentColspan = cell.colspan || 1;
              if (currentColspan <= 1) return;

              const newCols = [...rows[rowIndex].cells];
              newCols[cellIdx] = { ...cell, colspan: currentColspan - 1 };
              
              // Safely restore a new cell to the array
              newCols.splice(cellIdx + 1, 0, {
                 id: `cell-${Math.random().toString(36).substring(7)}`,
                 content: '',
                 colspan: 1
              });

              const newRows = [...rows];
              newRows[rowIndex] = { ...newRows[rowIndex], cells: newCols };
              updateComponent(component.id, { [isHeader ? 'headerRows' : 'footerRows']: newRows } as any);
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold text-slate-600 bg-white border border-slate-300 rounded shadow-sm hover:border-orange-400 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Split className="w-3.5 h-3.5" /> Split 
          </button>
        </div>

        <SectionHeader label="Cell Style" />
        <PropertyRow label="Alignment">
          <div className="flex border border-slate-200 rounded overflow-hidden">
            {[
              { id: 'left', Icon: AlignLeft },
              { id: 'center', Icon: AlignCenter },
              { id: 'right', Icon: AlignRight },
            ].map(({ id, Icon }) => (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); updateCurrentCell({ align: id }); }}
                className={clsx(
                  'px-2 py-1 transition-all',
                  (cell.align) === id ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-slate-600'
                )}
              >
                <Icon className="w-3 h-3" />
              </button>
            ))}
          </div>
        </PropertyRow>
        
        <PropertyRow label="Fill Color">
          <input
            type="color"
            value={cell.fill || '#ffffff'}
            onChange={(e) => updateCurrentCell({ fill: e.target.value })}
            className="w-full h-6 rounded-sm cursor-pointer"
          />
        </PropertyRow>

        <PropertyRow label="Clear Fill">
          <button
             onClick={() => updateCurrentCell({ fill: null })}
             className="text-[10px] border border-slate-200 rounded px-2 hover:bg-slate-100"
          >
            Clear / Transparent
          </button>
        </PropertyRow>

        <SectionHeader label="Cell Inset (Padding)" />
        <PropertyRow label="Uniform Inset">
          <MiniInput
            value={cell.inset || ''}
            onChange={(v) => updateCurrentCell({ inset: v })}
            placeholder="e.g. 5pt"
            mono
            className="w-full"
          />
        </PropertyRow>
      </div>
    );
  };

  return (
    <section>
      {/* Tab Bar */}
      <div className="flex bg-slate-100 border-b border-slate-300">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 flex flex-col items-center py-1.5 px-1 text-[8px] font-bold uppercase tracking-wider transition-all border-b-2',
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600 bg-white'
                : 'text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-50'
            )}
          >
            <tab.icon className="w-3.5 h-3.5 mb-0.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-h-[60vh] overflow-auto">
        {activeTab === 'columns' && renderColumnsTab()}
        {activeTab === 'rows' && renderRowsTab()}
        {activeTab === 'style' && renderStyleTab()}
        {activeTab === 'lines' && renderLinesTab()}
        {activeTab === 'data' && renderDataTab()}
        {activeTab === 'cell' && renderCellTab()}
      </div>
    </section>
  );
}

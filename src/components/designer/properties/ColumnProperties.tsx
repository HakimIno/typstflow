import { useDesignerStore } from '@/store/designer-store';
import type {
  ColumnLayoutComponent,
  ComponentNode,
  TextComponent,
  TextStyle,
} from '@/types/schema';
import { clsx } from 'clsx';
import {
  Bold,
  ChevronDown,
  ChevronRight,
  Columns,
  GripVertical,
  Italic,
  Minus,
  Paintbrush,
  Plus,
  Type,
  Underline,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { DesignerInput } from '../../shared/DesignerInput';
import { CollapsibleSection, PropertyRow } from './Shared';

interface Props {
  component: ColumnLayoutComponent;
}

// ── Helpers ──────────────────────────────────────────────────
function isTextChild(c: ComponentNode): c is TextComponent {
  return c.type === 'text';
}

function getComponentLabel(c: ComponentNode): string {
  switch (c.type) {
    case 'text': {
      const txt = (c as TextComponent).content || '';
      return txt.length > 30 ? `${txt.slice(0, 30)}...` : txt || 'Empty text';
    }
    case 'image':
      return 'Image';
    case 'line':
      return 'Line';
    case 'table':
      return 'Table';
    case 'spacer':
      return 'Spacer';
    default:
      return c.type;
  }
}

function getComponentIcon(type: string) {
  switch (type) {
    case 'text':
      return Type;
    case 'image':
      return Paintbrush;
    case 'line':
      return Minus;
    default:
      return Type;
  }
}

// ── Main Component ──────────────────────────────────────────
export function ColumnProperties({ component }: Props) {
  const updateComponent = useDesignerStore((s) => s.updateComponent);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);

  // -- Column-level updates --
  const handleGapChange = useCallback(
    (v: string) => updateComponent(component.id, { gap: v } as any),
    [component.id, updateComponent]
  );

  const handleColumnWidthChange = useCallback(
    (index: number, width: string) => {
      const newColumns = component.columns.map((col, i) => (i === index ? { ...col, width } : col));
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  const handleAddColumn = useCallback(() => {
    updateComponent(component.id, {
      columns: [...component.columns, { width: '1fr', components: [] }],
    } as any);
  }, [component.id, component.columns, updateComponent]);

  const handleRemoveColumn = useCallback(
    (index: number) => {
      if (component.columns.length <= 1) return;
      updateComponent(component.id, {
        columns: component.columns.filter((_, i) => i !== index),
      } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  // -- Child component updates --
  const updateChild = useCallback(
    (colIdx: number, childId: string, updates: Partial<ComponentNode>) => {
      const newColumns = component.columns.map((col, i) => {
        if (i !== colIdx) return col;
        return {
          ...col,
          components: col.components.map((c) => (c.id === childId ? { ...c, ...updates } : c)),
        };
      });
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  const updateChildStyle = useCallback(
    (colIdx: number, childId: string, styleUpdates: Partial<TextStyle>) => {
      const newColumns = component.columns.map((col, i) => {
        if (i !== colIdx) return col;
        return {
          ...col,
          components: col.components.map((c) => {
            if (c.id !== childId || c.type !== 'text') return c;
            const tc = c as TextComponent;
            return { ...tc, style: { ...tc.style, ...styleUpdates } };
          }),
        };
      });
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  const removeChild = useCallback(
    (colIdx: number, childId: string) => {
      const newColumns = component.columns.map((col, i) => {
        if (i !== colIdx) return col;
        return {
          ...col,
          components: col.components.filter((c) => c.id !== childId),
        };
      });
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  const addTextChild = useCallback(
    (colIdx: number) => {
      const newChild: TextComponent = {
        id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'text',
        x: 0,
        y: 0,
        width: 100,
        height: 10,
        content: 'New text',
        style: { fontSize: 10, color: '#000000' },
      };
      const newColumns = component.columns.map((col, i) => {
        if (i !== colIdx) return col;
        return { ...col, components: [...col.components, newChild] };
      });
      updateComponent(component.id, { columns: newColumns } as any);
    },
    [component.id, component.columns, updateComponent]
  );

  return (
    <>
      <CollapsibleSection label="Column Setup">
        <PropertyRow label="Gap">
          <DesignerInput
            type="text"
            variant="mini"
            value={component.gap ?? '10mm'}
            onChange={handleGapChange}
            placeholder="10mm"
            mono
          />
        </PropertyRow>
      </CollapsibleSection>

      <CollapsibleSection label="Columns Config">
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-60">
            Columns ({component.columns.length})
          </span>
          <button
            type="button"
            onClick={handleAddColumn}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded transition-colors uppercase tracking-wider"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        <div className="space-y-1">
          {component.columns.map((col, idx) => (
            <div key={idx} className="flex items-center gap-1.5 group">
              <GripVertical className="w-3 h-3 text-[var(--text-muted)] opacity-30 shrink-0" />
              <div className="flex items-center gap-1 flex-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-1.5 py-1">
                <Columns className="w-3 h-3 text-[var(--accent)] opacity-60 shrink-0" />
                <span className="text-[8px] font-bold text-[var(--text-muted)] w-4 shrink-0">
                  {idx + 1}
                </span>
                <DesignerInput
                  type="text"
                  variant="mini"
                  value={col.width}
                  onChange={(v) => handleColumnWidthChange(idx, v)}
                  placeholder="1fr"
                  mono
                  className="flex-1"
                />
                <span className="text-[7px] text-[var(--text-muted)] opacity-40 shrink-0">
                  {col.components.length} items
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveColumn(idx)}
                disabled={component.columns.length <= 1}
                className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                title="Remove column"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Width hint */}
        <div className="pt-2">
          <p className="text-[7px] text-[var(--text-muted)] opacity-50 leading-relaxed italic">
            Widths: <code className="bg-black/20 px-1 rounded">1fr</code> (flexible),{' '}
            <code className="bg-black/20 px-1 rounded">60mm</code> (fixed),{' '}
            <code className="bg-black/20 px-1 rounded">30%</code> (relative)
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Columns Content">
        {component.columns.map((col, colIdx) => (
          <div key={colIdx} className="border-b border-[var(--border-default)] last:border-b-0">
            {/* Column header */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-white/[0.02]">
              <span className="text-[9px] font-bold text-[var(--text-secondary)]">
                Column {colIdx + 1}
                <span className="text-[var(--text-muted)] font-normal ml-1">({col.width})</span>
              </span>
              <button
                type="button"
                onClick={() => addTextChild(colIdx)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[7px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors uppercase tracking-wider"
              >
                <Plus className="w-2.5 h-2.5" />
                Text
              </button>
            </div>

            {/* Children list */}
            {col.components.length === 0 ? (
              <div className="px-3 py-2 text-[8px] text-[var(--text-muted)] italic opacity-50">
                Empty column — click + Text to add
              </div>
            ) : (
              <div className="space-y-px">
                {col.components.map((child) => {
                  const isExpanded = expandedChild === child.id;
                  const Icon = getComponentIcon(child.type);

                  return (
                    <div key={child.id} className="bg-[var(--bg-surface)]">
                      {/* Child header row */}
                      <div
                        className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        onClick={() => setExpandedChild(isExpanded ? null : child.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-[var(--accent)] shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        )}
                        <Icon className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        <span className="text-[8px] text-[var(--text-secondary)] flex-1 truncate">
                          {getComponentLabel(child)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeChild(colIdx, child.id);
                          }}
                          className="p-0.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Expanded editor */}
                      {isExpanded && isTextChild(child) && (
                        <ChildTextEditor
                          child={child}
                          colIdx={colIdx}
                          onUpdate={updateChild}
                          onUpdateStyle={updateChildStyle}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </CollapsibleSection>
    </>
  );
}

// ── Inline text editor for child components ──────────────────
function ChildTextEditor({
  child,
  colIdx,
  onUpdate,
  onUpdateStyle,
}: {
  child: TextComponent;
  colIdx: number;
  onUpdate: (colIdx: number, childId: string, updates: Partial<ComponentNode>) => void;
  onUpdateStyle: (colIdx: number, childId: string, styleUpdates: Partial<TextStyle>) => void;
}) {
  const style = child.style || {};

  return (
    <div className="px-3 pb-2 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
      {/* Content */}
      <div>
        <label className="text-[7px] font-bold uppercase tracking-widest text-[var(--text-muted)] opacity-60 mb-0.5 block">
          Content
        </label>
        <textarea
          value={child.content || ''}
          onChange={(e) => onUpdate(colIdx, child.id, { content: e.target.value })}
          placeholder="Type text or {{variable}}..."
          className="w-full bg-[var(--bg-widget)] border border-[var(--border-default)] rounded px-2 py-1 text-[10px] text-[var(--text-primary)] resize-none min-h-[40px] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
          rows={2}
        />
      </div>

      {/* Style toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Font Size */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-widget)] border border-[var(--border-default)] rounded px-1 py-0.5">
          <span className="text-[7px] text-[var(--text-muted)]">Size</span>
          <input
            type="number"
            value={style.fontSize ?? 10}
            onChange={(e) =>
              onUpdateStyle(colIdx, child.id, { fontSize: Number(e.target.value) || 10 })
            }
            className="w-8 bg-transparent text-[9px] text-center text-[var(--text-primary)] focus:outline-none font-mono"
            min={4}
            max={72}
          />
        </div>

        {/* Font Weight */}
        <button
          type="button"
          onClick={() =>
            onUpdateStyle(colIdx, child.id, {
              fontWeight: style.fontWeight === 'bold' ? 'regular' : 'bold',
            })
          }
          className={clsx(
            'p-1 rounded transition-colors border',
            style.fontWeight === 'bold'
              ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
          title="Bold"
        >
          <Bold className="w-3 h-3" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => onUpdateStyle(colIdx, child.id, { italic: !style.italic })}
          className={clsx(
            'p-1 rounded transition-colors border',
            style.italic
              ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
          title="Italic"
        >
          <Italic className="w-3 h-3" />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => onUpdateStyle(colIdx, child.id, { underline: !style.underline })}
          className={clsx(
            'p-1 rounded transition-colors border',
            style.underline
              ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent)]'
              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
          title="Underline"
        >
          <Underline className="w-3 h-3" />
        </button>

        {/* Color */}
        <div className="flex items-center gap-0.5 bg-[var(--bg-widget)] border border-[var(--border-default)] rounded px-1 py-0.5 ml-auto">
          <span className="text-[7px] text-[var(--text-muted)]">Color</span>
          <input
            type="color"
            value={style.color || '#000000'}
            onChange={(e) => onUpdateStyle(colIdx, child.id, { color: e.target.value })}
            className="w-4 h-4 rounded cursor-pointer border-0 p-0"
          />
        </div>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-px bg-[var(--border-default)] rounded overflow-hidden">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            type="button"
            onClick={() => onUpdate(colIdx, child.id, { align })}
            className={clsx(
              'flex-1 py-1 text-[7px] font-bold uppercase tracking-wider transition-colors',
              (child.align || 'left') === align
                ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'bg-[var(--bg-widget)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {align}
          </button>
        ))}
      </div>
    </div>
  );
}

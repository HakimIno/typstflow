import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { ChecklistComponent, ChecklistItem } from '@/types/schema';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { ColorPicker } from '../../shared/ColorPicker';
import { DesignerInput } from '../../shared/DesignerInput';
import { SectionHeader } from './Shared';

interface Props {
  component: ChecklistComponent;
  onUpdate: (updates: Partial<ChecklistComponent>) => void;
}

export function ChecklistProperties({ component, onUpdate }: Props) {
  const items: ChecklistItem[] = component.items ?? [];
  const listStyle = component.listStyle ?? 'bullet';
  const direction = component.direction ?? 'vertical';

  const updateItem = (idx: number, updates: Partial<ChecklistItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ items: next });
  };

  const addItem = () => {
    onUpdate({ items: [...items, { id: nanoid(), label: 'รายการใหม่', checked: false }] });
  };

  const removeItem = (idx: number) => {
    onUpdate({ items: items.filter((_, i) => i !== idx) });
  };

  const isCheckbox = listStyle === 'checkbox';

  return (
    <>
      {/* List Style */}
      <section>
        <SectionHeader label="List Style" />
        <div className="p-2 space-y-2">
          <Select
            value={listStyle}
            onValueChange={(v) => onUpdate({ listStyle: v as ChecklistComponent['listStyle'] })}
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bullet">• Bullet</SelectItem>
              <SelectItem value="numbered">1. Numbered</SelectItem>
              <SelectItem value="alpha">a. Alpha</SelectItem>
              <SelectItem value="roman">i. Roman</SelectItem>
              <SelectItem value="checkbox">☐ Checkbox</SelectItem>
              <SelectItem value="dash">– Dash</SelectItem>
              <SelectItem value="custom">→ Custom Marker</SelectItem>
            </SelectContent>
          </Select>

          {listStyle === 'custom' && (
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Marker
              </span>
              <DesignerInput
                value={component.marker ?? '→'}
                onChange={(v) => onUpdate({ marker: v })}
                placeholder="→"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Spacing (pt)
              </span>
              <DesignerInput
                type="number"
                variant="mini"
                value={String(component.spacing ?? 4)}
                onChange={(v) => onUpdate({ spacing: Number.parseFloat(v) || 4 })}
                mono
              />
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Indent (mm)
              </span>
              <DesignerInput
                type="number"
                variant="mini"
                value={String(component.indent ?? 5)}
                onChange={(v) => onUpdate({ indent: Number.parseFloat(v) || 5 })}
                mono
              />
            </div>
          </div>
        </div>
      </section>

      {/* Checkbox Options — only visible when style = checkbox */}
      {isCheckbox && (
        <section>
          <SectionHeader label="Checkbox Style" />
          <div className="p-2 space-y-2">
            {/* Color */}
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Color</span>
              <ColorPicker
                color={component.checkboxColor ?? '#616161'}
                onChange={(v) => onUpdate({ checkboxColor: v })}
                label="Checkbox Color"
              />
            </div>

            {/* Shape */}
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">Shape</span>
              <div className="flex gap-1">
                {(
                  [
                    { value: 'square', label: '▪', title: 'Square' },
                    { value: 'rounded', label: '▢', title: 'Rounded' },
                    { value: 'circle', label: '●', title: 'Circle' },
                  ] as const
                ).map(({ value, label, title }) => (
                  <button
                    key={value}
                    type="button"
                    title={title}
                    onClick={() => onUpdate({ checkboxShape: value })}
                    className={`flex-1 h-6 rounded text-[11px] border transition-all ${
                      (component.checkboxShape ?? 'rounded') === value
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fill color (unchecked box background) */}
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Unchecked Fill
              </span>
              <ColorPicker
                color={component.checkboxFill ?? '#ffffff'}
                onChange={(v) => onUpdate({ checkboxFill: v })}
                label="Unchecked Box Fill"
              />
            </div>

            {/* Theme Style (Solid vs Outline) */}
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Theme Style
              </span>
              <div className="flex gap-1">
                {(
                  [
                    { value: 'solid', label: 'Solid' },
                    { value: 'outline', label: 'Outline (Light)' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onUpdate({ checkboxStyle: value })}
                    className={`flex-1 h-6 rounded text-[10px] font-medium border transition-all ${
                      (component.checkboxStyle ?? 'solid') === value
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                        : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mark style + size */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                  Checked Mark
                </span>
                <Select
                  value={component.checkMark ?? 'x'}
                  onValueChange={(v) =>
                    onUpdate({ checkMark: v as ChecklistComponent['checkMark'] })
                  }
                >
                  <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="x">✓ Check</SelectItem>
                    <SelectItem value="/">◑ Partial</SelectItem>
                    <SelectItem value="-">⊟ Cancel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                  Size (pt)
                </span>
                <DesignerInput
                  type="number"
                  variant="mini"
                  value={component.checkboxSize !== undefined ? String(component.checkboxSize) : ''}
                  onChange={(v) => {
                    const n = Number.parseFloat(v);
                    onUpdate({ checkboxSize: v.trim() === '' || Number.isNaN(n) ? undefined : n });
                  }}
                  placeholder="auto"
                  mono
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Layout */}
      <section>
        <SectionHeader label="Layout" />
        <div className="p-2 space-y-2">
          <div className="space-y-0.5">
            <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
              Direction
            </span>
            <Select
              value={direction}
              onValueChange={(v) => onUpdate({ direction: v as ChecklistComponent['direction'] })}
            >
              <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">↓ Vertical</SelectItem>
                <SelectItem value="horizontal">→ Horizontal</SelectItem>
                <SelectItem value="grid">⊞ Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {direction === 'grid' && (
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                Columns
              </span>
              <DesignerInput
                type="number"
                variant="mini"
                value={String(component.columns ?? 2)}
                onChange={(v) =>
                  onUpdate({ columns: Math.max(1, Math.round(Number.parseFloat(v) || 2)) })
                }
                mono
              />
            </div>
          )}

          <div className="space-y-0.5">
            <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
              Vertical Alignment
            </span>
            <Select
              value={component.alignItems ?? 'start'}
              onValueChange={(v) => onUpdate({ alignItems: v as 'start' | 'center' })}
            >
              <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-surface)] border-[var(--border-default)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="start">↑ Top (First Line)</SelectItem>
                <SelectItem value="center">↕ Center (Middle)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Completed Item Effects */}
      <section>
        <SectionHeader label="Completed Item Effects" />
        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            <button
              key="strikethrough"
              type="button"
              onClick={() => onUpdate({ checkedStrikethrough: !component.checkedStrikethrough })}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 h-7 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                component.checkedStrikethrough
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-black'
                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-accent)]'
              }`}
            >
              <s>Strikethrough</s>
            </button>

            <button
              key="mute"
              type="button"
              onClick={() => onUpdate({ checkedMuted: !component.checkedMuted })}
              className={`flex-1 flex items-center justify-center gap-1 py-1 px-1.5 h-7 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                component.checkedMuted
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white font-black'
                  : 'bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-accent)]'
              }`}
            >
              <span className="opacity-70">Dim / Mute</span>
            </button>
          </div>
        </div>
      </section>

      {/* Data Source (optional) */}
      <section>
        <SectionHeader label="Data Binding (optional)" />
        <div className="p-2 space-y-2">
          <div className="space-y-0.5">
            <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
              Data Source
            </span>
            <DesignerInput
              value={component.dataSource ?? ''}
              onChange={(v) => onUpdate({ dataSource: v.trim() || undefined })}
              placeholder="{{tasks}}"
              mono
            />
          </div>
          {component.dataSource && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                  Label Field
                </span>
                <DesignerInput
                  value={component.labelField ?? ''}
                  onChange={(v) => onUpdate({ labelField: v.trim() || undefined })}
                  placeholder="label"
                  mono
                />
              </div>
              {isCheckbox && (
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase">
                    Checked Field
                  </span>
                  <DesignerInput
                    value={component.checkedField ?? ''}
                    onChange={(v) => onUpdate({ checkedField: v.trim() || undefined })}
                    placeholder="checked"
                    mono
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Static Items */}
      {!component.dataSource && (
        <section>
          <SectionHeader label="Items" />
          <div className="p-2 space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="group/row relative flex items-center gap-1.5 bg-[var(--bg-widget)] border border-[var(--border-default)] rounded p-1.5"
              >
                <GripVertical className="w-3 h-3 text-[var(--text-muted)] opacity-40 shrink-0" />

                {isCheckbox && (
                  <button
                    type="button"
                    onClick={() => updateItem(idx, { checked: !item.checked })}
                    className="text-[11px] shrink-0 leading-none"
                    title={item.checked ? 'Checked' : 'Unchecked'}
                  >
                    {item.checked ? '☑' : '☐'}
                  </button>
                )}

                <DesignerInput
                  className="flex-1 min-w-0"
                  value={item.label}
                  onChange={(v) => updateItem(idx, { label: v })}
                  placeholder="รายการ..."
                />

                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="w-4 h-4 flex items-center justify-center text-red-400 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="w-full py-1.5 border border-dashed border-[var(--border-default)] rounded text-[9px] font-bold uppercase text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Item
            </button>
          </div>
        </section>
      )}
    </>
  );
}

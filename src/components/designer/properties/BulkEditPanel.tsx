'use client';

import type { ComponentNode, TextStyle } from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Layers,
  Minus,
  MoreHorizontal,
  MoreVertical,
  Trash2,
  Underline,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { ColorPicker } from '../../shared/ColorPicker';
import { DesignerInput } from '../../shared/DesignerInput';
import { FontFamilyPicker } from './FontFamilyPicker';
import { CollapsibleSection, PropertyRow } from './Shared';

// ── Constants ────────────────────────────────────────────────────────────

const MIXED = Symbol('mixed');
type MixedValue<T> = T | typeof MIXED;

const TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  table: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  image: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  line: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  spacer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/20',
  barcode: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  qr: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
  'summary-box': 'bg-orange-500/20 text-orange-400 border-orange-500/20',
  'page-number': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/20',
  'page-break-indicator': 'bg-rose-500/20 text-rose-400 border-rose-500/20',
};

const TYPE_ICONS: Record<string, string> = {
  text: '𝐓',
  table: '▦',
  image: '🖼',
  line: '━',
  spacer: '↕',
  barcode: '⫿',
  qr: '⊞',
  'summary-box': '∑',
  'page-number': '#',
  'page-break-indicator': '⤓',
};

// ── Helper: compute mixed value ──────────────────────────────────────────

function getMixedValue<T>(
  components: ComponentNode[],
  getter: (c: ComponentNode) => T
): MixedValue<T> {
  if (components.length === 0) return MIXED;
  const first = getter(components[0]);
  for (let i = 1; i < components.length; i++) {
    if (getter(components[i]) !== first) return MIXED;
  }
  return first;
}

function getMixedStyleValue<T>(components: ComponentNode[], key: keyof TextStyle): MixedValue<T> {
  return getMixedValue(components, (c) => {
    const style = (c as any).style as TextStyle | undefined;
    return (style?.[key] ?? undefined) as T;
  });
}

function isMixed<T>(value: MixedValue<T>): value is typeof MIXED {
  return value === MIXED;
}

// ── Props ────────────────────────────────────────────────────────────────

interface BulkEditPanelProps {
  selectedComponents: ComponentNode[];
  onBulkUpdate: (updates: Partial<ComponentNode>) => void;
  onBulkStyleUpdate: (styleUpdates: Partial<TextStyle>) => void;
  onDeleteAll: () => void;
}

// ── Component ────────────────────────────────────────────────────────────

export const BulkEditPanel = memo(function BulkEditPanel({
  selectedComponents,
  onBulkUpdate,
  onBulkStyleUpdate,
  onDeleteAll,
}: BulkEditPanelProps) {
  // ── Derived state ──────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of selectedComponents) {
      counts[c.type] = (counts[c.type] || 0) + 1;
    }
    return counts;
  }, [selectedComponents]);

  const allTypes = Object.keys(typeCounts);
  const allText = allTypes.every((t) => t === 'text' || t === 'table');
  const allLine = allTypes.every((t) => t === 'line');

  // Shared values
  const widthValue = getMixedValue(selectedComponents, (c) => c.width);
  const heightValue = getMixedValue(selectedComponents, (c) => c.height);
  const alignValue = getMixedValue(selectedComponents, (c) => c.align || 'left');

  // Typography values (only computed when relevant)
  const fontFamily = allText ? getMixedStyleValue<string>(selectedComponents, 'fontFamily') : MIXED;
  const fontSize = allText ? getMixedStyleValue<number>(selectedComponents, 'fontSize') : MIXED;
  const fontWeight = allText ? getMixedStyleValue<string>(selectedComponents, 'fontWeight') : MIXED;
  const isItalic = allText ? getMixedStyleValue<boolean>(selectedComponents, 'italic') : MIXED;
  const isUnderline = allText
    ? getMixedStyleValue<boolean>(selectedComponents, 'underline')
    : MIXED;
  const textColor = allText ? getMixedStyleValue<string>(selectedComponents, 'color') : MIXED;
  const lineHeight = allText ? getMixedStyleValue<number>(selectedComponents, 'lineHeight') : MIXED;

  // Line values
  const lineColor = allLine
    ? getMixedValue(selectedComponents, (c) => (c as any).color || '#000000')
    : MIXED;
  const lineThickness = allLine
    ? getMixedValue(selectedComponents, (c) => (c as any).thickness || '1pt')
    : MIXED;
  const lineStyle = allLine
    ? getMixedValue(selectedComponents, (c) => (c as any).style || 'solid')
    : MIXED;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleWidthChange = (v: string) => {
    const num = Number.parseFloat(v);
    if (!Number.isNaN(num)) onBulkUpdate({ width: num });
  };

  const handleHeightChange = (v: string) => {
    const num = Number.parseFloat(v);
    if (!Number.isNaN(num)) onBulkUpdate({ height: num });
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right' | 'justify') => {
    onBulkUpdate({ align });
    if (allText) {
      onBulkStyleUpdate({ justify: align === 'justify' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-default)]">
      {/* Header */}
      <div className="h-10 min-h-[40px] bg-white/[0.02] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
        <div className="w-6 h-6 rounded bg-[var(--accent-glow)] flex items-center justify-center border-[var(--border-accent)] text-[var(--accent)]">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-tight text-[var(--text-primary)]">
            Bulk Edit
          </span>
          <span className="text-[8px] text-[var(--text-muted)] font-mono">
            {selectedComponents.length} SELECTED
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto">
        {/* ── Selection Summary ────────────────────────────────────── */}
        <section className="p-2 border-b border-[var(--border-default)]">
          <div className="flex flex-wrap gap-1">
            {Object.entries(typeCounts).map(([type, count]) => (
              <span
                key={type}
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all',
                  TYPE_COLORS[type] || 'bg-white/10 text-zinc-400 border-white/10'
                )}
              >
                <span className="text-[10px] leading-none">{TYPE_ICONS[type] || '•'}</span>
                {type}
                <span className="opacity-60">×{count}</span>
              </span>
            ))}
          </div>
        </section>

        {/* ── Geometry ─────────────────────────────────────────────── */}
        <CollapsibleSection label="Dimensions">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                Width (mm)
              </span>
              <DesignerInput
                type="number"
                variant="mini"
                step="1"
                min={1}
                value={isMixed(widthValue) ? '' : (widthValue ?? 0)}
                onChange={handleWidthChange}
                placeholder={isMixed(widthValue) ? '—' : undefined}
              />
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">
                Height (mm)
              </span>
              <DesignerInput
                type="number"
                variant="mini"
                step="1"
                min={1}
                value={isMixed(heightValue) ? '' : (heightValue ?? 0)}
                onChange={handleHeightChange}
                placeholder={isMixed(heightValue) ? '—' : undefined}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* ── Alignment ────────────────────────────────────────────── */}
        <CollapsibleSection label="Alignment">
          <div className="space-y-1.5">
            <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
              {(
                [
                  { id: 'left', icon: AlignLeft },
                  { id: 'center', icon: AlignCenter },
                  { id: 'right', icon: AlignRight },
                  { id: 'justify', icon: AlignJustify },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAlignChange(item.id)}
                  className={clsx(
                    'flex-1 py-1.5 flex items-center justify-center transition-all',
                    !isMixed(alignValue) && alignValue === item.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            {isMixed(alignValue) && (
              <p className="text-[8px] text-[var(--text-muted)] mt-1 text-center italic opacity-60">
                Mixed alignments — click to unify
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Typography (conditional: all text/table) ─────────────── */}
        {allText && (
          <CollapsibleSection label="Typography">
            <div className="space-y-2.5">
              <PropertyRow label="Font">
                <FontFamilyPicker
                  value={isMixed(fontFamily) ? '' : (fontFamily as string) || 'Sarabun'}
                  onChange={(family) => onBulkStyleUpdate({ fontFamily: family })}
                  mixed={isMixed(fontFamily)}
                />
              </PropertyRow>

              <PropertyRow label="Size (pt)">
                <DesignerInput
                  type="number"
                  variant="mini"
                  min={1}
                  max={200}
                  value={isMixed(fontSize) ? '' : (fontSize as number) || 10}
                  onChange={(v) => onBulkStyleUpdate({ fontSize: Number.parseInt(v) || 10 })}
                  placeholder={isMixed(fontSize) ? '—' : undefined}
                />
              </PropertyRow>

              <PropertyRow label="Style">
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Bold"
                    onClick={() =>
                      onBulkStyleUpdate({
                        fontWeight:
                          !isMixed(fontWeight) && fontWeight === 'bold' ? 'regular' : 'bold',
                      })
                    }
                    className={clsx(
                      'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                      !isMixed(fontWeight) && fontWeight === 'bold'
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                    )}
                  >
                    <Bold className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onClick={() =>
                      onBulkStyleUpdate({ italic: isMixed(isItalic) ? true : !isItalic })
                    }
                    className={clsx(
                      'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                      !isMixed(isItalic) && isItalic
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                    )}
                  >
                    <Italic className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    title="Underline"
                    onClick={() =>
                      onBulkStyleUpdate({ underline: isMixed(isUnderline) ? true : !isUnderline })
                    }
                    className={clsx(
                      'w-6 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                      !isMixed(isUnderline) && isUnderline
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                    )}
                  >
                    <Underline className="w-3 h-3" />
                  </button>
                  {(isMixed(fontWeight) || isMixed(isItalic) || isMixed(isUnderline)) && (
                    <span className="text-[8px] text-[var(--text-muted)] flex items-center ml-1 italic opacity-50">
                      mixed
                    </span>
                  )}
                </div>
              </PropertyRow>

              <PropertyRow label="Color">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex-1">
                    <ColorPicker
                      color={isMixed(textColor) ? '#000000' : (textColor as string) || '#000000'}
                      onChange={(color) => onBulkStyleUpdate({ color })}
                    />
                  </div>
                  {isMixed(textColor) && (
                    <span className="text-[8px] text-[var(--text-muted)] italic opacity-50 shrink-0">
                      mixed
                    </span>
                  )}
                </div>
              </PropertyRow>

              <PropertyRow label="Line Height">
                <DesignerInput
                  type="number"
                  variant="mini"
                  step="0.1"
                  min={0.5}
                  max={3}
                  value={isMixed(lineHeight) ? '' : (lineHeight as number) || 1.4}
                  onChange={(v) => onBulkStyleUpdate({ lineHeight: Number.parseFloat(v) || 1.4 })}
                  placeholder={isMixed(lineHeight) ? '—' : undefined}
                />
              </PropertyRow>
            </div>
          </CollapsibleSection>
        )}

        {/* ── Line Properties (conditional: all line) ──────────────── */}
        {allLine && (
          <CollapsibleSection label="Line Appearance">
            <div className="space-y-2.5">
              <PropertyRow label="Thickness">
                <DesignerInput
                  type="text"
                  variant="mini"
                  value={isMixed(lineThickness) ? '' : (lineThickness as string)}
                  onChange={(v) => onBulkUpdate({ thickness: v } as any)}
                  mono
                  placeholder={isMixed(lineThickness) ? '— mixed —' : '1pt'}
                />
              </PropertyRow>

              <PropertyRow label="Color">
                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex-1">
                    <ColorPicker
                      color={isMixed(lineColor) ? '#000000' : (lineColor as string)}
                      onChange={(color) => onBulkUpdate({ color } as any)}
                    />
                  </div>
                  {isMixed(lineColor) && (
                    <span className="text-[8px] text-[var(--text-muted)] italic opacity-50 shrink-0">
                      mixed
                    </span>
                  )}
                </div>
              </PropertyRow>

              <PropertyRow label="Style">
                <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
                  {(
                    [
                      { id: 'solid', icon: Minus, label: 'Solid' },
                      { id: 'dashed', icon: MoreHorizontal, label: 'Dashed' },
                      { id: 'dotted', icon: MoreVertical, label: 'Dotted' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => onBulkUpdate({ style: item.id } as any)}
                      className={clsx(
                        'flex-1 py-1 flex items-center justify-center transition-all',
                        !isMixed(lineStyle) && lineStyle === item.id
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </PropertyRow>
            </div>
          </CollapsibleSection>
        )}

        {/* ── Danger Zone ──────────────────────────────────────────── */}
        <section className="p-1 mt-2">
          <button
            type="button"
            onClick={onDeleteAll}
            className="flex items-center rounded justify-center gap-2 w-full px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 transition-all text-[10px] font-bold uppercase tracking-wider shadow-sm hover:shadow-red-500/20 hover:shadow-lg group"
          >
            <Trash2 className="w-3.5 h-3.5 group-hover:animate-pulse" />
            Delete {selectedComponents.length} Selected
          </button>
        </section>
      </div>
    </div>
  );
});

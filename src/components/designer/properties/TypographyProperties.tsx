'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { FONT_CATALOG } from '@/lib/font-catalog';
import { useDesignerStore } from '@/store/designer-store';
import { clsx } from 'clsx';
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Italic,
  Settings2,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { useState } from 'react';
import { ColorPicker } from '../../shared/ColorPicker';
import { DesignerInput } from '../../shared/DesignerInput';
import { FontFamilyPicker } from './FontFamilyPicker';
import { CollapsibleSection, ControlField, PropertyGrid } from './Shared';

interface TypographyPropertiesProps {
  style: any;
  onUpdateStyle: (updates: any) => void;
  allowBlockSettings?: boolean;
}

export function TypographyProperties({
  style,
  onUpdateStyle,
  allowBlockSettings = false,
}: TypographyPropertiesProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const customFonts = useDesignerStore((s) => s.customFonts || []);

  const fontFamily = style?.fontFamily || 'Sarabun';

  // Normalize family name to check both legacy and actual parsed name
  const formatFontFamily = (name: string) => {
    const n = (name ?? '').trim();
    if (n === 'LINE Seed Sans TH') return 'LINE Seed Sans';
    return n;
  };

  const normalizedFamily = formatFontFamily(fontFamily);

  // 1. Find all available weights for this font family
  const customMatches = customFonts.filter((f) => formatFontFamily(f.family) === normalizedFamily);

  const catalogMatch = FONT_CATALOG.find((f) => formatFontFamily(f.family) === normalizedFamily);

  let availableWeights: number[] = [];

  if (customMatches.length > 0) {
    availableWeights = customMatches.map((f) => Number(f.weight));
  } else if (catalogMatch) {
    if (catalogMatch.variable) {
      // Variable fonts cover the whole spectrum
      availableWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    } else if (catalogMatch.githubUrls) {
      availableWeights = Object.keys(catalogMatch.githubUrls).map(Number);
    } else {
      // Built-in fonts default
      availableWeights = [400, 700];
    }
  } else {
    availableWeights = [400, 700];
  }

  // Remove duplicates and sort
  availableWeights = Array.from(new Set(availableWeights)).sort((a, b) => a - b);

  // Helper to parse weight strings to numbers
  const getWeightNumber = (w: any): number => {
    if (typeof w === 'number') return w;
    const str = String(w || '').toLowerCase();
    if (str === 'thin') return 100;
    if (str === 'extralight') return 200;
    if (str === 'light') return 300;
    if (str === 'medium') return 500;
    if (str === 'semibold') return 600;
    if (str === 'bold') return 700;
    if (str === 'extrabold') return 800;
    if (str === 'black') return 900;
    return 400; // default regular
  };

  const WEIGHT_MAP: Record<number, { value: string; label: string }> = {
    100: { value: 'thin', label: 'Thin (100)' },
    200: { value: 'extralight', label: 'Extra Light (200)' },
    300: { value: 'light', label: 'Light (300)' },
    400: { value: 'regular', label: 'Regular (400)' },
    500: { value: 'medium', label: 'Medium (500)' },
    600: { value: 'semibold', label: 'Semi Bold (600)' },
    700: { value: 'bold', label: 'Bold (700)' },
    800: { value: 'extrabold', label: 'Extra Bold (800)' },
    900: { value: 'black', label: 'Black (900)' },
  };

  const currentWeightNum = getWeightNumber(style?.fontWeight);
  const selectValue = WEIGHT_MAP[currentWeightNum]?.value || 'regular';

  return (
    <CollapsibleSection label="Typography">
      <PropertyGrid cols={1}>
        <ControlField label="Font Family">
          <FontFamilyPicker
            value={style?.fontFamily || 'Sarabun'}
            onChange={(family) => onUpdateStyle({ fontFamily: family })}
          />
        </ControlField>
      </PropertyGrid>

      <PropertyGrid cols={2}>
        <ControlField label="Size">
          <DesignerInput
            type="number"
            variant="mini"
            min={1}
            max={200}
            value={style?.fontSize || 10}
            suffix="pt"
            onChange={(v) => onUpdateStyle({ fontSize: Number.parseInt(v) || 10 })}
          />
        </ControlField>

        <ControlField label="Color">
          <ColorPicker
            color={style?.color || '#000000'}
            onChange={(color) => onUpdateStyle({ color })}
          />
        </ControlField>

        {/* Font Weight Dropdown (Dynamically filtered by available files) */}
        <ControlField label="Weight">
          <Select value={selectValue} onValueChange={(val) => onUpdateStyle({ fontWeight: val })}>
            <SelectTrigger className="w-full h-6 bg-[var(--bg-widget)] border-[var(--border-default)] text-[9.5px] hover:border-[var(--text-muted)] transition-all">
              <SelectValue placeholder="Weight" />
            </SelectTrigger>
            <SelectContent className="z-[10000]">
              {availableWeights.map((w) => {
                const item = WEIGHT_MAP[w];
                if (!item) return null;
                return (
                  <SelectItem key={w} value={item.value} className="text-[10px]">
                    {item.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </ControlField>

        {/* Text Decorations Toolbar */}
        <ControlField label="Decorations">
          <div className="flex gap-1 w-full">
            <button
              type="button"
              title="Italic"
              onClick={() => onUpdateStyle({ italic: !style?.italic })}
              className={clsx(
                'flex-1 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                style?.italic
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
              )}
            >
              <Italic className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="Underline"
              onClick={() => onUpdateStyle({ underline: !style?.underline })}
              className={clsx(
                'flex-1 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                style?.underline
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
              )}
            >
              <Underline className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="Strikethrough"
              onClick={() => onUpdateStyle({ strikethrough: !style?.strikethrough })}
              className={clsx(
                'flex-1 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                style?.strikethrough
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
              )}
            >
              <Strikethrough className="w-3 h-3" />
            </button>
            <button
              type="button"
              title="Small Caps"
              onClick={() => onUpdateStyle({ smallcaps: !style?.smallcaps })}
              className={clsx(
                'flex-1 h-6 flex items-center justify-center border rounded-[4px] transition-all',
                style?.smallcaps
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
              )}
            >
              <CaseSensitive className="w-3 h-3" />
            </button>
          </div>
        </ControlField>

        <ControlField label="Line Height">
          <DesignerInput
            type="number"
            variant="mini"
            step="0.1"
            min={0.5}
            max={3}
            value={style?.lineHeight || 1.4}
            onChange={(v) => onUpdateStyle({ lineHeight: Number.parseFloat(v) || 1.4 })}
          />
        </ControlField>

        <ControlField label="Spacing">
          <DesignerInput
            type="text"
            variant="mini"
            value={style?.letterSpacing || '0pt'}
            onChange={(v) => onUpdateStyle({ letterSpacing: v })}
            mono
            placeholder="0.05em"
          />
        </ControlField>
      </PropertyGrid>

      {/* Advanced Typography Section */}
      <div className="mt-2 border-t border-[var(--border-default)] pt-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Advanced Settings</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-2 space-y-2 p-2 rounded bg-white/[0.01] border border-[var(--border-subtle)] animate-in fade-in duration-150">
            <PropertyGrid cols={2}>
              {/* Text Transform */}
              <ControlField label="Transform">
                <Select
                  value={style?.textTransform || 'none'}
                  onValueChange={(val) => onUpdateStyle({ textTransform: val })}
                >
                  <SelectTrigger className="w-full h-6 bg-[var(--bg-widget)] border-[var(--border-default)] text-[9.5px] hover:border-[var(--text-muted)] transition-all">
                    <SelectValue placeholder="Transform" />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]">
                    <SelectItem value="none" className="text-[10px]">
                      None
                    </SelectItem>
                    <SelectItem value="upper" className="text-[10px]">
                      Uppercase
                    </SelectItem>
                    <SelectItem value="lower" className="text-[10px]">
                      Lowercase
                    </SelectItem>
                    <SelectItem value="title" className="text-[10px]">
                      Capitalize
                    </SelectItem>
                  </SelectContent>
                </Select>
              </ControlField>

              {/* Hyphenation */}
              <ControlField label="Hyphenate">
                <button
                  type="button"
                  onClick={() => onUpdateStyle({ hyphenate: !style?.hyphenate })}
                  className={clsx(
                    'w-full h-6 flex items-center justify-center border rounded-[4px] text-[9px] font-bold transition-all',
                    style?.hyphenate
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
                  )}
                >
                  {style?.hyphenate ? 'Hyphenate: ON' : 'Hyphenate: OFF'}
                </button>
              </ControlField>
            </PropertyGrid>

            {/* Tabular Numbers & Vertical Alignment */}
            <PropertyGrid cols={2}>
              <ControlField label="Number Width">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStyle({
                      numberWidth: style?.numberWidth === 'tabular' ? 'proportional' : 'tabular',
                    })
                  }
                  className={clsx(
                    'w-full h-6 flex items-center justify-center border rounded-[4px] text-[9px] font-bold transition-all',
                    style?.numberWidth === 'tabular'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.08]'
                  )}
                >
                  {style?.numberWidth === 'tabular' ? 'Tabular' : 'Proportional'}
                </button>
              </ControlField>

              {allowBlockSettings ? (
                <ControlField label="Vertical Align" vertical={false} className="items-center">
                  <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden bg-[var(--bg-widget)] shrink-0 w-full">
                    {[
                      { id: 'top', label: 'Top' },
                      { id: 'middle', label: 'Mid' },
                      { id: 'bottom', label: 'Bot' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onUpdateStyle({ verticalAlign: item.id })}
                        className={clsx(
                          'flex-1 py-1 flex items-center justify-center transition-all h-5 text-[8.5px] font-bold',
                          (style?.verticalAlign || 'top') === item.id
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </ControlField>
              ) : (
                <div />
              )}
            </PropertyGrid>

            {/* Inline Highlight Color */}
            <PropertyGrid cols={1}>
              <ControlField label="Text Highlight">
                <div className="flex gap-1.5 items-center w-full">
                  <div className="flex-1">
                    <ColorPicker
                      color={style?.highlight || '#ffffff'}
                      onChange={(color) => onUpdateStyle({ highlight: color })}
                    />
                  </div>
                  {style?.highlight && (
                    <button
                      type="button"
                      onClick={() => onUpdateStyle({ highlight: undefined })}
                      className="h-6 px-2 text-[8px] font-bold text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded transition-all shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </ControlField>
            </PropertyGrid>

            {/* Text Stroke / Outline */}
            <PropertyGrid cols={2}>
              <ControlField label="Outline Color">
                <div className="flex gap-1.5 items-center w-full">
                  <div className="flex-1">
                    <ColorPicker
                      color={style?.strokeColor || '#ff0000'}
                      onChange={(color) => onUpdateStyle({ strokeColor: color })}
                    />
                  </div>
                  {style?.strokeColor && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStyle({ strokeColor: undefined, strokeWidth: undefined })
                      }
                      className="h-6 px-1.5 text-[8px] font-bold text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded transition-all shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </ControlField>

              <ControlField label="Outline Width">
                <DesignerInput
                  type="text"
                  variant="mini"
                  disabled={!style?.strokeColor}
                  value={style?.strokeWidth || '0.5pt'}
                  onChange={(v) => onUpdateStyle({ strokeWidth: v })}
                  placeholder="0.5pt"
                  mono
                />
              </ControlField>
            </PropertyGrid>

            {/* Block Background Settings */}
            {allowBlockSettings && (
              <>
                <div className="border-t border-dashed border-[var(--border-subtle)] my-1 pt-1.5 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Block Background
                </div>
                <PropertyGrid cols={1}>
                  <ControlField label="Fill Color">
                    <div className="flex gap-1.5 items-center w-full">
                      <div className="flex-1">
                        <ColorPicker
                          color={style?.background || '#ffffff'}
                          onChange={(color) => onUpdateStyle({ background: color })}
                        />
                      </div>
                      {style?.background && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateStyle({
                              background: undefined,
                              backgroundPadding: undefined,
                              backgroundRadius: undefined,
                            })
                          }
                          className="h-6 px-2 text-[8px] font-bold text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded transition-all shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </ControlField>
                </PropertyGrid>

                <PropertyGrid cols={2}>
                  <ControlField label="Padding">
                    <DesignerInput
                      type="text"
                      variant="mini"
                      disabled={!style?.background}
                      value={style?.backgroundPadding || '5pt'}
                      onChange={(v) => onUpdateStyle({ backgroundPadding: v })}
                      placeholder="5pt"
                      mono
                    />
                  </ControlField>

                  <ControlField label="Corner Radius">
                    <DesignerInput
                      type="text"
                      variant="mini"
                      disabled={!style?.background}
                      value={style?.backgroundRadius || '0pt'}
                      onChange={(v) => onUpdateStyle({ backgroundRadius: v })}
                      placeholder="4pt"
                      mono
                    />
                  </ControlField>
                </PropertyGrid>
              </>
            )}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

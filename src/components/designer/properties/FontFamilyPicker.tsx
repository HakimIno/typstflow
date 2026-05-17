'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useFontInstaller } from '@/hooks/use-font-installer';
import { CATEGORY_LABELS, FONT_CATALOG } from '@/lib/font-catalog';
import { fontManager } from '@/lib/font-manager';
import { clsx } from 'clsx';
import { Check, Download, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FontFamilyPickerProps {
  value: string;
  onChange: (family: string) => void;
  /** Show "— mixed —" placeholder when selected components have different fonts */
  mixed?: boolean;
}

function FontInstallPanel({
  onClose,
  anchorRect,
}: { onClose: () => void; anchorRect: DOMRect | null }) {
  const { installFont, installedFonts, loadingFonts } = useFontInstaller();
  const categories = ['thai', 'latin', 'mono'] as const;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!anchorRect) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: `${anchorRect.bottom + 6}px`,
        right: `${window.innerWidth - anchorRect.right}px`,
        zIndex: 9999,
      }}
      className="w-64 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-white/[0.02]">
        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-widest">
          Install Font
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[320px] p-1.5 space-y-2.5 custom-scrollbar">
        {categories.map((cat) => {
          const fonts = FONT_CATALOG.filter((f) => f.category === cat);
          return (
            <div key={cat} className="space-y-1">
              <div className="px-2 py-0.5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] opacity-50">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="space-y-px">
                {fonts.map((font) => {
                  const installed = installedFonts.some((f) => f.family === font.family);
                  const loading = loadingFonts.includes(font.family);
                  return (
                    <div
                      key={font.family}
                      className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-white/[0.03] group transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[11px] text-[var(--text-primary)] truncate"
                          style={{
                            fontFamily: installed
                              ? `${font.family}, Sarabun, sans-serif`
                              : 'inherit',
                          }}
                        >
                          {font.sampleText || font.label}
                        </div>
                        <div className="text-[8px] text-[var(--text-muted)] font-medium">
                          {font.label}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={installed || loading || font.builtIn}
                        onClick={() => installFont(font.family)}
                        className={clsx(
                          'ml-2 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all border',
                          installed || font.builtIn
                            ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'
                            : loading
                              ? 'text-[var(--text-muted)] cursor-wait border-transparent'
                              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/10'
                        )}
                        title={
                          font.builtIn
                            ? 'Built-in'
                            : installed
                              ? 'Installed'
                              : loading
                                ? 'Installing…'
                                : `Install ${font.label}`
                        }
                      >
                        {loading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : installed || font.builtIn ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

export function FontFamilyPicker({ value, onChange, mixed = false }: FontFamilyPickerProps) {
  const { installedFonts, loadingFonts, installFont } = useFontInstaller();
  const [showInstallPanel, setShowInstallPanel] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isLoadingCurrent = loadingFonts.includes(value);

  const handleChange = async (family: string) => {
    if (family === 'Sarabun' || fontManager.isWasmLoaded(family)) {
      onChange(family);
      return;
    }
    onChange(family); // optimistic
    await installFont(family);
  };

  const toggleInstallPanel = () => {
    if (!showInstallPanel && buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
    setShowInstallPanel((v) => !v);
  };

  return (
    <div className="relative flex items-center gap-1 w-full">
      <div className="relative flex-1">
        <Select
          value={mixed ? 'mixed-internal-value' : value || 'Sarabun'}
          onValueChange={handleChange}
        >
          <SelectTrigger
            className="w-full h-7 bg-[var(--bg-widget)] border-[var(--border-default)] text-[10px] text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
            style={{ fontFamily: mixed ? 'inherit' : `${value || 'Sarabun'}, Sarabun, sans-serif` }}
          >
            <SelectValue>
              {mixed ? <span className="opacity-50 italic">— mixed —</span> : value || 'Sarabun'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="z-[10000]">
            {mixed && (
              <SelectItem value="mixed-internal-value" disabled className="italic opacity-50">
                — mixed —
              </SelectItem>
            )}
            {installedFonts.map((font) => (
              <SelectItem
                key={font.family}
                value={font.family}
                style={{ fontFamily: `${font.family}, Sarabun, sans-serif` }}
                className="text-[11px]"
              >
                {font.family}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoadingCurrent && (
          <Loader2 className="absolute right-7 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-[var(--text-muted)] z-10" />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          ref={buttonRef}
          type="button"
          title="Install more fonts"
          onClick={toggleInstallPanel}
          className={clsx(
            'w-5 h-5 flex items-center justify-center rounded-[4px] border transition-all',
            showInstallPanel
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]'
              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
        {showInstallPanel && (
          <FontInstallPanel anchorRect={anchorRect} onClose={() => setShowInstallPanel(false)} />
        )}
      </div>
    </div>
  );
}

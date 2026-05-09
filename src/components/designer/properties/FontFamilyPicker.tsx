'use client';

import { useFontInstaller } from '@/hooks/use-font-installer';
import { CATEGORY_LABELS, FONT_CATALOG } from '@/lib/font-catalog';
import { fontManager } from '@/lib/font-manager';
import { clsx } from 'clsx';
import { Check, Download, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';

interface FontFamilyPickerProps {
  value: string;
  onChange: (family: string) => void;
  /** Show "— mixed —" placeholder when selected components have different fonts */
  mixed?: boolean;
}

function FontInstallPanel({ onClose }: { onClose: () => void }) {
  const { installFont, installedFonts, loadingFonts } = useFontInstaller();
  const categories = ['thai', 'latin', 'mono'] as const;

  return (
    <div className="absolute right-0 top-6 z-50 w-56 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[var(--border-default)]">
        <span className="text-[10px] font-semibold text-[var(--text-primary)] uppercase tracking-wide">
          Install Font
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="overflow-y-auto max-h-72 p-1 space-y-2">
        {categories.map((cat) => {
          const fonts = FONT_CATALOG.filter((f) => f.category === cat);
          return (
            <div key={cat}>
              <div className="px-1.5 py-0.5 text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </div>
              {fonts.map((font) => {
                const installed = installedFonts.some((f) => f.family === font.family);
                const loading = loadingFonts.includes(font.family);
                return (
                  <div
                    key={font.family}
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[10px] text-[var(--text-primary)] truncate"
                        style={{
                          fontFamily: installed ? `${font.family}, Sarabun, sans-serif` : 'inherit',
                        }}
                      >
                        {font.sampleText || font.label}
                      </div>
                      <div className="text-[8px] text-[var(--text-muted)]">{font.label}</div>
                    </div>
                    <button
                      type="button"
                      disabled={installed || loading || font.builtIn}
                      onClick={() => installFont(font.family)}
                      className={clsx(
                        'ml-1.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-all',
                        installed || font.builtIn
                          ? 'text-green-500'
                          : loading
                            ? 'text-[var(--text-muted)] cursor-wait'
                            : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'
                      )}
                      title={
                        font.builtIn ? 'Built-in' : installed ? 'Installed' : loading ? 'Installing…' : `Install ${font.label}`
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
          );
        })}
      </div>
    </div>
  );
}

export function FontFamilyPicker({ value, onChange, mixed = false }: FontFamilyPickerProps) {
  const { installedFonts, loadingFonts, installFont } = useFontInstaller();
  const [showInstallPanel, setShowInstallPanel] = useState(false);

  const isLoadingCurrent = loadingFonts.includes(value);

  const handleChange = async (family: string) => {
    if (family === 'Sarabun' || fontManager.isWasmLoaded(family)) {
      onChange(family);
      return;
    }
    onChange(family); // optimistic
    await installFont(family);
  };

  return (
    <div className="relative flex items-center gap-1 w-full">
      <div className="relative flex-1">
        <select
          value={mixed ? '' : value || 'Sarabun'}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-[var(--bg-widget)] border border-[var(--border-default)] text-[10px] text-[var(--text-primary)] rounded-[4px] px-1.5 py-1 pr-6 focus:outline-none focus:border-[var(--accent)]"
          style={{ fontFamily: mixed ? 'inherit' : `${value || 'Sarabun'}, Sarabun, sans-serif` }}
        >
          {mixed && (
            <option value="" disabled>
              — mixed —
            </option>
          )}
          {installedFonts.map((font) => (
            <option
              key={font.family}
              value={font.family}
              style={{ fontFamily: `${font.family}, Sarabun, sans-serif` }}
            >
              {font.family}
            </option>
          ))}
        </select>
        {isLoadingCurrent && (
          <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-[var(--text-muted)]" />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <button
          type="button"
          title="Install more fonts"
          onClick={() => setShowInstallPanel((v) => !v)}
          className={clsx(
            'w-5 h-5 flex items-center justify-center rounded-[4px] border transition-all',
            showInstallPanel
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          )}
        >
          <Plus className="w-3 h-3" />
        </button>
        {showInstallPanel && <FontInstallPanel onClose={() => setShowInstallPanel(false)} />}
      </div>
    </div>
  );
}

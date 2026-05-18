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
import { useDesignerStore } from '@/store/designer-store';
import { readFontFamily } from '@/lib/utils/font-parser';
import { clsx } from 'clsx';
import { Check, Download, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FontFamilyPickerProps {
  value: string;
  onChange: (family: string) => void;
  /** Show "— mixed —" placeholder when selected components have different fonts */
  mixed?: boolean;
}

interface PendingFont {
  id: string;
  file: File;
  familyName: string;
  weight: number;
  style?: 'normal' | 'italic';
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

const guessFamilyAndWeight = (fileName: string) => {
  const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

  // Clean suffixes like _Rg, _Bd, -Bold, -Regular, etc.
  const cleanName = baseName
    .replace(
      /[_-](rg|bd|xbd|he|th|thin|light|bold|regular|heavy|medium|semibold|blk|black|extra|book)$/i,
      ''
    )
    .replace(/[_-](Regular|Bold|Thin|Light|Medium|SemiBold|Heavy|Black|ExtraBold|Extra|Book)$/i, '')
    .replace(/[_-]+[A-Za-z0-9]+$/, (match) => {
      const suffix = match.substring(1).toLowerCase();
      const suffixesToStrip = [
        'rg',
        'bd',
        'xbd',
        'he',
        'th',
        'lt',
        'md',
        'sb',
        'regular',
        'bold',
        'thin',
        'heavy',
        'black',
      ];
      return suffixesToStrip.includes(suffix) ? '' : match;
    })
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .trim();

  // Guess weight
  let guessedWeight = 400; // default
  const lowerBase = baseName.toLowerCase();

  if (lowerBase.includes('thin') || lowerBase.endsWith('_th') || lowerBase.endsWith('-th')) {
    guessedWeight = 100;
  } else if (
    lowerBase.includes('light') ||
    lowerBase.endsWith('_lt') ||
    lowerBase.endsWith('-lt')
  ) {
    guessedWeight = 300;
  } else if (
    lowerBase.includes('semibold') ||
    lowerBase.endsWith('_sb') ||
    lowerBase.endsWith('-sb')
  ) {
    guessedWeight = 600;
  } else if (
    lowerBase.includes('bold') ||
    lowerBase.endsWith('_bd') ||
    lowerBase.endsWith('-bd') ||
    lowerBase.endsWith('_xbd') ||
    lowerBase.endsWith('-xbd')
  ) {
    guessedWeight = 700;
  } else if (
    lowerBase.includes('heavy') ||
    lowerBase.includes('black') ||
    lowerBase.endsWith('_he') ||
    lowerBase.endsWith('-he') ||
    lowerBase.endsWith('_blk') ||
    lowerBase.endsWith('-blk')
  ) {
    guessedWeight = 900;
  } else if (
    lowerBase.includes('medium') ||
    lowerBase.endsWith('_md') ||
    lowerBase.endsWith('-md')
  ) {
    guessedWeight = 500;
  }

  return { familyName: cleanName, weight: guessedWeight };
};

function FontInstallPanel({
  onClose,
  anchorRect,
}: { onClose: () => void; anchorRect: DOMRect | null }) {
  const { installFont, installedFonts, loadingFonts, customFonts } = useFontInstaller();
  const categories = ['thai', 'latin', 'mono'] as const;
  const panelRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'system' | 'corporate'>('system');
  const [pendingFonts, setPendingFonts] = useState<PendingFont[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const addCustomFont = useDesignerStore((s) => s.addCustomFont);
  const removeCustomFontFromStore = useDesignerStore((s) => s.removeCustomFontFromStore);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFilesSelected(Array.from(files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesSelected(Array.from(files));
    }
  };

  const handleFilesSelected = async (selectedFiles: File[]) => {
    const validFonts: PendingFont[] = [];
    let hasInvalid = false;

    for (const f of selectedFiles) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.ttf' && ext !== '.otf') {
        hasInvalid = true;
        continue;
      }

      let exactName = '';
      try {
        const buf = await f.arrayBuffer();
        const parsed = readFontFamily(buf);
        if (parsed) exactName = parsed;
      } catch (err) {
        console.error('[FontFamilyPicker] Failed to parse font client-side:', err);
      }

      if (!exactName) {
        const { familyName } = guessFamilyAndWeight(f.name);
        exactName = familyName;
      }

      const { weight: guessedWeight } = guessFamilyAndWeight(f.name);

      // Guess italic style
      const lowerName = f.name.toLowerCase();
      const isItalic =
        lowerName.includes('italic') ||
        lowerName.includes('oblique') ||
        lowerName.endsWith('it') ||
        lowerName.includes('-it') ||
        lowerName.includes('_it');
      const guessedStyle = isItalic ? 'italic' : 'normal';

      validFonts.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        familyName: exactName,
        weight: guessedWeight,
        style: guessedStyle,
        status: 'idle',
      });
    }

    if (hasInvalid) {
      setUploadError('Some files were skipped. Only .ttf and .otf are supported.');
    } else {
      setUploadError(null);
    }

    if (validFonts.length > 0) {
      setPendingFonts((prev) => [...prev, ...validFonts]);
    }
  };

  const handleUploadBatch = async () => {
    if (pendingFonts.length === 0) return;

    const fontsToUpload = pendingFonts.filter((f) => f.status === 'idle' || f.status === 'error');
    if (fontsToUpload.length === 0) return;

    setPendingFonts((prev) =>
      prev.map((pf) =>
        pf.status === 'idle' || pf.status === 'error' ? { ...pf, status: 'uploading' } : pf
      )
    );

    await Promise.all(
      fontsToUpload.map(async (font) => {
        const formData = new FormData();
        formData.append('file', font.file);
        formData.append('family', font.familyName.trim());
        formData.append('weight', String(font.weight));
        if (font.style) {
          formData.append('style', font.style);
        }

        try {
          const res = await fetch('/api/fonts/custom', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Upload failed');
          }

          const newFont = await res.json();
          addCustomFont(newFont);
          await installFont(newFont.family);

          setPendingFonts((prev) =>
            prev.map((pf) => (pf.id === font.id ? { ...pf, status: 'success' } : pf))
          );
        } catch (e: any) {
          const errMsg = e.message || 'Failed to upload.';
          setPendingFonts((prev) =>
            prev.map((pf) => (pf.id === font.id ? { ...pf, status: 'error', error: errMsg } : pf))
          );
        }
      })
    );
  };

  const handleDeleteCustom = async (id: string, family: string) => {
    if (confirm(`Are you sure you want to delete the corporate font "${family}"?`)) {
      try {
        const res = await fetch(`/api/fonts/custom?id=${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          removeCustomFontFromStore(id);
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to delete font');
        }
      } catch (e) {
        console.error('Delete custom font failed:', e);
      }
    }
  };

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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-white/[0.02]">
        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-widest">
          Manage Fonts
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-default)] bg-white/[0.01]">
        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={clsx(
            'flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-center transition-all border-b-2 outline-none',
            activeTab === 'system'
              ? 'border-[var(--accent)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          System Fonts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('corporate')}
          className={clsx(
            'flex-1 py-1.5 text-[9px] font-bold uppercase tracking-wider text-center transition-all border-b-2 outline-none',
            activeTab === 'corporate'
              ? 'border-[var(--accent)] text-[var(--text-primary)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
        >
          Corporate Fonts
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[320px] custom-scrollbar">
        {activeTab === 'system' && (
          <div className="p-1 space-y-1">
            {categories.map((cat) => {
              const fonts = FONT_CATALOG.filter((f) => f.category === cat);
              return (
                <div key={cat} className="space-y-0">
                  <div className="px-2 py-0 text-[8px] font-black text-[var(--text-muted)]">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="space-y-px">
                    {fonts.map((font) => {
                      const installed = installedFonts.some((f) => f.family === font.family);
                      const loading = loadingFonts.includes(font.family);
                      return (
                        <div
                          key={font.family}
                          className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.03] group transition-all"
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
                          {loading ? (
                            <button
                              type="button"
                              disabled
                              className="ml-2 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-transparent text-[var(--text-muted)] cursor-wait"
                              title="Installing…"
                            >
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            </button>
                          ) : installed || font.builtIn ? null : (
                            <button
                              type="button"
                              onClick={() => installFont(font.family)}
                              className="ml-2 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-all border text-[var(--text-muted)] border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/10"
                              title={`Install ${font.label}`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'corporate' && (
          <div className="p-2 space-y-3">
            {/* Upload Zone */}
            {pendingFonts.length === 0 ? (
              // biome-ignore lint/a11y/useKeyWithClickEvents: Click triggers file input upload
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={clsx(
                  'flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-lg transition-all text-center cursor-pointer',
                  isDragOver
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-98 shadow-[0_0_12px_rgba(var(--accent-rgb),0.15)]'
                    : 'border-[var(--border-default)] hover:border-[var(--text-muted)] bg-white/[0.01]'
                )}
                onClick={() => document.getElementById('custom-font-upload-input')?.click()}
              >
                <input
                  type="file"
                  id="custom-font-upload-input"
                  accept=".ttf,.otf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="w-5 h-5 text-[var(--text-muted)] mb-1" />
                <span className="text-[10px] font-semibold text-[var(--text-primary)]">
                  Upload Corporate Fonts
                </span>
                <span className="text-[8px] text-[var(--text-muted)] mt-0.5">
                  Drag & drop multiple .ttf or .otf files
                </span>
              </div>
            ) : (
              <div className="p-2 border border-[var(--border-default)] rounded-lg bg-white/[0.02] space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)]">
                  <span className="font-bold text-[8px] uppercase tracking-wider text-[var(--text-muted)]">
                    Pending Fonts ({pendingFonts.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFonts([]);
                      setUploadError(null);
                    }}
                    className="text-[var(--text-muted)] hover:text-red-400"
                  >
                    Clear All
                  </button>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                  {pendingFonts.map((font) => (
                    <div
                      key={font.id}
                      className="p-1.5 border border-[var(--border-default)] rounded bg-white/[0.01] space-y-1 animate-in fade-in slide-in-from-top-1 duration-150"
                    >
                      <div className="flex items-center justify-between text-[8px] text-[var(--text-muted)]">
                        <span className="truncate max-w-[170px] font-mono text-[7px] bg-white/5 px-1 py-0.5 rounded">
                          {font.file.name}
                        </span>
                        {font.status === 'idle' && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFonts((prev) => prev.filter((pf) => pf.id !== font.id))
                            }
                            className="hover:text-red-400 text-[8px]"
                          >
                            Cancel
                          </button>
                        )}
                        {font.status === 'uploading' && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-[var(--accent)]" />
                        )}
                        {font.status === 'success' && (
                          <Check className="w-2.5 h-2.5 text-emerald-400 font-bold" />
                        )}
                        {font.status === 'error' && (
                          <span
                            className="text-[7px] text-red-400 font-medium truncate max-w-[60px]"
                            title={font.error}
                          >
                            Err: {font.error}
                          </span>
                        )}
                      </div>

                      {font.status === 'idle' && (
                        <div className="grid grid-cols-6 gap-1 pt-0.5">
                          <input
                            type="text"
                            value={font.familyName}
                            onChange={(e) =>
                              setPendingFonts((prev) =>
                                prev.map((pf) =>
                                  pf.id === font.id ? { ...pf, familyName: e.target.value } : pf
                                )
                              )
                            }
                            className="col-span-3 h-5 px-1.5 rounded border border-[var(--border-default)] bg-[var(--bg-widget)] text-[9px] text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                            placeholder="Family Name"
                          />
                          <select
                            value={font.weight}
                            onChange={(e) =>
                              setPendingFonts((prev) =>
                                prev.map((pf) =>
                                  pf.id === font.id ? { ...pf, weight: Number(e.target.value) } : pf
                                )
                              )
                            }
                            className="col-span-2 h-5 px-1 rounded border border-[var(--border-default)] bg-[var(--bg-widget)] text-[8px] text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                          >
                            <option value="100">Thin (100)</option>
                            <option value="200">ExtraLight (200)</option>
                            <option value="300">Light (300)</option>
                            <option value="400">Regular (400)</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semibold (600)</option>
                            <option value="700">Bold (700)</option>
                            <option value="800">ExtraBold (800)</option>
                            <option value="900">Heavy (900)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingFonts((prev) =>
                                prev.map((pf) =>
                                  pf.id === font.id
                                    ? { ...pf, style: pf.style === 'italic' ? 'normal' : 'italic' }
                                    : pf
                                )
                              )
                            }
                            className={clsx(
                              'col-span-1 h-5 flex items-center justify-center border rounded text-[7.5px] font-bold transition-all italic',
                              font.style === 'italic'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-[var(--bg-widget)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-white/[0.05]'
                            )}
                            title="Toggle Italic style"
                          >
                            I
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {uploadError && (
                  <div className="text-[8px] text-red-400 bg-red-500/5 border border-red-500/10 px-1.5 py-1 rounded">
                    {uploadError}
                  </div>
                )}

                {pendingFonts.some((f) => f.status === 'idle' || f.status === 'error') ? (
                  <button
                    type="button"
                    onClick={handleUploadBatch}
                    className="w-full h-6 flex items-center justify-center gap-1 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[9px] font-bold transition-all shadow-[0_2px_8px_rgba(var(--accent-rgb),0.2)]"
                  >
                    Register Batch (
                    {pendingFonts.filter((f) => f.status === 'idle' || f.status === 'error').length}{' '}
                    Fonts)
                  </button>
                ) : pendingFonts.every((f) => f.status === 'success') ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFonts([]);
                      setUploadError(null);
                    }}
                    className="w-full h-6 flex items-center justify-center gap-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-bold transition-all"
                  >
                    Done & Clear
                  </button>
                ) : null}
              </div>
            )}

            {/* Custom Fonts List */}
            <div className="space-y-1">
              <div className="px-1 py-0.5 text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] opacity-50">
                Corporate Registry
              </div>

              {customFonts.length === 0 ? (
                <div className="text-center py-4 text-[9px] text-[var(--text-muted)] italic bg-white/[0.01] border border-[var(--border-default)] rounded-md">
                  No corporate fonts uploaded yet
                </div>
              ) : (
                <div className="space-y-px max-h-[160px] overflow-y-auto custom-scrollbar border border-[var(--border-default)] rounded-md bg-white/[0.01]">
                  {customFonts.map((font) => {
                    const installed = installedFonts.some(
                      (f) => f.family === font.family && fontManager.isWasmLoaded(font.family)
                    );
                    const loading = loadingFonts.includes(font.family);

                    return (
                      <div
                        key={font.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-white/[0.02] group transition-all border-b border-[var(--border-default)] last:border-b-0"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div
                            className="text-[10px] text-[var(--text-primary)] truncate font-medium"
                            style={{
                              fontFamily: installed
                                ? `${font.family}, Sarabun, sans-serif`
                                : 'inherit',
                            }}
                          >
                            {font.family}
                          </div>
                          <div className="text-[7.5px] text-[var(--text-muted)] flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className="font-semibold text-zinc-300">
                                {font.weight === 100
                                  ? 'Thin'
                                  : font.weight === 200
                                    ? 'Extra Light'
                                    : font.weight === 300
                                      ? 'Light'
                                      : font.weight === 400
                                        ? 'Regular'
                                        : font.weight === 500
                                          ? 'Medium'
                                          : font.weight === 600
                                            ? 'Semi Bold'
                                            : font.weight === 700
                                              ? 'Bold'
                                              : font.weight === 800
                                                ? 'Extra Bold'
                                                : font.weight === 900
                                                  ? 'Black'
                                                  : `Weight ${font.weight}`}
                              </span>
                              <span>({font.weight})</span>
                              {font.style === 'italic' && (
                                <span className="px-1 py-[1px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold rounded text-[6.5px] uppercase tracking-wider italic shrink-0">
                                  Italic
                                </span>
                              )}
                            </span>
                            <span className="opacity-30">•</span>
                            <span className="truncate max-w-[90px]">{font.fileName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Install Button */}
                          <button
                            type="button"
                            disabled={installed || loading}
                            onClick={() => installFont(font.family)}
                            className={clsx(
                              'w-5 h-5 flex items-center justify-center rounded-full border transition-all',
                              installed
                                ? 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5'
                                : loading
                                  ? 'text-[var(--text-muted)] cursor-wait border-transparent'
                                  : 'text-[var(--text-muted)] border-transparent hover:text-[var(--accent)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/10'
                            )}
                            title={
                              installed ? 'Installed' : loading ? 'Installing...' : 'Install Font'
                            }
                          >
                            {loading ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : installed ? (
                              <Check className="w-2.5 h-2.5" />
                            ) : (
                              <Download className="w-2.5 h-2.5" />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(font.id, font.family)}
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-transparent text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/10 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Font"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
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

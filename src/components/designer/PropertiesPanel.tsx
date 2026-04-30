import { useDesignerStore } from '@/store/designer-store';
import type {
  BarcodeComponent,
  ComponentNode,
  ImageComponent,
  QRComponent,
  TableComponent,
  TextComponent,
} from '@/types/schema';
import { clsx } from 'clsx';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  FileDown,
  FileText,
  ImageIcon,
  Layers,
  Link,
  Loader2,
  Sliders,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { DesignerInput } from '../shared/DesignerInput';
import { TablePropertiesPanel } from './TablePropertiesPanel';
import { TextEditor } from './TextEditor';
import { VariablePicker } from './VariablePicker';

// ---------------------------------------------------------------------------
// Shared UI Primitives (Defined outside to prevent focus loss)
// ---------------------------------------------------------------------------
const PropertyRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-white/[0.02] group transition-colors">
    <div className="w-1/3 px-3 py-2 text-[10px] font-medium text-[var(--text-secondary)] bg-white/[0.01] border-r border-[var(--border-default)] flex items-center shrink-0">
      {label}
    </div>
    <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">{children}</div>
  </div>
);

const SectionHeader = ({ label }: { label: string }) => (
  <div className="px-3 py-1.5 bg-white/[0.03] border-b border-[var(--border-default)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em]">
    {label}
  </div>
);

// Type guards for safe component access
const isText = (c: ComponentNode): c is TextComponent => c.type === 'text';
const isTable = (c: ComponentNode): c is TableComponent => c.type === 'table';
const isImage = (c: ComponentNode): c is ImageComponent => c.type === 'image';
const isBarcode = (c: ComponentNode): c is BarcodeComponent =>
  c.type === 'barcode' || c.type === 'qr';

// ---------------------------------------------------------------------------
// ImageUploader — handles local file upload and URL fetch
// ---------------------------------------------------------------------------
function ImageUploader({
  component,
  onUpdate,
}: {
  component: ImageComponent;
  onUpdate: (updates: Partial<ImageComponent>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(component.src?.startsWith('http') ? component.src : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upload' | 'url'>('upload');

  const previewSrc = component.srcData || (component.src?.startsWith('http') ? '' : '');

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > 8 * 1024 * 1024) {
        setError('File too large (max 8 MB)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const mimeType = file.type || 'image/png';
        onUpdate({ src: file.name, srcData: dataUrl, mimeType });
      };
      reader.onerror = () => setError('Failed to read file');
      reader.readAsDataURL(file);
    },
    [onUpdate]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) handleFile(file);
    },
    [handleFile]
  );

  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL is not an image');
      if (blob.size > 8 * 1024 * 1024) throw new Error('Image too large (max 8 MB)');
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUpdate({ src: url, srcData: dataUrl, mimeType: blob.type });
        setLoading(false);
      };
      reader.onerror = () => {
        setError('Failed to decode image');
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setError(err.message || 'Failed to load URL');
      setLoading(false);
    }
  }, [urlInput, onUpdate]);

  const handleClear = useCallback(() => {
    onUpdate({ src: '', srcData: undefined, mimeType: undefined });
    setUrlInput('');
    setError(null);
  }, [onUpdate]);

  return (
    <div className="border-b border-[var(--border-default)]">
      {/* Tab switcher */}
      <div className="flex border-b border-[var(--border-default)]">
        {(['upload', 'url'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all',
              tab === t
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white/[0.02] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            {t === 'upload' ? <Upload className="w-2.5 h-2.5" /> : <Link className="w-2.5 h-2.5" />}
            {t === 'upload' ? 'Upload' : 'URL'}
          </button>
        ))}
      </div>

      {/* Preview */}
      {previewSrc ? (
        <div
          className="relative mx-3 my-2 rounded border border-[var(--border-default)] overflow-hidden bg-white/[0.02]"
          style={{ height: 80 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt="preview" className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-all"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mx-3 my-2 rounded border-2 border-dashed border-[var(--border-default)] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[var(--border-accent)] hover:bg-[var(--accent-glow)] transition-all"
          style={{ height: 64 }}
          onClick={() => tab === 'upload' && fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && tab === 'upload' && fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
            No Image
          </span>
        </button>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div className="px-3 pb-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border-default)] rounded text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider transition-all"
          >
            <Upload className="w-3 h-3" />
            Browse file…
          </button>
          <p className="mt-1 text-[8px] text-slate-300 text-center">PNG, JPG, WebP — max 8 MB</p>
        </div>
      )}

      {/* URL tab */}
      {tab === 'url' && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="flex gap-1">
            <DesignerInput
              type="url"
              value={urlInput}
              onChange={(v) => setUrlInput(v)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
              placeholder="https://example.com/logo.png"
              className="flex-1 font-mono text-[9px]"
            />
            <button
              type="button"
              onClick={handleUrlLoad}
              disabled={loading || !urlInput.trim()}
              className="flex items-center gap-1 px-2 h-6 bg-[var(--accent)] hover:bg-[var(--accent)]/80 disabled:opacity-40 text-white text-[9px] font-bold rounded transition-all"
            >
              {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Load'}
            </button>
          </div>
          {error && <p className="text-[8px] text-red-500 font-medium">{error}</p>}
        </div>
      )}
    </div>
  );
}

export const PropertiesPanel = memo(function PropertiesPanel() {
  // Select state with proper memoization - avoid selecting entire schema
  const selectedComponentIds = useDesignerStore((state) => state.selectedComponentIds);
  const zones = useDesignerStore((state) => state.schema.zones);
  const _page = useDesignerStore((state) => state.schema.page);
  const fullSchema = useDesignerStore((state) => state.schema);
  const selectedZone = useDesignerStore((state) => state.selectedZone);
  const sampleData = useDesignerStore((state) => state.sampleData);

  // Select actions separately (they don't change)
  const updateSchema = useDesignerStore((state) => state.updateSchema);
  const updateComponent = useDesignerStore((state) => state.updateComponent);
  const updateZone = useDesignerStore((state) => state.updateZone);
  const removeComponent = useDesignerStore((state) => state.removeComponent);

  // Find first selected component with memoization
  const selectedComponent = useMemo(() => {
    if (selectedComponentIds.length === 0) return null;
    const firstId = selectedComponentIds[0];
    for (const zone of Object.values(zones)) {
      const found = zone.components.find((c) => c.id === firstId);
      if (found) return found;
    }
    return null;
  }, [selectedComponentIds, zones]);

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="h-8 min-h-[32px] bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Report Settings</span>
        </div>
        <div className="flex-1 overflow-auto border-l border-[var(--border-default)]">
          <section>
            <div className="px-3 py-1.5 bg-[var(--bg-widget)] border-b border-[var(--border-default)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Page Configuration
            </div>
            <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] group transition-colors">
              <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-widget)] border-r border-[var(--border-default)] flex items-center shrink-0">
                Paper Size
              </div>
              <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                <select
                  value={fullSchema.page.size}
                  onChange={(e) =>
                    updateSchema({ page: { ...fullSchema.page, size: e.target.value as any } })
                  }
                  className="pro-input h-6 px-1 w-full text-[11px] outline-none"
                >
                  <option value="A4" className="bg-[var(--bg-surface)]">
                    A4
                  </option>
                  <option value="A5" className="bg-[var(--bg-surface)]">
                    A5
                  </option>
                  <option value="Letter" className="bg-[var(--bg-surface)]">
                    Letter
                  </option>
                  <option value="Legal" className="bg-[var(--bg-surface)]">
                    Legal
                  </option>
                </select>
              </div>
            </div>
            <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] group transition-colors">
              <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-widget)] border-r border-[var(--border-default)] flex items-center shrink-0">
                Orientation
              </div>
              <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                <select
                  value={fullSchema.page.orientation}
                  onChange={(e) =>
                    updateSchema({
                      page: { ...fullSchema.page, orientation: e.target.value as any },
                    })
                  }
                  className="pro-input h-6 px-1 w-full text-[11px] outline-none"
                >
                  <option value="portrait" className="bg-[var(--bg-surface)]">
                    Portrait
                  </option>
                  <option value="landscape" className="bg-[var(--bg-surface)]">
                    Landscape
                  </option>
                </select>
              </div>
            </div>
            <div className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] group transition-colors">
              <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-widget)] border-r border-[var(--border-default)] flex items-center shrink-0">
                Total Pages
              </div>
              <div className="flex-1 px-2 py-1.5 flex items-center gap-2 overflow-hidden">
                <DesignerInput
                  type="number"
                  min={1}
                  max={100}
                  value={(fullSchema.pages || []).length}
                  onChange={(v) => useDesignerStore.getState().setPageCount(Number.parseInt(v) || 1)}
                  mono
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => useDesignerStore.getState().setPageCount((fullSchema.pages || []).length - 1)}
                    className="w-6 h-6 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.1] border border-[var(--border-default)] rounded-full text-[12px] font-bold text-[var(--text-muted)]"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => useDesignerStore.getState().setPageCount((fullSchema.pages || []).length + 1)}
                    className="w-6 h-6 flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white rounded-full text-[12px] font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>
          <section>
            <div className="px-3 py-1.5 bg-[var(--bg-widget)] border-b border-[var(--border-default)] text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
              Margins
            </div>
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div
                key={side}
                className="flex border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] group transition-colors"
              >
                <div className="w-1/3 px-3 py-2 text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-widget)] border-r border-[var(--border-default)] flex items-center shrink-0 capitalize">
                  {side}
                </div>
                <div className="flex-1 px-2 py-1.5 flex items-center overflow-hidden">
                  <DesignerInput
                    type="text"
                    value={fullSchema.page.margin[side]}
                    onChange={(v) =>
                      updateSchema({
                        page: {
                          ...fullSchema.page,
                          margin: { ...fullSchema.page.margin, [side]: v },
                        },
                      })
                    }
                    mono
                    placeholder="15mm"
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    );
  }

  // Handle Multiple Selection View
  if (selectedComponentIds.length > 1) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="h-8 bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Group Selection</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-glow)] flex items-center justify-center mb-4 border border-[var(--border-accent)]">
            <Layers className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
            {selectedComponentIds.length} objects selected
          </h3>
          <p className="text-[10px] text-[var(--text-muted)] mb-6">
            Multiple items are currently selected. Actions will apply to all items in the selection.
          </p>

          <button
            type="button"
            onClick={() => {
              for (const id of selectedComponentIds) removeComponent(id);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded transition-all text-[11px] font-bold uppercase tracking-wider"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Selected
          </button>
        </div>
      </div>
    );
  }

  // Validation helpers
  const handleNumericUpdate = (key: keyof ComponentNode, value: string) => {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      updateComponent(selectedComponent.id, { [key]: num });
    }
  };

  const handleStyleUpdate = (updates: any) => {
    const currentStyle = (selectedComponent as any).style || {};
    updateComponent(selectedComponent.id, {
      style: { ...currentStyle, ...updates },
    } as any);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      <div className="h-8 min-h-[32px] bg-white/[0.02] text-[var(--text-primary)] border-b border-[var(--border-default)] flex items-center px-3 gap-2">
        <Sliders className="w-3 h-3 text-[var(--text-muted)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Properties Inspector</span>
      </div>

      <div className="flex-1 overflow-auto border-l border-[var(--border-default)]">
        <section>
          <SectionHeader label="Identification" />
          <PropertyRow label="Object ID">
            <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              {selectedComponent.id}
            </span>
          </PropertyRow>
          <PropertyRow label="Type">
            <span className="text-[11px] font-bold text-[var(--accent)] uppercase">
              {selectedComponent.type}
            </span>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Content & Binding" />
          {isText(selectedComponent) && (
            <div className="flex flex-col border-b border-[var(--border-default)]">
              <div className="px-3 py-1 flex items-center justify-between text-[10px] bg-white/[0.01]">
                <span className="font-bold text-[var(--text-secondary)] uppercase tracking-tighter">
                  Text Content
                </span>
                <VariablePicker
                  sampleData={sampleData}
                  onSelect={(_path, binding) => {
                    const currentContent = selectedComponent.content || '';
                    updateComponent(selectedComponent.id, { content: currentContent + binding });
                  }}
                />
              </div>
              <TextEditor
                value={selectedComponent.content || ''}
                onChange={(value) => updateComponent(selectedComponent.id, { content: value })}
                sampleData={sampleData}
                placeholder="Type static text or {{binding}}..."
                className="bg-transparent"
              />
            </div>
          )}
          {isTable(selectedComponent) && (
            <div className="space-y-0 text-[10px]">
              <PropertyRow label="Data Source">
                <DesignerInput
                  type="text"
                  value={selectedComponent.dataSource || ''}
                  onChange={(v) => updateComponent(selectedComponent.id, { dataSource: v })}
                  mono
                  placeholder="{{path.to.array}}"
                />
              </PropertyRow>
              <PropertyRow label="Header Rows">
                <DesignerInput
                  type="number"
                  min={0}
                  max={5}
                  value={selectedComponent.style?.headerRows ?? 1}
                  onChange={(v) => handleStyleUpdate({ headerRows: Number.parseInt(v) || 0 })}
                />
              </PropertyRow>
            </div>
          )}
          {isBarcode(selectedComponent) && (
            <PropertyRow label="Value">
              <DesignerInput
                type="text"
                value={(selectedComponent as BarcodeComponent | QRComponent).value || ''}
                onChange={(v) => updateComponent(selectedComponent.id, { value: v })}
                mono
                placeholder="{{item.id}}"
              />
            </PropertyRow>
          )}
          {isImage(selectedComponent) && (
            <ImageUploader
              component={selectedComponent}
              onUpdate={(updates) => updateComponent(selectedComponent.id, updates as any)}
            />
          )}
        </section>

        {(isText(selectedComponent) || isTable(selectedComponent)) && (
          <section>
            <SectionHeader label="Typography" />
            <PropertyRow label="Font Size (pt)">
              <DesignerInput
                type="number"
                min={1}
                max={200}
                value={selectedComponent.style?.fontSize || 10}
                onChange={(v) => handleStyleUpdate({ fontSize: Number.parseInt(v) || 10 })}
              />
            </PropertyRow>
            <PropertyRow label="Line Height">
              <DesignerInput
                type="number"
                step="0.1"
                min={0.5}
                max={3}
                value={selectedComponent.style?.lineHeight || 1.2}
                onChange={(v) => handleStyleUpdate({ lineHeight: Number.parseFloat(v) || 1.2 })}
              />
            </PropertyRow>
            <PropertyRow label="Spacing (em)">
              <DesignerInput
                type="text"
                value={selectedComponent.style?.letterSpacing || '0pt'}
                onChange={(v) => handleStyleUpdate({ letterSpacing: v })}
                mono
                placeholder="0.05em"
              />
            </PropertyRow>
            <PropertyRow label="Weight">
              <button
                type="button"
                onClick={() =>
                  handleStyleUpdate({
                    fontWeight: selectedComponent.style?.fontWeight === 'bold' ? 'regular' : 'bold',
                  })
                }
                className={clsx(
                  'px-2 py-0.5 border text-[10px] font-bold transition-all',
                  selectedComponent.style?.fontWeight === 'bold'
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-white/[0.04] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                )}
              >
                <Bold className="w-3 h-3" />
              </button>
            </PropertyRow>
          </section>
        )}

        {isImage(selectedComponent) && (
          <section>
            <SectionHeader label="Image Settings" />
            <PropertyRow label="Fit Mode">
              <select
                value={selectedComponent.fit || 'contain'}
                onChange={(e) =>
                  updateComponent(selectedComponent.id, { fit: e.target.value as any })
                }
                className="pro-input h-6 px-1 w-full text-[11px] outline-none"
              >
                <option value="contain" className="bg-[var(--bg-surface)]">
                  Contain
                </option>
                <option value="cover" className="bg-[var(--bg-surface)]">
                  Cover
                </option>
                <option value="stretch" className="bg-[var(--bg-surface)]">
                  Stretch
                </option>
              </select>
            </PropertyRow>
          </section>
        )}

        {isTable(selectedComponent) && <TablePropertiesPanel component={selectedComponent} />}

        <section>
          <SectionHeader label="Alignment" />
          <PropertyRow label="Horizontal">
            <div className="flex border border-[var(--border-default)] rounded-[4px] overflow-hidden w-full bg-white/[0.02]">
              {[
                { id: 'left', icon: AlignLeft },
                { id: 'center', icon: AlignCenter },
                { id: 'right', icon: AlignRight },
                { id: 'justify', icon: AlignJustify },
              ].map((align) => (
                <button
                  key={align.id}
                  type="button"
                  onClick={() => {
                    updateComponent(selectedComponent.id, { align: align.id as any });
                    if (align.id === 'justify' && isText(selectedComponent)) {
                      handleStyleUpdate({ justify: true });
                    } else if (isText(selectedComponent)) {
                      handleStyleUpdate({ justify: false });
                    }
                  }}
                  className={clsx(
                    'flex-1 py-1 flex items-center justify-center transition-all',
                    selectedComponent.align === align.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  <align.icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          </PropertyRow>
        </section>

        <section>
          <SectionHeader label="Geometry (mm)" />
          <div className="grid grid-cols-2">
            <PropertyRow label="X Pos">
              <DesignerInput
                type="number"
                step="1"
                value={selectedComponent.x || 0}
                onChange={(v) => handleNumericUpdate('x', v)}
              />
            </PropertyRow>
            <PropertyRow label="Y Pos">
              <DesignerInput
                type="number"
                step="1"
                value={selectedComponent.y || 0}
                onChange={(v) => handleNumericUpdate('y', v)}
              />
            </PropertyRow>
            <PropertyRow label="Width">
              <DesignerInput
                type="number"
                step="1"
                min={1}
                value={selectedComponent.width || 0}
                onChange={(v) => handleNumericUpdate('width', v)}
              />
            </PropertyRow>
            <PropertyRow label="Height">
              <DesignerInput
                type="number"
                step="1"
                min={1}
                value={selectedComponent.height || 0}
                onChange={(v) => handleNumericUpdate('height', v)}
              />
            </PropertyRow>
          </div>
        </section>

        {/* Page Management Section */}
        <section>
          <SectionHeader label="Page Management" />
          <PropertyRow label="Page Break Before">
            <button
              type="button"
              onClick={() =>
                updateComponent(selectedComponent.id, {
                  pageBreakBefore: !selectedComponent.pageBreakBefore,
                })
              }
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                selectedComponent.pageBreakBefore
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
              )}
            >
              <FileDown className="w-3 h-3" />
              {selectedComponent.pageBreakBefore ? 'Enabled' : 'Disabled'}
            </button>
          </PropertyRow>
        </section>

        {/* Zone Settings Section */}
        <section>
          <SectionHeader label="Zone Settings" />
          {selectedZone === 'header' && (
            <PropertyRow label="Show on First Page Only">
              <button
                type="button"
                onClick={() => {
                  const headerZone = fullSchema.zones.header;
                  const newValue = !headerZone.showOnFirstPageOnly;
                  updateZone('header', { showOnFirstPageOnly: newValue });
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                  fullSchema.zones.header.showOnFirstPageOnly
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                )}
              >
                <FileText className="w-3 h-3" />
                {fullSchema.zones.header.showOnFirstPageOnly ? 'First Page Only' : 'Every Page'}
              </button>
            </PropertyRow>
          )}
          {selectedZone === 'footer' && (
            <PropertyRow label="Show on Last Page Only">
              <button
                type="button"
                onClick={() => {
                  const footerZone = fullSchema.zones.footer;
                  const newValue = !footerZone.showOnLastPageOnly;
                  updateZone('footer', { showOnLastPageOnly: newValue });
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded transition-colors',
                  fullSchema.zones.footer.showOnLastPageOnly
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]'
                )}
              >
                <FileText className="w-3 h-3" />
                {fullSchema.zones.footer.showOnLastPageOnly ? 'Last Page Only' : 'Every Page'}
              </button>
            </PropertyRow>
          )}
        </section>
      </div>

      <div className="p-2 border-t border-[var(--border-default)] bg-white/[0.01]">
        <button
          type="button"
          onClick={() => removeComponent(selectedComponent.id)}
          className="w-full flex items-center justify-center gap-2 p-1.5 bg-red-600 text-white font-bold text-[10px] uppercase hover:bg-red-700 active:bg-red-800 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Delete Object
        </button>
      </div>
    </div>
  );
});

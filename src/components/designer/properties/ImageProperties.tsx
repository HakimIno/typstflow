import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { removeBackground } from '@/lib/typst-wasm';
import { optimizeImage } from '@/lib/utils/image-optimizer';
import type { ImageComponent } from '@/types/schema';
import { Link, Loader2, Scissors, Upload, Wand2, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { DesignerInput } from '../../shared/DesignerInput';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import { CollapsibleSection, PropertyRow, SegmentedControl } from './Shared';

interface ImagePropertiesProps {
  component: ImageComponent;
  onUpdate: (updates: Partial<ImageComponent>) => void;
}

export function ImageProperties({ component, onUpdate }: ImagePropertiesProps) {
  return (
    <>
      <CollapsibleSection label="Image Upload">
        <ImageUploader component={component} onUpdate={onUpdate} />
      </CollapsibleSection>

      <CollapsibleSection label="Image Layout">
        <PropertyRow label="Fit Mode" inline={true}>
          <Select
            value={component.fit || 'contain'}
            onValueChange={(val) => onUpdate({ fit: val as any })}
          >
            <SelectTrigger className="h-6 text-[10px] bg-[var(--bg-widget)] border-[var(--border-default)] w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Contain</SelectItem>
              <SelectItem value="cover">Cover</SelectItem>
              <SelectItem value="stretch">Stretch</SelectItem>
            </SelectContent>
          </Select>
        </PropertyRow>
      </CollapsibleSection>
    </>
  );
}

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
  const [removingBg, setRemovingBg] = useState(false);
  const [tolerance, setTolerance] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [showBgModal, setShowBgModal] = useState(false);
  const [tab, setTab] = useState<'upload' | 'url'>(
    component.src?.startsWith('http') ? 'url' : 'upload'
  );

  const previewSrc = component.srcData || (component.src?.startsWith('http') ? component.src : '');

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        // Optimization step: Resize and compress to WebP
        const { dataUrl, mimeType } = await optimizeImage(file);
        onUpdate({
          src: file.name,
          srcData: dataUrl,
          mimeType,
        });
      } catch (err: any) {
        console.error('Image optimization failed:', err);
        setError('Failed to process image');

        // Fallback: Use original data URL if optimization fails (but only if it's not too huge)
        if (file.size <= 5 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = (e) => {
            onUpdate({
              src: file.name,
              srcData: e.target?.result as string,
              mimeType: file.type || 'image/png',
            });
          };
          reader.readAsDataURL(file);
        } else {
          setError('File too large and optimization failed');
        }
      } finally {
        setLoading(false);
      }
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

      // We also optimize URL images
      const file = new File([blob], 'url-image', { type: blob.type });
      const { dataUrl, mimeType } = await optimizeImage(file);

      onUpdate({ src: url, srcData: dataUrl, mimeType });
      setLoading(false);
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

  const handleRemoveBg = useCallback(async () => {
    const srcData = component.srcData;
    if (!srcData) return;
    setRemovingBg(true);
    setError(null);
    try {
      const comma = srcData.indexOf(',');
      const base64 = srcData.slice(comma + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const resultDataUrl = await removeBackground(bytes, tolerance);
      onUpdate({ srcData: resultDataUrl, mimeType: 'image/png' });
    } catch (err: any) {
      setError(err.message || 'Remove background failed');
    } finally {
      setRemovingBg(false);
    }
  }, [component.srcData, tolerance, onUpdate]);

  const tabOptions = [
    { value: 'upload' as const, label: 'Upload', icon: Upload },
    { value: 'url' as const, label: 'URL', icon: Link },
  ];

  return (
    <div className="space-y-3 pt-1">
      {showBgModal && component.srcData && (
        <BackgroundRemovalModal
          srcData={component.srcData}
          onApply={(newSrcData) => onUpdate({ srcData: newSrcData, mimeType: 'image/png' })}
          onClose={() => setShowBgModal(false)}
        />
      )}

      <SegmentedControl
        options={tabOptions}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setError(null);
        }}
      />

      {previewSrc ? (
        <div className="space-y-3">
          <div
            className="relative rounded border border-[var(--border-default)] overflow-hidden bg-white/[0.02] flex items-center justify-center group"
            style={{ height: 80 }}
          >
            <img src={previewSrc} alt="preview" className="w-full h-full object-contain p-1.5" />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full p-1 transition-all shadow"
            >
              {loading ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <X className="w-2.5 h-2.5" />
              )}
            </button>
          </div>

          {component.srcData && (
            <div className="space-y-2 bg-white/[0.01] p-2.5 rounded border border-[var(--border-default)]/40">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold shrink-0">
                  Clean Background
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[8px] text-[var(--text-muted)] w-12 font-bold uppercase tracking-wider">
                  Tolerance
                </span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="flex-1 h-1 accent-[var(--accent)] bg-white/10 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-[var(--text-secondary)] w-6 text-right font-mono">
                  {tolerance}
                </span>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleRemoveBg}
                  disabled={removingBg || loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-[var(--border-default)] rounded text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {removingBg ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)]" />
                  ) : (
                    <Scissors className="w-3 h-3" />
                  )}
                  {removingBg ? 'Removing…' : 'Auto'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowBgModal(true)}
                  disabled={removingBg || loading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.04] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/50 hover:text-[var(--accent)] border border-[var(--border-default)] rounded text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  <Wand2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        tab === 'upload' && (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
            <button
              type="button"
              onClick={() => !loading && fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              disabled={loading}
              className="w-full h-24 rounded-md border-2 border-dashed border-[var(--border-default)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/[0.02] flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group focus:outline-none"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/[0.02] border border-[var(--border-default)] flex items-center justify-center group-hover:border-[var(--accent)]/50 group-hover:bg-[var(--accent)]/[0.04] transition-all">
                  <Upload className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
              )}
              <div className="text-center">
                <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider block">
                  {loading ? 'Optimizing...' : 'Click or Drag Image'}
                </span>
                <span className="text-[7.5px] text-[var(--text-muted)] block mt-0.5">
                  PNG, JPG, WebP — optimized on upload
                </span>
              </div>
            </button>
          </div>
        )
      )}

      {tab === 'url' && (
        <div className="space-y-1.5">
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
            Image URL
          </span>
          <div className="flex gap-1.5">
            <DesignerInput
              type="url"
              value={urlInput}
              onChange={(v) => setUrlInput(v)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlLoad()}
              placeholder="https://example.com/logo.png"
              className="flex-1 font-mono text-[9px] h-6 bg-[var(--bg-widget)] border-[var(--border-default)]"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleUrlLoad}
              disabled={loading || !urlInput.trim()}
              className="flex items-center justify-center px-3 h-6 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-40 text-white text-[9px] font-bold rounded transition-all shrink-0"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
            </button>
          </div>
          {error && <p className="text-[8px] text-red-500 font-semibold">{error}</p>}
        </div>
      )}
    </div>
  );
}

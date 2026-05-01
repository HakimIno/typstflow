import type { ImageComponent } from '@/types/schema';
import { clsx } from 'clsx';
import { ImageIcon, Link, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { DesignerInput } from '../../shared/DesignerInput';
import { PropertyRow, SectionHeader } from './Shared';
import { optimizeImage } from '@/lib/utils/image-optimizer';

interface ImagePropertiesProps {
  component: ImageComponent;
  onUpdate: (updates: Partial<ImageComponent>) => void;
}

export function ImageProperties({ component, onUpdate }: ImagePropertiesProps) {
  return (
    <>
      <SectionHeader label="Content & Image" />
      <ImageUploader component={component} onUpdate={onUpdate} />

      <SectionHeader label="Image Settings" />
      <PropertyRow label="Fit Mode">
        <select
          value={component.fit || 'contain'}
          onChange={(e) => onUpdate({ fit: e.target.value as any })}
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
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upload' | 'url'>('upload');

  const previewSrc = component.srcData || (component.src?.startsWith('http') ? '' : '');

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
          mimeType 
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
              mimeType: file.type || 'image/png' 
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

  return (
    <div className="border-b border-[var(--border-default)]">
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

      {previewSrc ? (
        <div
          className="relative mx-3 my-2 rounded border border-[var(--border-default)] overflow-hidden bg-white/[0.02]"
          style={{ height: 80 }}
        >
          <img src={previewSrc} alt="preview" className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-all"
          >
            {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <X className="w-2.5 h-2.5" />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mx-3 my-2 rounded border-2 border-dashed border-[var(--border-default)] flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[var(--border-accent)] hover:bg-[var(--accent-glow)] transition-all"
          style={{ height: 64 }}
          onClick={() => tab === 'upload' && !loading && fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
          ) : (
            <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-widest">
            {loading ? 'Optimizing...' : 'No Image'}
          </span>
        </button>
      )}

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
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border-default)] rounded text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            Browse file…
          </button>
          <p className="mt-1 text-[8px] text-slate-300 text-center">PNG, JPG, WebP — optimized on upload</p>
        </div>
      )}

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
              disabled={loading}
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

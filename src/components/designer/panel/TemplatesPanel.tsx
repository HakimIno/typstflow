'use client';

import { renderReportToSvg } from '@/lib/typst-wasm';
import { useDesignerStore } from '@/store/designer-store';
import type { CustomTemplate, LayoutSchema } from '@/types/schema';
import { Icon } from '@iconify/react';
import { LayoutTemplate, Trash2 } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BasePanel } from './BasePanel';
import { PanelHeader } from './PanelHeader';

type BuiltInId = 'blank';

interface BuiltInTemplate {
  id: BuiltInId;
  name: string;
  description: string;
  schema: LayoutSchema;
  sampleData: Record<string, unknown>;
}

// Built-in templates are being redesigned — intentionally empty for now.
const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [];

// Module-level cache so thumbnails survive panel open/close and aren't re-rendered.
const thumbnailCache = new Map<string, string>();

/** Render the first page of a schema to an SVG string (cached by key). */
async function renderThumbnail(
  key: string,
  schema: LayoutSchema,
  data: Record<string, unknown>
): Promise<string> {
  const cached = thumbnailCache.get(key);
  if (cached) return cached;
  const full = await renderReportToSvg(schema, data);
  // render_svg joins pages with <!-- PAGE_BREAK --> — keep only the first page.
  const firstPage = full.split('<!-- PAGE_BREAK -->').find((s) => s.trim().length > 0) ?? full;
  thumbnailCache.set(key, firstPage);
  return firstPage;
}

export const TemplatesPanel = memo(function TemplatesPanel() {
  const {
    loadTemplate,
    customTemplates,
    addCustomTemplate,
    deleteCustomTemplate,
    applyCustomTemplate,
    showDialog,
  } = useDesignerStore(
    useShallow((state) => ({
      loadTemplate: state.loadTemplate,
      customTemplates: state.customTemplates,
      addCustomTemplate: state.addCustomTemplate,
      deleteCustomTemplate: state.deleteCustomTemplate,
      applyCustomTemplate: state.applyCustomTemplate,
      showDialog: state.showDialog,
    }))
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmAndApply = (label: string, apply: () => void) => {
    showDialog({
      title: 'Load Template',
      message: `Load "${label}"? Your current design will be replaced.`,
      variant: 'warning',
      confirmLabel: 'Load',
      onConfirm: apply,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      // Support both bundled exports ({ schema, data }) and raw LayoutSchema.
      const schema = (raw.schema ?? raw) as LayoutSchema;
      const sampleData = (raw.data ?? undefined) as Record<string, unknown> | undefined;
      if (!schema || typeof schema !== 'object' || !('page' in schema)) {
        throw new Error('Not a valid TypstFlow design file');
      }
      const defaultName =
        schema.name?.trim() || file.name.replace(/\.json$/i, '') || 'Custom Template';

      addCustomTemplate(defaultName, schema, sampleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteCustom = (tpl: CustomTemplate) => {
    showDialog({
      title: 'Delete Template',
      message: `Remove "${tpl.name}" from your saved templates?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: () => deleteCustomTemplate(tpl.id),
    });
  };

  return (
    <BasePanel>
      <PanelHeader
        title="Templates"
        icon={LayoutTemplate}
        actions={
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload JSON template"
              className="flex items-center gap-1 text-[9px] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold uppercase tracking-wider border border-[var(--border-subtle)] px-2 py-0.5 rounded-[4px] hover:bg-white/5 transition-colors"
            >
              <Icon icon="lucide:upload" className="w-2.5 h-2.5" />
              Upload
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto scrollbar-hide p-2.5 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[10px] text-red-400">
            <Icon icon="lucide:alert-circle" className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {/* Built-in templates */}
        <section>
          <div className="h-6 flex items-center gap-2 text-[var(--text-muted)] mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Built-in</span>
            <div className="flex-1 h-px bg-[var(--border-default)] opacity-70" />
          </div>
          {BUILT_IN_TEMPLATES.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {BUILT_IN_TEMPLATES.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  cacheKey={`builtin:${tpl.id}`}
                  name={tpl.name}
                  description={tpl.description}
                  schema={tpl.schema}
                  sampleData={tpl.sampleData}
                  onClick={() => confirmAndApply(tpl.name, () => loadTemplate(tpl.id))}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[var(--text-muted)]">
              <Icon icon="lucide:layout-template" className="w-6 h-6 opacity-50" />
              <p className="text-[10px] leading-relaxed">
                No built-in templates yet.
                <br />
                Upload a design or start from blank.
              </p>
            </div>
          )}
        </section>

        {/* Saved (uploaded) templates */}
        {customTemplates.length > 0 && (
          <section>
            <div className="h-6 flex items-center gap-2 text-[var(--text-muted)] mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em]">Saved</span>
              <div className="flex-1 h-px bg-[var(--border-default)] opacity-70" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {customTemplates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  cacheKey={`custom:${tpl.id}`}
                  name={tpl.name}
                  description="Uploaded template"
                  schema={tpl.schema}
                  sampleData={tpl.sampleData ?? {}}
                  onClick={() => confirmAndApply(tpl.name, () => applyCustomTemplate(tpl.id))}
                  onDelete={() => handleDeleteCustom(tpl)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </BasePanel>
  );
});

interface TemplateCardProps {
  cacheKey: string;
  name: string;
  description: string;
  schema: LayoutSchema;
  sampleData: Record<string, unknown>;
  onClick: () => void;
  onDelete?: () => void;
}

const TemplateCard = memo(function TemplateCard({
  cacheKey,
  name,
  description,
  schema,
  sampleData,
  onClick,
  onDelete,
}: TemplateCardProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex flex-col rounded overflow-hidden bg-white/[0.02] border border-[var(--border-default)] text-left hover:border-[var(--accent)]/50 hover:bg-white/[0.04] transition-colors"
      >
        <TemplateThumbnail cacheKey={cacheKey} schema={schema} sampleData={sampleData} />
        <div className="p-2 min-w-0">
          <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate leading-tight">
            {name}
          </p>
          <p className="text-[9px] text-[var(--text-muted)] truncate leading-tight mt-0.5">
            {description}
          </p>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete template"
          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 backdrop-blur-sm text-white/70 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-black/60 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});

const TemplateThumbnail = memo(function TemplateThumbnail({
  cacheKey,
  schema,
  sampleData,
}: {
  cacheKey: string;
  schema: LayoutSchema;
  sampleData: Record<string, unknown>;
}) {
  const [svg, setSvg] = useState<string | null>(() => thumbnailCache.get(cacheKey) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (svg) return;
    let active = true;
    renderThumbnail(cacheKey, schema, sampleData)
      .then((result) => {
        if (active) setSvg(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [cacheKey, schema, sampleData, svg]);

  return (
    <div className="relative w-full aspect-[1/1.3]  bg-white overflow-hidden border-b border-[var(--border-default)]">
      {svg ? (
        <div
          className="absolute inset-0 [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Typst-generated SVG preview
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <Icon icon="lucide:file-x" className="w-6 h-6" />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[var(--accent)] animate-spin" />
        </div>
      )}
    </div>
  );
});

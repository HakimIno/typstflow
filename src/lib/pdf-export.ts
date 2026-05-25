import type { LayoutSchema } from '@/types/schema';
import { EXPORT_JOB_POLL_MS } from '@/lib/export/constants';
import { shouldUseServerExport } from '@/lib/export/page-count';
import { downloadBlob, downloadPdf } from '@/lib/export-utils';
import type { PdfExportStage } from '@/lib/typst-wasm';

export type UnifiedExportStage = PdfExportStage | 'queued' | 'generating' | 'downloading';

export interface ExportProgress {
  stage: UnifiedExportStage;
  progress: number;
  message: string;
}

interface ServerJobResponse {
  jobId: string;
  status: string;
  progress: number;
  message: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapServerStatus(status: string): UnifiedExportStage {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'generating':
      return 'generating';
    case 'compiling':
      return 'compiling';
    case 'done':
      return 'downloading';
    default:
      return 'compiling';
  }
}

async function exportPdfViaWasm(
  schema: LayoutSchema,
  data: Record<string, unknown>,
  fileName: string,
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  const { renderReportToPdf } = await import('@/lib/typst-wasm');

  onProgress?.({ stage: 'compressing', progress: 10, message: 'Optimizing images…' });

  const pdfBytes = await renderReportToPdf(schema, data, (stage) => {
    onProgress?.({
      stage,
      progress: stage === 'compressing' ? 30 : 70,
      message: stage === 'compressing' ? 'Optimizing images…' : 'Compiling in browser…',
    });
  });

  onProgress?.({ stage: 'downloading', progress: 100, message: 'Saving PDF…' });
  downloadPdf(pdfBytes, fileName);
}

async function exportPdfViaServer(
  schema: LayoutSchema,
  data: Record<string, unknown>,
  fileName: string,
  onProgress?: (p: ExportProgress) => void
): Promise<void> {
  onProgress?.({ stage: 'queued', progress: 5, message: 'Starting server export…' });

  const createRes = await fetch('/api/export/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema, data, fileName }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error || `Server export failed (${createRes.status})`);
  }

  const { jobId } = (await createRes.json()) as ServerJobResponse;

  for (;;) {
    await sleep(EXPORT_JOB_POLL_MS);

    const statusRes = await fetch(`/api/export/jobs/${jobId}`);
    if (!statusRes.ok) {
      throw new Error('Lost connection to export job');
    }

    const job = (await statusRes.json()) as ServerJobResponse;

    onProgress?.({
      stage: mapServerStatus(job.status),
      progress: job.progress,
      message: job.message,
    });

    if (job.status === 'done') {
      onProgress?.({ stage: 'downloading', progress: 95, message: 'Downloading PDF…' });

      const pdfRes = await fetch(`/api/export/jobs/${jobId}/download`);
      if (!pdfRes.ok) {
        throw new Error('Failed to download compiled PDF');
      }

      const blob = await pdfRes.blob();
      downloadBlob(blob, fileName);
      onProgress?.({ stage: 'downloading', progress: 100, message: 'Done' });
      return;
    }

    if (job.status === 'error') {
      throw new Error(job.error || 'Server export failed');
    }
  }
}

/**
 * Export PDF using browser WASM (≤ threshold pages) or server Typst CLI (large docs).
 */
export async function exportReportPdf(
  schema: LayoutSchema,
  data: Record<string, unknown>,
  onProgress?: (p: ExportProgress) => void
): Promise<{ mode: 'wasm' | 'server' }> {
  const fileName = `${schema.name || 'report'}.pdf`;

  if (shouldUseServerExport(schema, data)) {
    await exportPdfViaServer(schema, data, fileName, onProgress);
    return { mode: 'server' };
  }

  await exportPdfViaWasm(schema, data, fileName, onProgress);
  return { mode: 'wasm' };
}

export { shouldUseServerExport } from '@/lib/export/page-count';

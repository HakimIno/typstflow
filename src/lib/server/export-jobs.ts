import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { EXPORT_JOB_TTL_MS } from '@/lib/export/constants';
import { prepareExportWorkspace } from '@/lib/server/export-workspace';
import { compileTypstToPdf } from '@/lib/server/typst-compile';

export type ExportJobStatus = 'queued' | 'generating' | 'compiling' | 'done' | 'error';

export interface ExportJob {
  id: string;
  status: ExportJobStatus;
  progress: number;
  message: string;
  error?: string;
  pdfPath?: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, ExportJob>();

function tmpDir(): string {
  const dir = path.join(process.cwd(), '.tmp', 'export-jobs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function purgeStaleJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt < EXPORT_JOB_TTL_MS) continue;
    if (job.pdfPath && existsSync(job.pdfPath)) {
      try {
        unlinkSync(job.pdfPath);
      } catch {
        // ignore cleanup errors
      }
    }
    jobs.delete(id);
  }
}

function updateJob(id: string, patch: Partial<ExportJob>): ExportJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

export function createExportJob(
  schema: unknown,
  data: Record<string, unknown>,
  fileName: string
): ExportJob {
  purgeStaleJobs();

  const id = Math.random().toString(36).slice(2, 11);
  const job: ExportJob = {
    id,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    fileName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);

  void runExportJob(id, schema, data).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(id, { status: 'error', progress: 0, message: 'Export failed', error: message });
  });

  return job;
}

export function getExportJob(id: string): ExportJob | undefined {
  return jobs.get(id);
}

export function readExportJobPdf(id: string): Buffer | undefined {
  const job = jobs.get(id);
  if (!job || job.status !== 'done' || !job.pdfPath || !existsSync(job.pdfPath)) {
    return undefined;
  }
  return readFileSync(job.pdfPath);
}

export function deleteExportJob(id: string): void {
  const job = jobs.get(id);
  if (job?.pdfPath && existsSync(job.pdfPath)) {
    try {
      unlinkSync(job.pdfPath);
    } catch {
      // ignore
    }
  }
  jobs.delete(id);
}

async function runExportJob(
  id: string,
  schema: unknown,
  data: Record<string, unknown>
): Promise<void> {
  updateJob(id, { status: 'generating', progress: 15, message: 'Preparing assets & fonts…' });

  const workspace = await prepareExportWorkspace(
    id,
    schema as Parameters<typeof prepareExportWorkspace>[1],
    data
  );

  updateJob(id, { status: 'compiling', progress: 50, message: 'Compiling PDF with Typst CLI…' });

  await compileTypstToPdf({
    inputPath: workspace.typPath,
    outputPath: workspace.pdfPath,
    rootDir: workspace.jobDir,
    fontDir: workspace.fontsDir,
    packageDir: workspace.packagesDir,
  });

  updateJob(id, {
    status: 'done',
    progress: 100,
    message: 'Ready',
    pdfPath: workspace.pdfPath,
  });
}

/** Test helper — clear in-memory job store. */
export function clearExportJobsForTests(): void {
  for (const id of jobs.keys()) deleteExportJob(id);
}

import { existsSync, readFileSync } from 'node:fs';
import { EXPORT_JOB_TTL_MS } from '@/lib/export/constants';
import {
  prepareExportWorkspace,
  purgeStaleExportJobDirs,
  removeExportJobDir,
} from '@/lib/server/export-workspace';
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

function purgeStaleJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt < EXPORT_JOB_TTL_MS) continue;
    void removeExportJobDir(id);
    jobs.delete(id);
  }
  void purgeStaleExportJobDirs(EXPORT_JOB_TTL_MS);
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

  void runExportJob(id, schema, data).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(id, { status: 'error', progress: 0, message: 'Export failed', error: message });
    await removeExportJobDir(id);
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

export async function deleteExportJob(id: string): Promise<void> {
  await removeExportJobDir(id);
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

/** Test helper — clear in-memory job store and on-disk workspaces. */
export async function clearExportJobsForTests(): Promise<void> {
  for (const id of jobs.keys()) {
    await deleteExportJob(id);
  }
}

import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TypstGenerator } from '@/lib/engine/generator';
import { collectFontFamilies, injectImagesIntoSchema } from '@/lib/engine/image-assets';
import { FONT_CATALOG } from '@/lib/font-catalog';
import type { LayoutSchema } from '@/types/schema';

const WASM_FONTS_DIR = path.join(process.cwd(), 'src-wasm', 'fonts');
const WASM_PACKAGES_DIR = path.join(process.cwd(), 'src-wasm', 'typst-packages');
const CUSTOM_FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'custom');
const CUSTOM_REGISTRY = path.join(CUSTOM_FONTS_DIR, 'registry.json');

interface CustomFontEntry {
  family: string;
  weight: number;
  fileName: string;
}

export interface ExportWorkspace {
  jobDir: string;
  typPath: string;
  pdfPath: string;
  fontsDir: string;
  packagesDir: string;
}

export function getExportJobDir(jobId: string): string {
  return path.join(process.cwd(), '.tmp', 'export-jobs', jobId);
}

/** Remove a job workspace directory and all nested assets. */
export async function removeExportJobDir(jobId: string): Promise<void> {
  const jobDir = getExportJobDir(jobId);
  try {
    await rm(jobDir, { recursive: true, force: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`[export-workspace] Failed to remove job dir ${jobId}:`, err);
    }
  }
}

/** Remove on-disk job dirs older than maxAgeMs (covers server restarts). */
export async function purgeStaleExportJobDirs(maxAgeMs: number): Promise<void> {
  const base = path.join(process.cwd(), '.tmp', 'export-jobs');
  if (!existsSync(base)) return;

  const now = Date.now();
  let entries: any[];
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(base, entry.name);
    try {
      const { mtimeMs } = await stat(dirPath);
      if (now - mtimeMs >= maxAgeMs) {
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch {
      // ignore per-entry errors
    }
  }
}

async function copyWasmBuiltinFonts(fontsDir: string): Promise<void> {
  await mkdir(fontsDir, { recursive: true });
  const names = ['Sarabun-Regular.ttf', 'Sarabun-Bold.ttf', 'Geist-Regular.ttf', 'Geist-Bold.ttf'];
  for (const name of names) {
    const src = path.join(WASM_FONTS_DIR, name);
    try {
      await cp(src, path.join(fontsDir, name));
    } catch {
      console.warn(`[export-workspace] Missing bundled font: ${name}`);
    }
  }
}

async function copyTypstPackages(packagesDir: string): Promise<void> {
  const packages = [
    ['codetastic', '0.2.2'],
    ['cheq', '0.2.2'],
  ] as const;

  for (const [name, version] of packages) {
    const dest = path.join(packagesDir, 'preview', name, version);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(path.join(WASM_PACKAGES_DIR, name, version), dest, { recursive: true });
  }
}

async function loadCustomRegistry(): Promise<CustomFontEntry[]> {
  try {
    const raw = await readFile(CUSTOM_REGISTRY, 'utf-8');
    return JSON.parse(raw) as CustomFontEntry[];
  } catch {
    return [];
  }
}

async function fetchCatalogFont(family: string, weight: number): Promise<Buffer | null> {
  const entry = FONT_CATALOG.find((f) => f.family === family);
  if (!entry?.githubUrls || entry.builtIn) return null;

  const url = entry.githubUrls[weight] ?? entry.githubUrls[400];
  if (!url) return null;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'TypstFlow/1.0 (server-export)' },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.byteLength > 4000 ? buf : null;
}

async function materializeFonts(schema: LayoutSchema, fontsDir: string): Promise<void> {
  await mkdir(fontsDir, { recursive: true });
  await copyWasmBuiltinFonts(fontsDir);

  const needed = collectFontFamilies(schema);
  const registry = await loadCustomRegistry();
  const copiedCustom = new Set<string>();

  for (const entry of registry) {
    if (!needed.has(entry.family)) continue;
    const key = entry.fileName;
    if (copiedCustom.has(key)) continue;
    try {
      await cp(path.join(CUSTOM_FONTS_DIR, entry.fileName), path.join(fontsDir, entry.fileName));
      copiedCustom.add(key);
    } catch {
      console.warn(`[export-workspace] Custom font file missing: ${entry.fileName}`);
    }
  }

  for (const family of needed) {
    const catalog = FONT_CATALOG.find((f) => f.family === family);
    if (!catalog || catalog.builtIn || !catalog.githubUrls) continue;

    if (catalog.variable) {
      const dest = path.join(fontsDir, `${family.replace(/\s+/g, '')}-Variable.ttf`);
      try {
        await readFile(dest);
      } catch {
        const buf = await fetchCatalogFont(family, 400);
        if (buf) await writeFile(dest, buf);
      }
      continue;
    }

    for (const weight of Object.keys(catalog.githubUrls).map(Number)) {
      const dest = path.join(fontsDir, `${family.replace(/\s+/g, '')}-${weight}.ttf`);
      try {
        await readFile(dest);
      } catch {
        const buf = await fetchCatalogFont(family, weight);
        if (buf) await writeFile(dest, buf);
      }
    }
  }
}

/**
 * Prepare a self-contained Typst compile workspace matching browser WASM preview assets.
 */
export async function prepareExportWorkspace(
  jobId: string,
  schemaInput: LayoutSchema,
  data: Record<string, unknown>
): Promise<ExportWorkspace> {
  const jobDir = getExportJobDir(jobId);
  const fontsDir = path.join(jobDir, 'fonts');
  const packagesDir = path.join(jobDir, 'packages');
  const typPath = path.join(jobDir, 'main.typ');
  const pdfPath = path.join(jobDir, 'output.pdf');

  await mkdir(jobDir, { recursive: true });

  const schema = structuredClone(schemaInput) as LayoutSchema;

  await injectImagesIntoSchema(schema, {
    writeAsset: async (fileName, bytes) => {
      await writeFile(path.join(jobDir, fileName), Buffer.from(bytes));
    },
  });

  // Write XML file if standard is PDF/A-3b and embedXml is checked
  if (schema.pdfConfig?.standard === 'pdf-a-3b' && schema.pdfConfig?.embedXml) {
    const { resolvePath } = await import('@/lib/engine/generator/binding');
    const xmlDataPath = schema.pdfConfig.xmlDataPath || 'xmlData';
    const xmlString = resolvePath(xmlDataPath, data);
    if (typeof xmlString === 'string' && xmlString) {
      await writeFile(path.join(jobDir, 'invoice.xml'), xmlString);
    } else {
      const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Warning: XML data not found in dataset at path "${xmlDataPath}" -->\n<empty/>`;
      await writeFile(path.join(jobDir, 'invoice.xml'), fallbackXml);
    }
  }

  await materializeFonts(schema, fontsDir);
  await copyTypstPackages(packagesDir);

  const typstCode = new TypstGenerator().generate(schema, data);
  await writeFile(typPath, typstCode);

  return { jobDir, typPath, pdfPath, fontsDir, packagesDir };
}

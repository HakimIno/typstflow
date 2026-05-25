import { execSync, spawn } from 'node:child_process';

let cachedBinary: string | null = null;

export interface TypstCompileOptions {
  inputPath: string;
  outputPath: string;
  /** Typst project root (--root). Image paths resolve relative to this. */
  rootDir: string;
  fontDir: string;
  packageDir: string;
}

/** Resolve Typst CLI binary (env TYPST_PATH, PATH, or common install locations). */
export function findTypstBinary(): string {
  if (cachedBinary) return cachedBinary;

  const candidates = [
    process.env.TYPST_PATH,
    'typst',
    '/opt/homebrew/bin/typst',
    '/usr/local/bin/typst',
  ].filter(Boolean) as string[];

  for (const bin of candidates) {
    try {
      execSync(`"${bin}" --version`, { stdio: 'ignore' });
      cachedBinary = bin;
      return bin;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    'Typst CLI not found. Install typst (https://typst.app) or set the TYPST_PATH environment variable.'
  );
}

/** Compile a .typ file to PDF using native Typst CLI with fonts and packages. */
export function compileTypstToPdf(options: TypstCompileOptions): Promise<void> {
  const typst = findTypstBinary();

  const args = [
    'compile',
    '--root',
    options.rootDir,
    '--font-path',
    options.fontDir,
    '--package-path',
    options.packageDir,
    options.inputPath,
    options.outputPath,
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn(typst, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim() || `exit code ${code}`;
      reject(new Error(`Typst compile failed: ${detail}`));
    });
  });
}

/** Reset cached binary (for tests). */
export function resetTypstBinaryCache(): void {
  cachedBinary = null;
}

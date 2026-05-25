import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readFontFamily } from '../../../../lib/utils/font-parser';

const CUSTOM_FONTS_DIR = path.join(process.cwd(), 'public', 'fonts', 'custom');
const REGISTRY_PATH = path.join(CUSTOM_FONTS_DIR, 'registry.json');

export interface CustomFontInfo {
  id: string;
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
  fileName: string;
  url: string;
  uploadedAt: number;
}

async function ensureDirAndRegistry() {
  try {
    await fs.mkdir(CUSTOM_FONTS_DIR, { recursive: true });
  } catch {
    // Already exists or can't create
  }

  try {
    await fs.access(REGISTRY_PATH);
  } catch {
    // Registry does not exist, create it with empty array
    await fs.writeFile(REGISTRY_PATH, JSON.stringify([], null, 2));
  }
}

class SimpleLock {
  private queue = Promise.resolve();

  async acquire<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.then(
      () => {},
      () => {}
    );
    return next;
  }
}

const registryLock = new SimpleLock();

export async function GET() {
  try {
    await ensureDirAndRegistry();
    const registry = await registryLock.acquire(async (): Promise<CustomFontInfo[]> => {
      const data = await fs.readFile(REGISTRY_PATH, 'utf-8');
      if (!data.trim()) return [];
      try {
        const list: CustomFontInfo[] = JSON.parse(data);
        let changed = false;
        const healed: CustomFontInfo[] = [];

        for (const f of list) {
          const updated = { style: 'normal' as const, ...f };

          // 1. Heal URL
          if (f.url && f.url.startsWith('/fonts/custom/')) {
            changed = true;
            updated.url = `/api/fonts/custom/file?fileName=${f.fileName}`;
          }

          // 2. Heal Family Name from the actual physical font binary metadata
          try {
            const filePath = path.join(CUSTOM_FONTS_DIR, f.fileName);
            const fileBuffer = await fs.readFile(filePath);
            const arrayBuffer = fileBuffer.buffer.slice(
              fileBuffer.byteOffset,
              fileBuffer.byteOffset + fileBuffer.byteLength
            );
            const parsedFamily = readFontFamily(arrayBuffer);
            if (parsedFamily && parsedFamily.trim() && parsedFamily.trim() !== f.family) {
              console.log(
                `[API Custom Fonts] Self-healed family name mismatch: "${f.family}" -> "${parsedFamily.trim()}"`
              );
              changed = true;
              updated.family = parsedFamily.trim();
            }
          } catch (e: any) {
            console.warn(
              `[API Custom Fonts] Failed to self-heal family name for ${f.fileName}: ${e.message}`
            );
          }

          healed.push(updated);
        }

        if (changed) {
          await fs.writeFile(REGISTRY_PATH, JSON.stringify(healed, null, 2));
        }
        return healed;
      } catch {
        return [];
      }
    });
    return NextResponse.json(registry);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to load custom fonts registry: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDirAndRegistry();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const family = formData.get('family') as string | null;
    const weightVal = formData.get('weight') as string | null;
    const weight = weightVal ? Number.parseInt(weightVal, 10) : 400;

    // Style detection (either sent in formData or guessed from original file name)
    const styleVal = formData.get('style') as string | null;
    const originalName = file?.name || '';
    const lowerOrigName = originalName.toLowerCase();
    const isItalic =
      styleVal === 'italic' ||
      lowerOrigName.includes('italic') ||
      lowerOrigName.includes('oblique') ||
      lowerOrigName.endsWith('it') ||
      lowerOrigName.includes('-it') ||
      lowerOrigName.includes('_it');
    const style = isItalic ? 'italic' : 'normal';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const ext = path.extname(originalName).toLowerCase();
    if (ext !== '.ttf' && ext !== '.otf') {
      return NextResponse.json(
        { error: 'Only TrueType (.ttf) and OpenType (.otf) fonts are supported' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract exact internal Font Family name from TTF/OTF metadata
    const parsedFamily = readFontFamily(arrayBuffer);
    const finalFamily = (parsedFamily || family || 'Custom Font').trim();

    // Create a safe, sanitized family name for filename based on the parsed name
    const sanitizedFamily = finalFamily
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');

    // Include style suffix if italic, keeping backward-compatibility for standard upright fonts
    const styleSuffix = style === 'italic' ? '-italic' : '';
    const fileName = `${sanitizedFamily}-${weight}${styleSuffix}${ext}`;
    const filePath = path.join(CUSTOM_FONTS_DIR, fileName);

    // Save physical file
    await fs.writeFile(filePath, buffer);

    // Update registry with Lock
    const newFont = await registryLock.acquire(async (): Promise<CustomFontInfo> => {
      const registryData = await fs.readFile(REGISTRY_PATH, 'utf-8');
      let registry: CustomFontInfo[] = [];
      if (registryData.trim()) {
        try {
          registry = JSON.parse(registryData);
        } catch {
          registry = [];
        }
      }

      const fontObj: CustomFontInfo = {
        id: `${sanitizedFamily}-${weight}${styleSuffix}`,
        family: finalFamily,
        weight,
        style,
        fileName,
        url: `/api/fonts/custom/file?fileName=${fileName}`,
        uploadedAt: Date.now(),
      };

      // Remove duplicates if same ID exists
      registry = registry.filter((f) => f.id !== fontObj.id);
      registry.push(fontObj);

      await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
      return fontObj;
    });

    return NextResponse.json(newFont, { status: 201 });
  } catch (error: any) {
    console.error('[API Custom Fonts] Upload error:', error);
    return NextResponse.json({ error: `Failed to upload font: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDirAndRegistry();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const fontToDelete = await registryLock.acquire(async (): Promise<CustomFontInfo | null> => {
      const registryData = await fs.readFile(REGISTRY_PATH, 'utf-8');
      let registry: CustomFontInfo[] = [];
      if (registryData.trim()) {
        try {
          registry = JSON.parse(registryData);
        } catch {
          registry = [];
        }
      }

      const found = registry.find((f) => f.id === id);
      if (!found) return null;

      // Filter registry and save
      registry = registry.filter((f) => f.id !== id);
      await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
      return found;
    });

    if (!fontToDelete) {
      return NextResponse.json({ error: 'Font not found in registry' }, { status: 404 });
    }

    // Delete physical file
    const filePath = path.join(CUSTOM_FONTS_DIR, fontToDelete.fileName);
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      console.warn(`[API Custom Fonts] Physical file delete failed or didn't exist: ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Font ${fontToDelete.family} deleted successfully`,
    });
  } catch (error: any) {
    console.error('[API Custom Fonts] Delete error:', error);
    return NextResponse.json({ error: `Failed to delete font: ${error.message}` }, { status: 500 });
  }
}

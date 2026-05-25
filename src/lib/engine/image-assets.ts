import type { ComponentNode, LayoutSchema } from '@/types/schema';

export function getMimeFromDataUrl(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : undefined;
}

export function sniffImageExtension(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
      return 'webp';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return 'gif';
  return 'png';
}

export function getExtFromMime(mime?: string): string {
  if (!mime) return 'png';
  const mapping: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return mapping[mime] || 'png';
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) throw new Error('Invalid data URL: missing comma');
  const base64 = dataUrl.slice(comma + 1);
  const binary = Buffer.from(base64, 'base64');
  return new Uint8Array(binary);
}

function walkComponents(components: ComponentNode[], visit: (c: ComponentNode) => void): void {
  if (!Array.isArray(components)) return;
  for (const comp of components) {
    visit(comp);
    if (comp.type === 'repeater' && comp.children) {
      walkComponents(comp.children, visit);
    } else if (comp.type === 'columns' && comp.columns) {
      for (const col of comp.columns) {
        if (col.components) walkComponents(col.components, visit);
      }
    }
  }
}

/** Collect every font family referenced in the schema (body config + component styles). */
export function collectFontFamilies(schema: LayoutSchema): Set<string> {
  const families = new Set<string>(['Sarabun']);

  for (const f of schema.fonts ?? []) {
    if (f.family) families.add(f.family);
  }

  const addFromStyle = (comp: ComponentNode) => {
    if (comp.type === 'text' && comp.style?.fontFamily) {
      families.add(comp.style.fontFamily);
    }
    if (comp.type === 'table' && comp.style?.fontFamily) {
      families.add(comp.style.fontFamily);
    }
  };

  walkComponents(schema.zones?.header?.components ?? [], addFromStyle);
  walkComponents(schema.zones?.footer?.components ?? [], addFromStyle);
  for (const page of schema.pages ?? []) {
    walkComponents(page.body?.components ?? [], addFromStyle);
  }
  for (const g of schema.groups ?? []) {
    walkComponents(g.header?.components ?? [], addFromStyle);
    walkComponents(g.footer?.components ?? [], addFromStyle);
  }

  return families;
}

export interface InjectImagesOptions {
  /** Write image bytes and set comp.src to the filename (relative to typst root). */
  writeAsset: (fileName: string, bytes: Uint8Array) => Promise<void>;
}

/**
 * Mutates schema in-place: writes image srcData to disk and sets comp.src for Typst CLI.
 */
export async function injectImagesIntoSchema(
  schema: LayoutSchema,
  options: InjectImagesOptions
): Promise<void> {
  if (!schema?.zones) return;

  if (schema.zones.header.repeatOnEveryPage === undefined) {
    schema.zones.header.repeatOnEveryPage = false;
  }
  if (schema.zones.footer.repeatOnEveryPage === undefined) {
    schema.zones.footer.repeatOnEveryPage = false;
  }

  const register = async (components: ComponentNode[]) => {
    if (!Array.isArray(components)) return;
    for (const comp of components) {
      if (comp.type === 'image' && comp.srcData) {
        try {
          const bytes = dataUrlToBytes(comp.srcData);
          let ext = sniffImageExtension(bytes);
          if (ext === 'png' && !comp.srcData.startsWith('data:image/png')) {
            ext = getExtFromMime(getMimeFromDataUrl(comp.srcData) || comp.mimeType);
          }
          const fileName = `asset-${comp.id}.${ext}`;
          await options.writeAsset(fileName, bytes);
          comp.src = fileName;
        } catch (e) {
          console.warn(`[image-assets] Failed to write image ${comp.id}:`, e);
        }
      }
      if (comp.type === 'repeater' && comp.children) {
        await register(comp.children);
      } else if (comp.type === 'columns' && comp.columns) {
        for (const col of comp.columns) {
          if (col.components) await register(col.components);
        }
      }
    }
  };

  for (const zoneName of ['header', 'footer'] as const) {
    const zone = schema.zones[zoneName];
    if (!zone) continue;
    if (!zone.components || zone.components.length === 0) {
      zone.components = [
        {
          id: `dummy-${zoneName}`,
          type: 'text',
          content: '',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        } as ComponentNode,
      ];
    } else {
      await register(zone.components);
    }
  }

  if (schema.pages && Array.isArray(schema.pages)) {
    for (const page of schema.pages) {
      if (!page.body) continue;
      if (!page.body.components || page.body.components.length === 0) {
        page.body.components = [
          {
            id: `dummy-body-${page.id}`,
            type: 'text',
            content: '',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          } as ComponentNode,
        ];
      } else {
        await register(page.body.components);
      }
    }
  }
}

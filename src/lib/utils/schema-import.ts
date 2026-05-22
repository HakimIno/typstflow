import type { LayoutSchema, Zone } from '@/types/schema';
import { BLANK_SCHEMA } from '@/store/store-utils';
import { validateAndRepairSchemaStrict } from './schema-validator';

export class SchemaImportError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_JSON' | 'DATA_ONLY' | 'NOT_SCHEMA' | 'VALIDATION'
  ) {
    super(message);
    this.name = 'SchemaImportError';
  }
}

export interface ImportBundle {
  schema: LayoutSchema;
  data: Record<string, unknown> | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeSampleData(value: Record<string, unknown>): boolean {
  if (value.zones || value.pages) return false;
  if (value.schema && isPlainObject(value.schema)) return false;
  // Bundled export without nested schema — top-level keys are data fields only.
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  const designKeys = ['page', 'zones', 'pages', 'fonts', 'groups', 'metadata', 'variables'];
  return !designKeys.some((k) => k in value);
}

function ensureZone(raw: unknown, fallbackId: string): Record<string, unknown> {
  const z = isPlainObject(raw) ? { ...raw } : {};
  if (!Array.isArray(z.components)) z.components = [];
  if (typeof z.id !== 'string') z.id = fallbackId;
  return z;
}

function mergePageBandIntoZone(
  globalZone: Record<string, unknown>,
  pageBand: unknown
): Record<string, unknown> {
  if (!isPlainObject(pageBand)) return globalZone;
  const pageComps = Array.isArray(pageBand.components) ? pageBand.components : [];
  if (pageComps.length === 0) return globalZone;

  const globalComps = Array.isArray(globalZone.components) ? globalZone.components : [];
  if (globalComps.length === 0) {
    return {
      ...globalZone,
      components: pageComps,
      minHeight: globalZone.minHeight ?? pageBand.minHeight,
    };
  }
  return globalZone;
}

function inferMinHeight(zone: Record<string, unknown>, fallback: string): void {
  const comps = Array.isArray(zone.components) ? zone.components : [];
  if (comps.length === 0) return;
  if (zone.minHeight != null && zone.minHeight !== '') return;

  let maxBottom = 0;
  for (const comp of comps) {
    if (!isPlainObject(comp)) continue;
    const y = typeof comp.y === 'number' ? comp.y : 0;
    const h = typeof comp.height === 'number' ? comp.height : 10;
    maxBottom = Math.max(maxBottom, y + h);
  }
  zone.minHeight = `${Math.ceil(maxBottom + 5)}mm`;
  if (!zone.minHeight || zone.minHeight === '5mm') {
    zone.minHeight = fallback;
  }
}

/**
 * Normalize legacy / hand-edited JSON into a shape the validator accepts.
 * Does not guarantee validity — call {@link parseImportBundle} for full import.
 */
export function normalizeImportedSchema(raw: unknown): Record<string, unknown> {
  if (!isPlainObject(raw)) {
    throw new SchemaImportError('Invalid design file: expected a JSON object.', 'NOT_SCHEMA');
  }

  const data: Record<string, unknown> = { ...raw };
  const zonesRaw = isPlainObject(data.zones) ? { ...data.zones } : {};

  // Legacy: zones.body → pages[0].body
  if (isPlainObject(zonesRaw.body) && !Array.isArray(data.pages)) {
    data.pages = [
      {
        id: 'page-1',
        name: 'Page 1',
        body: zonesRaw.body,
      },
    ];
    delete zonesRaw.body;
  }

  zonesRaw.header = ensureZone(zonesRaw.header, 'header');
  zonesRaw.footer = ensureZone(zonesRaw.footer, 'footer');
  data.zones = zonesRaw;

  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    data.pages = [
      {
        id: 'page-1',
        name: 'Page 1',
        body: { id: 'body', components: [] },
      },
    ];
  }

  data.pages = (data.pages as unknown[]).map((page, idx) => {
    if (!isPlainObject(page)) {
      return {
        id: `page-${idx + 1}`,
        name: `Page ${idx + 1}`,
        body: { id: 'body', components: [] },
      };
    }
    const p = { ...page };
    if (typeof p.id !== 'string') p.id = `page-${idx + 1}`;
    if (typeof p.name !== 'string') p.name = `Page ${idx + 1}`;
    p.body = ensureZone(p.body, 'body');

    // Per-page header/footer bands → global zones when global is empty.
    if (idx === 0) {
      zonesRaw.header = mergePageBandIntoZone(
        zonesRaw.header as Record<string, unknown>,
        p.header
      );
      zonesRaw.footer = mergePageBandIntoZone(
        zonesRaw.footer as Record<string, unknown>,
        p.footer
      );
    }
    delete p.header;

    return p;
  });

  data.zones = zonesRaw;

  inferMinHeight(zonesRaw.header as Record<string, unknown>, '25mm');
  inferMinHeight(zonesRaw.footer as Record<string, unknown>, '20mm');

  if (!isPlainObject(data.page)) {
    data.page = { ...BLANK_SCHEMA.page };
  } else {
    const page = { ...data.page };
    if (typeof page.orientation === 'string') {
      page.orientation = page.orientation.toLowerCase();
    }
    if (typeof page.size === 'string') {
      page.size = page.size.toLowerCase();
    }
    data.page = page;
  }

  if (!Array.isArray(data.fonts) || data.fonts.length === 0) {
    data.fonts = structuredClone(BLANK_SCHEMA.fonts);
  }

  if (!Array.isArray(data.groups)) data.groups = [];
  if (!Array.isArray(data.variables)) data.variables = [];
  if (!Array.isArray(data.dataSchema)) data.dataSchema = [];

  if (typeof data.id !== 'string') data.id = 'imported-report';
  if (typeof data.name !== 'string') data.name = 'Imported Report';
  if (typeof data.version !== 'string') data.version = '1.0.0';

  if (!isPlainObject(data.metadata)) {
    data.metadata = {
      title: data.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: 'import',
    };
  }

  return data;
}

export function countSchemaComponents(schema: LayoutSchema): number {
  let n = 0;
  const countZone = (zone: Zone) => {
    n += zone.components?.length ?? 0;
  };
  countZone(schema.zones.header);
  countZone(schema.zones.footer);
  for (const page of schema.pages) countZone(page.body);
  for (const group of schema.groups ?? []) {
    countZone(group.header);
    countZone(group.footer);
  }
  return n;
}

/** Parse a File → Import Design JSON string into schema + optional sample data. */
export function parseImportBundle(json: string): ImportBundle {
  let rawData: unknown;
  try {
    rawData = JSON.parse(json);
  } catch {
    throw new SchemaImportError('Invalid JSON file — could not parse.', 'INVALID_JSON');
  }

  if (!isPlainObject(rawData)) {
    throw new SchemaImportError('Invalid design file: root must be a JSON object.', 'NOT_SCHEMA');
  }

  if (looksLikeSampleData(rawData)) {
    throw new SchemaImportError(
      'This file looks like sample data, not a design layout.\n\n' +
        'Use **File → Import Design** for layout files (with zones & pages).\n' +
        'Use the **Data panel → Import JSON** for sample data only.',
      'DATA_ONLY'
    );
  }

  const schemaRaw = isPlainObject(rawData.schema) ? rawData.schema : rawData;
  const sampleData =
    isPlainObject(rawData.data) && rawData.schema
      ? (rawData.data as Record<string, unknown>)
      : null;

  if (!isPlainObject(schemaRaw)) {
    throw new SchemaImportError('Missing layout schema in file.', 'NOT_SCHEMA');
  }

  if (!schemaRaw.zones && !schemaRaw.pages) {
    throw new SchemaImportError(
      'Not a TypstFlow design file — expected "zones" and "pages" in the JSON.',
      'NOT_SCHEMA'
    );
  }

  try {
    const normalized = normalizeImportedSchema(schemaRaw);
    const schema = validateAndRepairSchemaStrict(normalized);
    return { schema, data: sampleData };
  } catch (error) {
    if (error instanceof SchemaImportError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new SchemaImportError(
      `Design file could not be loaded:\n${detail}`,
      'VALIDATION'
    );
  }
}

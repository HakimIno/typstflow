import type { LayoutSchema, PageDefinition } from '@/types/schema';
import * as zod from 'zod';
const z = (zod as any).z || zod;

/**
 * Zod Schema for LayoutSchema validation.
 * Ensures the document structure is intact and prevents crashes from corrupted data.
 */
/**
 * Deep cleans a component to ensure all fields match the expected types in the WASM engine.
 * Specifically coerces numeric values for thickness, borderWidth, etc. into strings.
 */
function deepCleanComponent(comp: any): any {
  if (!comp || typeof comp !== 'object') return comp;

  const result = { ...comp };

  // 1. Coerce core component properties
  if (typeof result.thickness === 'number') {
    result.thickness = `${result.thickness}pt`;
  }
  if (typeof result.dashArray === 'number') {
    result.dashArray = `${result.dashArray}pt`;
  }

  // 1b. Coerce dimension properties
  if (typeof result.width === 'string') {
    result.width = parseFloat(result.width) || 0;
  }
  if (typeof result.height === 'string') {
    result.height = parseFloat(result.height) || 0;
  }

  // 2. Coerce margin properties
  if (typeof result.marginBottom === 'string') {
    result.marginBottom = parseFloat(result.marginBottom) || 0;
  }
  if (typeof result.marginTop === 'string') {
    result.marginTop = parseFloat(result.marginTop) || 0;
  }

  // 3. Coerce style properties
  if (result.style && typeof result.style === 'object') {
    result.style = { ...result.style };
    if (typeof result.style.borderWidth === 'number') {
      result.style.borderWidth = `${result.style.borderWidth}pt`;
    }
    if (typeof result.style.cellPadding === 'number') {
      result.style.cellPadding = `${result.style.cellPadding}pt`;
    }
    if (typeof result.style.lineHeight === 'string') {
      result.style.lineHeight = parseFloat(result.style.lineHeight) || 1.2;
    }
    if (typeof result.style.fontSize === 'string') {
      result.style.fontSize = parseFloat(result.style.fontSize) || 10;
    }
  }

  // 3. Coerce Table specific properties
  if (result.type === 'table' && result.columns) {
    result.columns = result.columns.map((col: any) => {
      const newCol = { ...col };
      if (typeof newCol.borderWidth === 'number') {
        newCol.borderWidth = `${newCol.borderWidth}pt`;
      }
      if (typeof newCol.width === 'number') {
        newCol.width = `${newCol.width}mm`;
      }
      return newCol;
    });
  }

  // 4. Coerce nested components (for column layout / repeaters)
  if (result.children && Array.isArray(result.children)) {
    result.children = result.children.map(deepCleanComponent);
  }
  if (result.columns && Array.isArray(result.columns) && result.type === 'columns') {
    result.columns = result.columns.map((col: any) => ({
      ...col,
      components: (col.components || []).map(deepCleanComponent),
    }));
  }

  return result;
}

/**
 * Zod Schema for LayoutSchema validation.
 * Ensures the document structure is intact and prevents crashes from corrupted data.
 */
export const ComponentSchema = z
  .preprocess((val: unknown) => deepCleanComponent(val), z.object({
    id: z.string(),
    type: z.string(),
    x: z.number().optional().default(0),
    y: z.number().optional().default(0),
    width: z.number().optional(),
    height: z.number().optional(),
    name: z.string().optional(),
    repeatHeaderOnPage: z.union([z.boolean(), z.string()]).optional(),
    groupBy: z.string().optional(),
    groupHeaderFormat: z.string().optional(),
    groupHeaderStyle: z.any().optional(),
  }).passthrough());

export const ZoneSchema = z.object({
  id: z.string(),
  components: z.array(ComponentSchema),
  minHeight: z.string().optional(),
  background: z.string().optional(),
  padding: z.string().optional(),
  showOnFirstPageOnly: z.boolean().optional(),
  showOnLastPageOnly: z.boolean().optional(),
  repeatOnEveryPage: z.boolean().optional(),
  layoutMode: z.enum(['absolute', 'flow']).optional(),
  flowGap: z.string().optional(),
}).passthrough();

const DEFAULT_PAGE_FOOTER = { id: 'footer', minHeight: '20mm', components: [] };

export const PageSchema = z.object({
  id: z.string(),
  name: z.string(),
  body: ZoneSchema,
  footer: ZoneSchema.optional().default(DEFAULT_PAGE_FOOTER),
});

export const LayoutSchemaValidator = z
  .object({
    page: z.object({
      size: z.string(),
      orientation: z.enum(['portrait', 'landscape']),
      margin: z.object({
        top: z.string(),
        bottom: z.string(),
        left: z.string(),
        right: z.string(),
      }),
    }),
    zones: z.object({
      header: ZoneSchema,
      footer: ZoneSchema,
    }),
    pages: z.array(PageSchema).default([]),
    groups: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          field: z.string(),
          header: ZoneSchema,
          footer: ZoneSchema,
          sortBy: z.enum(['asc', 'desc']).optional(),
          filterBy: z.string().optional(),
          repeatHeaderOnPage: z.boolean().optional(),
        })
      )
      .default([]),
    groupDataSource: z.string().optional(),
    batchDataSource: z.string().optional(),
    fonts: z.array(
      z.object({
        family: z.string(),
        size: z.number(),
        role: z.string().optional(),
        embedded: z.boolean().optional(),
      })
    ),
    metadata: z
      .object({
        title: z.string().default('New Report'),
        createdAt: z.string().default(() => new Date().toISOString()),
        updatedAt: z.string().default(() => new Date().toISOString()),
        author: z.string().default('Unknown'),
      })
      .passthrough()
      .default({
        title: 'New Report',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'Unknown',
      }),
  })
  .passthrough();

/**
 * Validates a schema object and returns either the valid schema or a default one if corrupted.
 */
export function validateAndRepairSchema(data: unknown, defaultSchema: LayoutSchema): LayoutSchema {
  try {
    const validated = LayoutSchemaValidator.parse(data) as LayoutSchema;

    // Deep Repair: Ensure all page IDs are unique
    const pageIds = new Set<string>();
    let hasDuplicate = false;

    for (const page of validated.pages) {
      if (pageIds.has(page.id)) {
        hasDuplicate = true;
        break;
      }
      pageIds.add(page.id);
    }

    if (hasDuplicate) {
      console.warn('[Validator] Duplicate page IDs detected, repairing...');
      validated.pages = validated.pages.map((page: PageDefinition, idx: number) => {
        // If it's a collision or looks like a length-based ID that might collide,
        // give it a unique suffix
        const uniqueId = `page-${Math.random().toString(36).substring(2, 6)}-${idx}`;
        return { ...page, id: uniqueId };
      });
    }

    return validated;
  } catch (error) {
    console.error('Schema Corruption Detected:', error);
    // In production, we'd log this to an external service
    return defaultSchema;
  }
}

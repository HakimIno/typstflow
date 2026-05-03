import type { LayoutSchema, PageDefinition } from '@/types/schema';
import * as zod from 'zod';
const z = (zod as any).z || zod;

/**
 * Zod Schema for LayoutSchema validation.
 * Ensures the document structure is intact and prevents crashes from corrupted data.
 */
export const ComponentSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    x: z.number(),
    y: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    name: z.string().optional(),
  })
  .passthrough();

export const ZoneSchema = z.object({
  id: z.string(),
  components: z.array(ComponentSchema),
  minHeight: z.string().optional(),
});

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
          repeatHeaderOnPage: z.boolean().optional(),
        })
      )
      .default([]),
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

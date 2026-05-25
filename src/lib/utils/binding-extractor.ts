import type { LayoutSchema } from '@/types/schema';

/**
 * Extracts all unique variable paths from a layout schema.
 * It recursively walks the layout schema object and finds all {{path}} expressions
 * inside any string values, excluding base64 images and large blocks.
 */
export function extractSchemaBindings(schema: LayoutSchema): string[] {
  const bindings = new Set<string>();

  function traverse(node: unknown) {
    if (typeof node === 'string') {
      if (node.startsWith('data:image') || node.length > 1000) {
        return; // skip binary / long strings
      }

      // Find all matches for {{...}}
      const matches = node.matchAll(/\{\{([^}]+)\}\}/g);
      for (const match of matches) {
        const expression = match[1].trim();

        // Check if it's an aggregate function like SUM(items.price) or COUNT(items)
        const funcMatch = expression.match(/^(SUM|COUNT|AVG|MIN|MAX)\((.+?)\)$/i);
        if (funcMatch) {
          const path = funcMatch[2].trim();
          bindings.add(path);
        } else {
          bindings.add(expression);
        }
      }
    } else if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
    } else if (node && typeof node === 'object') {
      for (const key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          if (key === 'srcData' || key === 'background' || key === 'history') {
            continue;
          }
          traverse((node as Record<string, unknown>)[key]);
        }
      }
    }
  }

  traverse(schema);

  // Combine with fields declared in schema.dataSchema
  if (schema.dataSchema && Array.isArray(schema.dataSchema)) {
    for (const field of schema.dataSchema) {
      if (field.path) {
        bindings.add(field.path);
      }
    }
  }

  // Sort bindings for clear presentation
  return Array.from(bindings).sort();
}

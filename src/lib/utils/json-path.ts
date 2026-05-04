/**
 * Extract all possible paths from JSON object
 * Example: {customer: {name: "John"}} → ["customer", "customer.name"]
 */
export function extractJsonPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];

  if (!obj || typeof obj !== 'object') {
    return paths;
  }

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Nested object - include parent path and recurse
      paths.push(path);
      paths.push(...extractJsonPaths(value, path));
    } else if (Array.isArray(value)) {
      // Array - show path
      paths.push(path);
      if (value.length > 0 && value[0] && typeof value[0] === 'object') {
        // Show array item fields if array of objects
        const itemPaths = extractJsonPaths(value[0], `${path}[*]`);
        paths.push(...itemPaths);
      }
    } else {
      // Primitive value
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Format path for display with binding syntax
 * Example: "customer.name" → "{{customer.name}}"
 */
export function formatBinding(path: string): string {
  return `{{${path}}}`;
}

/**
 * Get value type from path
 * Returns the type of value at the given path in the object
 */
export function getValueType(
  obj: any,
  path: string
): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'undefined' {
  const value = resolvePath(obj, path);

  if (value === undefined || value === null) return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';

  return 'undefined';
}

/**
 * Resolve a dot-notation path in an object
 * Handles array wildcards [*] by showing the type of the first item
 */
export function resolvePath(obj: any, path: string): any {
  const p = path?.trim();
  if (!p || !obj) return undefined;

  const parts = p.split('.');
  let current = obj;

  for (const part of parts) {
    if (part === '') continue; // Skip empty parts from consecutive dots
    if (current === undefined || current === null) return undefined;

    // Handle array wildcard [*]
    if (part.endsWith('[*]')) {
      const key = part.replace('[*]', '');
      current = current[key];
      if (Array.isArray(current) && current.length > 0) {
        current = current[0];
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Calculate aggregate value from a path in data
 */
function calculateAggregate(func: string, path: string, data: any): string {
  if (!data) return '0';

  // Attempt to find the array to aggregate.
  // If path is "items.price", we look for "items" as the array.
  const pathParts = path.split('.');
  let items: any[] = [];
  let field = '';

  if (pathParts.length > 1) {
    const arrayPath = pathParts.slice(0, -1).join('.');
    field = pathParts[pathParts.length - 1];
    const resolved = resolvePath(data, arrayPath);
    items = Array.isArray(resolved) ? resolved : [];
  } else {
    // If it's just a single word, maybe the root is an array?
    items = Array.isArray(data) ? data : [];
    field = path;
  }

  if (items.length === 0) return '0';

  const values = items.map((item) => {
    const val = item[field];
    return typeof val === 'number' ? val : Number.parseFloat(String(val)) || 0;
  });

  switch (func.toUpperCase()) {
    case 'SUM':
      return values
        .reduce((a, b) => a + b, 0)
        .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'COUNT':
      return items.length.toString();
    case 'AVG':
      return (values.reduce((a, b) => a + b, 0) / items.length).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case 'MIN':
      return Math.min(...values).toLocaleString();
    case 'MAX':
      return Math.max(...values).toLocaleString();
    default:
      return '0';
  }
}

/**
 * Replace all {{path}} occurrences in a string with values from data object
 * Example: "Hello {{user.name}}" + {user: {name: "John"}} -> "Hello John"
 */
export function resolveBindings(text: string, data: any): string {
  if (!text) return '';
  if (!data || Object.keys(data).length === 0) return text;

  // 1. Handle aggregates: {{SUM(items.price)}}
  const resolved = text.replace(
    /\{\{(SUM|COUNT|AVG|MIN|MAX)\((.+?)\)\}\}/gi,
    (_match, func, path) => {
      return calculateAggregate(func, path.trim(), data);
    }
  );

  // 2. Handle normal bindings
  return resolved.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();
    if (!trimmedPath) return match; // Keep {{}} or {{  }} as is

    const value = resolvePath(data, trimmedPath);
    if (value === undefined || value === null) {
      return match; // Keep {{path}} if not found
    }

    // Convert object/array to string representation if needed
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Group paths by their parent object
 * Example: ["customer", "customer.name", "customer.email", "items"]
 *   → [{ name: "customer", paths: ["customer.name", "customer.email"] }, { name: "root", paths: ["items"] }]
 */
export interface PathGroup {
  name: string;
  paths: string[];
}

export function groupPathsByParent(paths: string[]): PathGroup[] {
  const groups: Record<string, string[]> = {};

  for (const path of paths) {
    const parts = path.split('.');
    if (parts.length === 1) {
      // Root level item
      if (!groups.root) groups.root = [];
      groups.root.push(path);
    } else {
      // Nested item - group by parent
      const parent = parts[0];
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(path);
    }
  }

  // Convert to array and sort
  return Object.entries(groups)
    .map(([name, paths]) => ({ name, paths: paths.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a human-readable label for a path
 * Example: "customer.name" → "customer.name", "customer" → "customer"
 */
export function getPathLabel(path: string): string {
  return path;
}

/**
 * Immutably set a value at a dot-notation path in a nested object.
 * Returns the original object unchanged if the path contains "[*]"
 * (wildcard array paths cannot be edited directly).
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  if (path.includes('[*]')) return obj;

  const parts = path.split('.');
  const result = { ...obj };
  let cursor: Record<string, unknown> = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const child = cursor[key];
    const next: Record<string, unknown> =
      child && typeof child === 'object' && !Array.isArray(child)
        ? { ...(child as Record<string, unknown>) }
        : {};
    cursor[key] = next;
    cursor = next;
  }

  const lastKey = parts[parts.length - 1] as string;
  cursor[lastKey] = value;
  return result;
}

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
export function getValueType(obj: any, path: string): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'undefined' {
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
 * Replace all {{path}} occurrences in a string with values from data object
 * Example: "Hello {{user.name}}" + {user: {name: "John"}} -> "Hello John"
 */
export function resolveBindings(text: string, data: any): string {
  if (!text) return '';
  if (!data || Object.keys(data).length === 0) return text;
  
  return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
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
      if (!groups['root']) groups['root'] = [];
      groups['root'].push(path);
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

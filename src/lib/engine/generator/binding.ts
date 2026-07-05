/**
 * Pure data-binding utilities — no imports, fully testable in isolation.
 */

/** Remove binding braces and whitespace from a user-entered binding expression. */
export function cleanBindingPath(expr: string): string {
  return expr.replace(/\{\{|\}\}/g, '').trim();
}

/** Split a wildcard path like `items[*].no` into array path `items` and item path `no`. */
export function splitArrayWildcardPath(
  path: string
): { arrayPath: string; itemPath: string } | null {
  const marker = '[*]';
  const markerIndex = path.indexOf(marker);
  if (markerIndex === -1) return null;

  const arrayPath = path.slice(0, markerIndex).replace(/\.$/, '').trim();
  const itemPath = path
    .slice(markerIndex + marker.length)
    .replace(/^\./, '')
    .trim();

  return { arrayPath, itemPath };
}

/** Return the array portion of a binding path. `items[*].no` -> `items`. */
export function arrayPathFromBinding(expr: string): string {
  const path = cleanBindingPath(expr);
  return splitArrayWildcardPath(path)?.arrayPath ?? path;
}

/** Traverse a dot-separated path through a nested object. Returns `undefined` if not found. */
export function resolvePath(path: string, obj: unknown): unknown {
  if (!path || obj == null) return undefined;

  const wildcard = splitArrayWildcardPath(path);
  if (wildcard) {
    const arrayValue = resolvePath(wildcard.arrayPath, obj);
    if (!Array.isArray(arrayValue)) return undefined;
    if (!wildcard.itemPath) return arrayValue;
    return arrayValue.map((item) => resolvePath(wildcard.itemPath, item));
  }

  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Compute a numeric aggregate over an array of items. */
export function calculateAggregate(func: string, path: string, items: unknown[]): string {
  const cleanPath = path
    .trim()
    .replace(/items\./gi, '')
    .replace(/items,/gi, '')
    .replace(/['"]/g, '')
    .trim();

  if (!items.length) return '0';
  const values = items.map((item) => {
    const v = resolvePath(cleanPath, item);
    return typeof v === 'number' ? v : Number.parseFloat(String(v).replace(/,/g, '')) || 0;
  });
  const sum = values.reduce((a, b) => a + b, 0);
  switch (func.toUpperCase()) {
    case 'SUM':
      return sum.toFixed(2);
    case 'COUNT':
      return items.length.toString();
    case 'AVG':
      return (sum / items.length).toFixed(2);
    case 'MIN':
      return Math.min(...values).toString();
    case 'MAX':
      return Math.max(...values).toString();
    default:
      return '0';
  }
}

/**
 * Resolve all `{{...}}` binding expressions in a string.
 * Supports aggregate functions: `{{SUM(field.path)}}`, `{{COUNT(items)}}`, etc.
 * Falls back from `local` to `global` for normal paths.
 */
export function resolveBinding(
  expr: string,
  local: unknown,
  global: unknown,
  groupItems: unknown[] = []
): string {
  if (!expr || !expr.includes('{{')) return expr ?? '';

  // 1. Aggregates — e.g. {{SUM(line.price)}}
  let result = expr.replace(
    /\{\{(SUM|COUNT|AVG|MIN|MAX)\((.+?)\)\}\}/gi,
    (_, func: string, path: string) => calculateAggregate(func, path.trim(), groupItems)
  );

  // 2. Normal paths — e.g. {{customer.name}}
  result = result.replace(/\{\{(.+?)\}\}/g, (_, path: string) => {
    const trimmed = path.trim();
    const wildcard = splitArrayWildcardPath(trimmed);
    const localPath = wildcard?.itemPath || localPathFromArrayBinding(trimmed, global) || trimmed;
    const val = resolvePath(localPath, local) ?? resolvePath(trimmed, global);
    return val !== undefined ? String(val) : `{{${path}}}`;
  });

  return result;
}

function localPathFromArrayBinding(path: string, global: unknown): string | null {
  const [head, ...tail] = path.split('.');
  if (!head || tail.length === 0) return null;
  return Array.isArray(resolvePath(head, global)) ? tail.join('.') : null;
}

/**
 * Check whether a component's `visible` binding resolves to a truthy value.
 * Returns `true` when `visible` is undefined (no condition = always show).
 */
export function isVisible(visible: string | undefined, local: unknown, global: unknown): boolean {
  if (visible === undefined || visible === '') return true;
  const resolved = resolveBinding(visible, local, global);
  return !['false', '0', ''].includes(resolved.trim().toLowerCase());
}

/**
 * Pure data-binding utilities — no imports, fully testable in isolation.
 */

/** Traverse a dot-separated path through a nested object. Returns `undefined` if not found. */
export function resolvePath(path: string, obj: unknown): unknown {
  if (!path || obj == null) return undefined;
  let current: unknown = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Compute a numeric aggregate over an array of items. */
export function calculateAggregate(func: string, path: string, items: unknown[]): string {
  if (!items.length) return '0';
  const values = items.map((item) => {
    const v = resolvePath(path, item);
    return typeof v === 'number' ? v : Number.parseFloat(String(v)) || 0;
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
    const val = resolvePath(trimmed, local) ?? resolvePath(trimmed, global);
    return val !== undefined ? String(val) : `{{${path}}}`;
  });

  return result;
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

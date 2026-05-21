import type { ComponentNode, TextStyle } from '@/types/schema';

export const MIXED = Symbol('mixed');
export type MixedValue<T> = T | typeof MIXED;

export const TYPOGRAPHY_TYPES = [
  'text',
  'table',
  'page-number',
  'checklist',
] as const satisfies readonly ComponentNode['type'][];

export type TypographyCapableType = (typeof TYPOGRAPHY_TYPES)[number];

export const LINE_TYPES = ['line'] as const satisfies readonly ComponentNode['type'][];

export const TYPE_CHIP_COLORS: Record<string, string> = {
  text: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  table: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  image: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  line: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  checklist: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  spacer: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  barcode: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  qr: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  'summary-box': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  'page-number': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  'page-break-indicator': 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  columns: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  repeater: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
};

export function isTypographyType(type: ComponentNode['type']): type is TypographyCapableType {
  return (TYPOGRAPHY_TYPES as readonly string[]).includes(type);
}

export function getMixedValue<T>(
  components: ComponentNode[],
  getter: (c: ComponentNode) => T
): MixedValue<T> {
  if (components.length === 0) return MIXED;
  const first = getter(components[0]);
  for (let i = 1; i < components.length; i++) {
    if (getter(components[i]) !== first) return MIXED;
  }
  return first;
}

export function getMixedStyleValue<T>(
  components: ComponentNode[],
  key: keyof TextStyle
): MixedValue<T> {
  return getMixedValue(components, (c) => {
    const style = (c as { style?: TextStyle }).style;
    return (style?.[key] ?? undefined) as T;
  });
}

export function isMixed<T>(value: MixedValue<T>): value is typeof MIXED {
  return value === MIXED;
}

export function countByType(components: ComponentNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of components) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  return counts;
}

export function componentsOfType(
  components: ComponentNode[],
  type: ComponentNode['type']
): ComponentNode[] {
  return components.filter((c) => c.type === type);
}
